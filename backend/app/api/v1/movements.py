from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import FinancialMovement, InventoryMovement, Product, SaleItem, User
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
    rows = [MovementRow(id=movement.id, domain="inventory", related_id=movement.sale_id, movement_type=movement.movement_type, amount=None, quantity=movement.quantity, concept=movement.observation or movement.movement_type, product_name=product_name, created_at=movement.created_at) for movement, product_name in inventory_rows]
    rows.extend(MovementRow(id=movement.id, domain="financial", related_id=movement.sale_id, movement_type=movement.movement_type, amount=movement.amount, quantity=quantity if movement.movement_type == "INCOME" else None, concept=movement.concept, product_name=None, created_at=movement.created_at) for movement, quantity in financial_rows)
    rows.sort(key=lambda row: row.created_at, reverse=True)
    return MovementsResponse(movements=rows[:100])