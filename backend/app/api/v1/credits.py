from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.api.v1.dependencies import require_admin
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Credit, Customer, FinancialMovement, InventoryMovement, Product, Sale, SaleItem, SaleSupport, User
from app.schemas.credits import CreditPaymentCreate, CreditProduct, CreditRow, CreditsResponse

router = APIRouter(prefix="/credits", tags=["credits"])


def delete_credit_records(credit: Credit, database: Session) -> None:
    sale = database.get(Sale, credit.sale_id)
    if sale is None:
        database.delete(credit)
        return
    inventory_movements = database.scalars(select(InventoryMovement).where(InventoryMovement.sale_id == sale.id)).all()
    for movement in inventory_movements:
        product = database.scalar(select(Product).where(Product.id == movement.product_id).with_for_update())
        if product is not None:
            product.stock += movement.quantity
        database.delete(movement)
    database.query(FinancialMovement).filter(FinancialMovement.sale_id == sale.id).delete(synchronize_session=False)
    database.query(SaleItem).filter(SaleItem.sale_id == sale.id).delete(synchronize_session=False)
    database.query(SaleSupport).filter(SaleSupport.sale_id == sale.id).delete(synchronize_session=False)
    database.delete(credit)
    database.delete(sale)


def register_credit_payment(credit_id: int, payload: CreditPaymentCreate, database: Session, current_user: User) -> CreditRow:
    credit = database.scalar(select(Credit).where(Credit.id == credit_id).with_for_update())
    if credit is None or credit.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crédito pendiente no encontrado")
    if payload.amount > credit.pending_amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El pago no puede superar el saldo pendiente")
    sale = database.get(Sale, credit.sale_id)
    if sale is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta asociada no encontrada")
    credit.pending_amount -= payload.amount
    if credit.pending_amount == 0:
        credit.status = "PAID"
        credit.paid_at = datetime.now(timezone.utc).date()
    from app.models import FinancialMovement
    database.add(FinancialMovement(user_id=current_user.id, movement_type="INCOME", amount=payload.amount, concept=f"Pago crédito {sale.sale_number}", payment_method=payload.payment_method, sale_id=sale.id))
    database.commit()
    return next(row for row in list_credits(database, current_user).credits if row.id == credit.id)


@router.post("/{credit_id}/payments", response_model=CreditRow)
def create_credit_payment(
    credit_id: int,
    payload: CreditPaymentCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("creditos")),
) -> CreditRow:
    return register_credit_payment(credit_id, payload, database, current_user)


@router.delete("/{credit_id}", status_code=204)
def delete_credit(
    credit_id: int,
    database: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    credit = database.get(Credit, credit_id)
    if credit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crédito no encontrado")
    delete_credit_records(credit, database)
    database.commit()


@router.post("/{credit_id}/pay", response_model=CreditRow)
def pay_credit(credit_id: int, payment_method: str, database: Session = Depends(get_db), current_user: User = Depends(require_section("creditos"))) -> CreditRow:
    if payment_method not in {"CASH", "NEQUI"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El pago debe ser en efectivo o Nequi")
    credit = database.scalar(select(Credit).where(Credit.id == credit_id).with_for_update())
    if credit is None or credit.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crédito pendiente no encontrado")
    return register_credit_payment(credit_id, CreditPaymentCreate(amount=credit.pending_amount, payment_method=payment_method), database, current_user)


@router.get("", response_model=CreditsResponse)
def list_credits(
    database: Session = Depends(get_db),
    _: User = Depends(require_section("creditos")),
) -> CreditsResponse:
    seller = aliased(User)
    cashier = aliased(User)
    rows = database.execute(
        select(Credit, Sale.sale_number, Customer.name, seller.full_name, cashier.full_name)
        .join(Sale, Sale.id == Credit.sale_id)
        .join(Customer, Customer.id == Credit.customer_id)
        .outerjoin(seller, seller.id == Sale.assigned_seller_id)
        .join(cashier, cashier.id == Sale.user_id)
        .order_by(Credit.created_at.desc())
    ).all()
    sale_ids = [credit.sale_id for credit, *_ in rows]
    supports = database.scalars(select(SaleSupport).where(SaleSupport.sale_id.in_(sale_ids))).all() if sale_ids else []
    item_rows = database.execute(
        select(SaleItem.sale_id, Product.name, SaleItem.quantity)
        .join(Product, Product.id == SaleItem.product_id)
        .where(SaleItem.sale_id.in_(sale_ids))
    ).all() if sale_ids else []
    support_urls: dict[int, list[str]] = {}
    for support in supports:
        support_urls.setdefault(support.sale_id, []).append(support.file_url)
    products: dict[int, list[CreditProduct]] = {}
    for sale_id, product_name, quantity in item_rows:
        products.setdefault(sale_id, []).append(CreditProduct(name=product_name, quantity=quantity))
    return CreditsResponse(credits=[CreditRow(
        id=credit.id,
        sale_id=credit.sale_id,
        sale_number=sale_number,
        customer_name=customer_name,
        seller_name=seller_name,
        cashier_name=cashier_name,
        original_amount=credit.original_amount,
        pending_amount=credit.pending_amount,
        status=credit.status,
        created_at=credit.created_at,
        products=products.get(credit.sale_id, []),
        support_urls=support_urls.get(credit.sale_id, []),
    ) for credit, sale_number, customer_name, seller_name, cashier_name in rows])