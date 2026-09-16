from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Credit, Customer, Product, Sale, SaleItem, SaleSupport, User
from app.schemas.credits import CreditProduct, CreditRow, CreditsResponse

router = APIRouter(prefix="/credits", tags=["credits"])


@router.post("/{credit_id}/pay", response_model=CreditRow)
def pay_credit(credit_id: int, payment_method: str, database: Session = Depends(get_db), current_user: User = Depends(require_section("creditos"))) -> CreditRow:
    if payment_method not in {"CASH", "NEQUI"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El pago debe ser en efectivo o Nequi")
    credit = database.get(Credit, credit_id)
    if credit is None or credit.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crédito pendiente no encontrado")
    sale = database.get(Sale, credit.sale_id)
    credit.status = "PAID"
    credit.pending_amount = 0
    credit.paid_at = datetime.now(timezone.utc).date()
    from app.models import FinancialMovement
    database.add(FinancialMovement(user_id=current_user.id, movement_type="INCOME", amount=credit.original_amount, concept=f"Pago crédito {sale.sale_number}", payment_method=payment_method, sale_id=sale.id))
    database.commit()
    return next(row for row in list_credits(database, current_user).credits if row.id == credit.id)


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