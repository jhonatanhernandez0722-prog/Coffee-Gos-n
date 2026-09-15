from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Customer, FinancialMovement, InventoryMovement, Product, Sale, SaleItem, SaleSupport, User
from app.schemas.movements import MovementRow, MovementsResponse

router = APIRouter(prefix="/movements", tags=["movements"])


@router.get("", response_model=MovementsResponse)
def list_movements(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    movement_type: str | None = Query(default=None, max_length=20),
    database: Session = Depends(get_db),
    _: User = Depends(require_section("movimientos")),
) -> MovementsResponse:
    inventory_statement = select(InventoryMovement, Product.name).join(Product, Product.id == InventoryMovement.product_id)
    financial_statement = select(FinancialMovement, func.coalesce(func.sum(SaleItem.quantity), 0).label("quantity")).outerjoin(SaleItem, SaleItem.sale_id == FinancialMovement.sale_id).group_by(FinancialMovement.id)
    if date_from:
        start = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        inventory_statement = inventory_statement.where(InventoryMovement.created_at >= start)
        financial_statement = financial_statement.where(FinancialMovement.created_at >= start)
    if date_to:
        end = datetime.combine(date_to, time.min, tzinfo=timezone.utc) + timedelta(days=1)
        inventory_statement = inventory_statement.where(InventoryMovement.created_at < end)
        financial_statement = financial_statement.where(FinancialMovement.created_at < end)
    if movement_type:
        inventory_statement = inventory_statement.where(InventoryMovement.movement_type == movement_type.upper())
        financial_statement = financial_statement.where(FinancialMovement.movement_type == movement_type.upper())
    inventory_rows = database.execute(inventory_statement.order_by(InventoryMovement.created_at.desc()).limit(100)).all()
    financial_rows = database.execute(financial_statement.order_by(FinancialMovement.created_at.desc()).limit(100)).all()
    internal_seller_ids = {movement.assigned_seller_id for movement, _ in inventory_rows if movement.assigned_seller_id}
    internal_sellers = dict(database.execute(select(User.id, User.full_name).where(User.id.in_(internal_seller_ids))).all()) if internal_seller_ids else {}
    sale_metadata: dict[int, dict[str, object]] = {}
    sale_ids = {movement.sale_id for movement, _ in inventory_rows if movement.sale_id} | {movement.sale_id for movement, _ in financial_rows if movement.sale_id}
    if sale_ids:
        cashier = aliased(User)
        seller = aliased(User)
        sale_rows = database.execute(
            select(Sale.id, Sale.sale_number, Sale.payment_method, Customer.name, seller.full_name, cashier.full_name)
            .outerjoin(Customer, Customer.id == Sale.customer_id)
            .outerjoin(seller, seller.id == Sale.assigned_seller_id)
            .join(cashier, cashier.id == Sale.user_id)
            .where(Sale.id.in_(sale_ids))
        ).all()
        support_rows = database.scalars(select(SaleSupport).where(SaleSupport.sale_id.in_(sale_ids))).all()
        support_urls: dict[int, list[str]] = {}
        for support in support_rows:
            support_urls.setdefault(support.sale_id, []).append(support.file_url)
        sale_metadata = {sale_id: {"sale_number": sale_number, "payment_method": payment_method, "customer_name": customer_name, "seller_name": seller_name, "cashier_name": cashier_name, "support_urls": support_urls.get(sale_id, [])} for sale_id, sale_number, payment_method, customer_name, seller_name, cashier_name in sale_rows}

    def metadata(sale_id: int | None) -> dict[str, object]:
        return sale_metadata.get(sale_id, {"sale_number": None, "payment_method": None, "customer_name": None, "seller_name": None, "cashier_name": None, "support_urls": []})

    rows = []
    for movement, product_name in inventory_rows:
        extra = metadata(movement.sale_id)
        if movement.assigned_seller_id:
            extra["seller_name"] = internal_sellers.get(movement.assigned_seller_id)
        rows.append(MovementRow(id=movement.id, domain="inventory", related_id=movement.sale_id, movement_type=movement.movement_type, amount=None, quantity=movement.quantity, concept=movement.observation or movement.movement_type, product_name=product_name, created_at=movement.created_at, **extra))
    for movement, quantity in financial_rows:
        extra = metadata(movement.sale_id)
        rows.append(MovementRow(id=movement.id, domain="financial", related_id=movement.sale_id, movement_type=movement.movement_type, amount=movement.amount, quantity=quantity if movement.movement_type == "INCOME" else None, concept=movement.concept, product_name=None, created_at=movement.created_at, **extra))
    rows.sort(key=lambda row: row.created_at, reverse=True)
    return MovementsResponse(movements=rows[:100])