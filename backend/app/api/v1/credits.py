from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.api.v1.dependencies import require_admin
from app.core.business_time import business_today
from app.core.permissions import require_any_section, require_section
from app.db.session import get_db
from app.models import Credit, Customer, FinancialMovement, InventoryMovement, Product, Sale, SaleItem, SaleSupport, User
from app.schemas.credits import AppliedCreditPayment, CreditPayment, CreditPaymentCreate, CreditProduct, CreditRow, CreditsResponse, CustomerPaymentResult

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
        credit.paid_at = business_today()
    from app.models import FinancialMovement
    database.add(FinancialMovement(user_id=current_user.id, movement_type="INCOME", amount=payload.amount, concept=f"Pago crédito {sale.sale_number}", payment_method=payload.payment_method, sale_id=sale.id))
    database.commit()
    return credit_rows(database, Credit.id == credit.id).credits[0]


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
    return credit_rows(database)


def credit_rows(database: Session, *filters) -> CreditsResponse:
    seller = aliased(User)
    cashier = aliased(User)
    rows = database.execute(
        select(Credit, Sale.sale_number, Customer.name, seller.full_name, cashier.full_name)
        .join(Sale, Sale.id == Credit.sale_id)
        .join(Customer, Customer.id == Credit.customer_id)
        .outerjoin(seller, seller.id == Sale.assigned_seller_id)
        .join(cashier, cashier.id == Sale.user_id)
        .where(*filters)
        .order_by(Credit.created_at.desc())
    ).all()
    sale_ids = [credit.sale_id for credit, *_ in rows]
    supports = database.scalars(select(SaleSupport).where(SaleSupport.sale_id.in_(sale_ids))).all() if sale_ids else []
    item_rows = database.execute(
        select(SaleItem.sale_id, Product.name, SaleItem.quantity)
        .join(Product, Product.id == SaleItem.product_id)
        .where(SaleItem.sale_id.in_(sale_ids))
    ).all() if sale_ids else []
    payment_rows = database.scalars(
        select(FinancialMovement)
        .where(FinancialMovement.sale_id.in_(sale_ids), FinancialMovement.movement_type == "INCOME")
        .order_by(FinancialMovement.created_at)
    ).all() if sale_ids else []
    payments: dict[int, list[CreditPayment]] = {}
    for payment in payment_rows:
        payments.setdefault(payment.sale_id, []).append(CreditPayment(amount=payment.amount, payment_method=payment.payment_method, created_at=payment.created_at))
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
        payments=payments.get(credit.sale_id, []),
    ) for credit, sale_number, customer_name, seller_name, cashier_name in rows])


def pending_customer_credits(database: Session, customer_id: int, lock: bool = False) -> list[Credit]:
    """Créditos pendientes del cliente, del más antiguo al más reciente (orden en que se abonan)."""
    statement = select(Credit).where(Credit.customer_id == customer_id, Credit.status == "PENDING").order_by(Credit.created_at, Credit.id)
    return list(database.scalars(statement.with_for_update() if lock else statement).all())


@router.get("/customer/{customer_id}", response_model=CreditsResponse)
def list_customer_credits(
    customer_id: int,
    database: Session = Depends(get_db),
    _: User = Depends(require_any_section("clientes", "creditos")),
) -> CreditsResponse:
    return credit_rows(database, Credit.customer_id == customer_id, Credit.status == "PENDING")


@router.post("/customer/{customer_id}/payments", response_model=CustomerPaymentResult)
def pay_customer_credits(
    customer_id: int,
    payload: CreditPaymentCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_any_section("clientes", "creditos")),
) -> CustomerPaymentResult:
    credits = pending_customer_credits(database, customer_id, lock=True)
    total_pending = sum((credit.pending_amount for credit in credits), Decimal("0"))
    if not credits:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El cliente no tiene créditos pendientes")
    if payload.amount > total_pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El pago no puede superar lo que debe el cliente")
    sale_numbers = dict(database.execute(select(Sale.id, Sale.sale_number).where(Sale.id.in_([credit.sale_id for credit in credits]))).all())
    remaining = payload.amount
    applied: list[AppliedCreditPayment] = []
    # Todo en una transacción: el abono se aplica completo o no se aplica.
    for credit in credits:
        if remaining <= 0:
            break
        amount = min(remaining, credit.pending_amount)
        remaining -= amount
        credit.pending_amount -= amount
        if credit.pending_amount == 0:
            credit.status = "PAID"
            credit.paid_at = business_today()
        sale_number = sale_numbers.get(credit.sale_id, str(credit.sale_id))
        database.add(FinancialMovement(user_id=current_user.id, movement_type="INCOME", amount=amount, concept=f"Pago crédito {sale_number}", payment_method=payload.payment_method, sale_id=credit.sale_id))
        applied.append(AppliedCreditPayment(credit_id=credit.id, sale_number=sale_number, amount=amount, paid_off=credit.status == "PAID"))
    database.commit()
    return CustomerPaymentResult(applied=applied, remaining_debt=total_pending - payload.amount)
