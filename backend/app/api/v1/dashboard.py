from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Credit, FinancialMovement, Product, Sale, SaleItem, User
from app.schemas.alerts import AlertItem, AlertsResponse
from app.schemas.dashboard import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def format_quantity(value: Decimal) -> str:
    return format(value.normalize(), "f")


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    report_date: date | None = Query(default=None, alias="date"),
    database: Session = Depends(get_db),
    _: User = Depends(require_section("dashboard")),
) -> DashboardSummary:
    selected_date = report_date or datetime.now(timezone.utc).date()
    start_of_day = datetime.combine(selected_date, time.min, tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)
    income_today = database.scalar(
        select(func.coalesce(func.sum(FinancialMovement.amount), 0)).where(
            FinancialMovement.movement_type == "INCOME",
            FinancialMovement.created_at >= start_of_day,
            FinancialMovement.created_at < end_of_day,
        )
    ) or Decimal("0")
    expenses_today = database.scalar(
        select(func.coalesce(func.sum(FinancialMovement.amount), 0)).where(
            FinancialMovement.movement_type == "EXPENSE",
            FinancialMovement.created_at >= start_of_day,
            FinancialMovement.created_at < end_of_day,
        )
    ) or Decimal("0")
    sales_today = database.scalar(
        select(func.count(Sale.id)).where(Sale.created_at >= start_of_day, Sale.created_at < end_of_day)
    ) or 0
    products_sold_today = database.scalar(
        select(func.coalesce(func.sum(SaleItem.quantity), 0))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(Sale.created_at >= start_of_day, Sale.created_at < end_of_day)
    ) or Decimal("0")
    cost_today = database.scalar(
        select(func.coalesce(func.sum(SaleItem.quantity * SaleItem.unit_cost_snapshot), 0))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(Sale.created_at >= start_of_day, Sale.created_at < end_of_day)
    ) or Decimal("0")
    pending_credits = database.scalar(
        select(func.coalesce(func.sum(Credit.pending_amount), 0)).where(Credit.status == "PENDING")
    ) or Decimal("0")
    low_stock_products = database.scalar(
        select(func.count(Product.id)).where(
            Product.is_active.is_(True),
            Product.stock <= Product.low_stock_threshold,
        )
    ) or 0

    return DashboardSummary(
        date=selected_date.isoformat(),
        income_today=income_today,
        expenses_today=expenses_today,
        cost_today=cost_today,
        profit_today=income_today - cost_today - expenses_today,
        sales_today=sales_today,
        products_sold_today=products_sold_today,
        pending_credits=pending_credits,
        low_stock_products=low_stock_products,
    )


@router.get("/alerts", response_model=AlertsResponse)
def dashboard_alerts(
    database: Session = Depends(get_db),
    _: User = Depends(require_section("dashboard")),
) -> AlertsResponse:
    alerts: list[AlertItem] = []
    low_stock_products = database.scalars(
        select(Product).where(
            Product.is_active.is_(True),
            Product.stock <= Product.low_stock_threshold,
        ).order_by(Product.stock, Product.name).limit(10)
    ).all()
    for product in low_stock_products:
        alerts.append(AlertItem(
            id=f"stock-{product.id}",
            kind="LOW_STOCK",
            title=f"Stock bajo: {product.name}",
            detail=f"Quedan {format_quantity(product.stock)} unidades (mínimo {format_quantity(product.low_stock_threshold)}).",
            href="/productos",
        ))

    recent_sales = database.execute(
        select(Sale, User.full_name)
        .join(User, User.id == Sale.user_id)
        .where(Sale.created_at >= datetime.now(timezone.utc) - timedelta(hours=24))
        .order_by(Sale.created_at.desc())
        .limit(10)
    ).all()
    sale_ids = [sale.id for sale, _ in recent_sales]
    items_by_sale: dict[int, list[str]] = {}
    if sale_ids:
        sale_items = database.execute(
            select(SaleItem.sale_id, Product.name, SaleItem.quantity)
            .join(Product, Product.id == SaleItem.product_id)
            .where(SaleItem.sale_id.in_(sale_ids))
        ).all()
        for sale_id, product_name, quantity in sale_items:
            items_by_sale.setdefault(sale_id, []).append(f"{format_quantity(quantity)} x {product_name}")
    for sale, seller_name in recent_sales:
        items = ", ".join(items_by_sale.get(sale.id, [])) or "Venta registrada"
        alerts.append(AlertItem(
            id=f"sale-{sale.id}",
            kind="SALE",
            title=f"{seller_name} registró una venta",
            detail=f"{items} · Total {sale.total}",
            created_at=sale.created_at,
            href="/movimientos",
        ))
    alerts.sort(key=lambda alert: alert.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return AlertsResponse(alerts=alerts[:15], unread_count=len(alerts[:15]))