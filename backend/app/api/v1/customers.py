from datetime import datetime, time, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Credit, Customer, Sale, SaleItem, Product, User
from app.schemas.customers import CustomerSuggestion, CustomerSummary, CustomersDashboard

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/{customer_id}/export")
def export_customer(
    customer_id: int,
    database: Session = Depends(get_db),
    _: User = Depends(require_section("clientes")),
) -> dict:
    customer = database.get(Customer, customer_id)
    if customer is None:
        return {"error": "Customer not found"}
    sales = database.execute(select(Sale).where(Sale.customer_id == customer_id).order_by(Sale.created_at.desc())).scalars().all()
    sale_ids = [sale.id for sale in sales]
    items = database.execute(select(SaleItem, Product.name).join(Product, Product.id == SaleItem.product_id).where(SaleItem.sale_id.in_(sale_ids))).all() if sale_ids else []
    items_by_sale: dict[int, list[dict]] = {}
    for item, product_name in items:
        items_by_sale.setdefault(item.sale_id, []).append({"product": product_name, "quantity": str(item.quantity), "unit_price": str(item.unit_price)})
    credits = database.scalars(select(Credit).where(Credit.customer_id == customer_id).order_by(Credit.created_at.desc())).all()
    return {
        "customer": {"id": customer.id, "name": customer.name, "phone": customer.phone, "identifier": customer.identifier, "created_at": customer.created_at.isoformat()},
        "sales": [{"sale_number": sale.sale_number, "total": str(sale.total), "payment_method": sale.payment_method, "created_at": sale.created_at.isoformat(), "items": items_by_sale.get(sale.id, [])} for sale in sales],
        "credits": [{"original_amount": str(credit.original_amount), "pending_amount": str(credit.pending_amount), "status": credit.status, "created_at": credit.created_at.isoformat(), "paid_at": credit.paid_at.isoformat() if credit.paid_at else None} for credit in credits],
    }


@router.get("/search", response_model=list[CustomerSuggestion])
def search_customers(
    query: str = Query(min_length=1, max_length=150),
    database: Session = Depends(get_db),
    _: User = Depends(require_section("clientes")),
) -> list[Customer]:
    return list(database.scalars(select(Customer).where(Customer.is_active.is_(True), Customer.name.ilike(f"%{query.strip()}%")).order_by(Customer.name).limit(8)))


@router.get("/summary", response_model=CustomersDashboard)
def customers_summary(
    database: Session = Depends(get_db),
    _: User = Depends(require_section("clientes")),
) -> CustomersDashboard:
    today = datetime.now(timezone.utc).date()
    start_of_day = datetime.combine(today, time.min, tzinfo=timezone.utc)
    purchase_count = select(func.count(Sale.id)).where(Sale.customer_id == Customer.id).correlate(Customer).scalar_subquery()
    total_spent = select(func.coalesce(func.sum(Sale.total), 0)).where(Sale.customer_id == Customer.id).correlate(Customer).scalar_subquery()
    pending_credit = select(func.coalesce(func.sum(Credit.pending_amount), 0)).where(Credit.customer_id == Customer.id, Credit.status == "PENDING").correlate(Customer).scalar_subquery()
    last_purchase = select(func.max(Sale.created_at)).where(Sale.customer_id == Customer.id).correlate(Customer).scalar_subquery()
    rows = database.execute(
        select(Customer, purchase_count, total_spent, pending_credit, last_purchase)
        .where(Customer.is_active.is_(True))
        .order_by(Customer.name)
    ).all()
    customers = [CustomerSummary(id=customer.id, name=customer.name, phone=customer.phone, purchase_count=int(count), total_spent=total_spent or Decimal("0"), pending_credit=pending_credit or Decimal("0"), last_purchase_at=last_purchase_at) for customer, count, total_spent, pending_credit, last_purchase_at in rows]
    return CustomersDashboard(
        total_customers=len(customers),
        total_purchases=sum(customer.purchase_count for customer in customers),
        total_spent=sum((customer.total_spent for customer in customers), Decimal("0")),
        pending_credits=sum((customer.pending_credit for customer in customers), Decimal("0")),
        purchases_today=database.scalar(select(func.count(Sale.id)).where(Sale.created_at >= start_of_day)) or 0,
        customers=customers,
    )