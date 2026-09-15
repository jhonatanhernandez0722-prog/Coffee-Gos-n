from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, aliased

from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import AlertRead, Credit, FinancialMovement, Product, Sale, SaleItem, User
from app.schemas.alerts import AlertItem, AlertReadRequest, AlertsResponse
from app.schemas.dashboard import DashboardSummary, MonthlyProductRow, MonthlyReport

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
            ~select(Credit.id).where(Credit.sale_id == FinancialMovement.sale_id, Credit.status == "PENDING").exists(),
        )
    ) or Decimal("0")
    expenses_today = database.scalar(
        select(func.coalesce(func.sum(FinancialMovement.amount), 0)).where(
            FinancialMovement.movement_type == "EXPENSE",
            FinancialMovement.created_at >= start_of_day,
            FinancialMovement.created_at < end_of_day,
        )
    ) or Decimal("0")
    balance_total = database.scalar(
        select(func.coalesce(func.sum(case((FinancialMovement.movement_type == "INCOME", FinancialMovement.amount), else_=-FinancialMovement.amount)), 0))
        .where(~select(Credit.id).where(Credit.sale_id == FinancialMovement.sale_id, Credit.status == "PENDING").exists())
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
        .where(
            Sale.created_at >= start_of_day,
            Sale.created_at < end_of_day,
            ~select(Credit.id).where(Credit.sale_id == Sale.id, Credit.status == "PENDING").exists(),
        )
    ) or Decimal("0")
    pending_credits = database.scalar(
        select(func.coalesce(func.sum(Credit.pending_amount), 0)).where(Credit.status == "PENDING")
    ) or Decimal("0")
    pending_credit_count = database.scalar(select(func.count(Credit.id)).where(Credit.status == "PENDING")) or 0
    cash_balance = database.scalar(select(func.coalesce(func.sum(case((FinancialMovement.movement_type == "INCOME", FinancialMovement.amount), else_=-FinancialMovement.amount)), 0)).where(FinancialMovement.payment_method == "CASH", ~select(Credit.id).where(Credit.sale_id == FinancialMovement.sale_id, Credit.status == "PENDING").exists())) or Decimal("0")
    nequi_balance = database.scalar(select(func.coalesce(func.sum(case((FinancialMovement.movement_type == "INCOME", FinancialMovement.amount), else_=-FinancialMovement.amount)), 0)).where(FinancialMovement.payment_method == "NEQUI", ~select(Credit.id).where(Credit.sale_id == FinancialMovement.sale_id, Credit.status == "PENDING").exists())) or Decimal("0")
    low_stock_products = database.scalar(
        select(func.count(Product.id)).where(
            Product.is_active.is_(True),
            Product.stock <= Product.low_stock_threshold,
        )
    ) or 0
    products = database.execute(
        select(
            Product.name,
            func.sum(SaleItem.quantity),
            func.sum(SaleItem.quantity * SaleItem.unit_price),
            func.sum(SaleItem.quantity * SaleItem.unit_cost_snapshot),
            func.avg(SaleItem.unit_price),
        )
        .join(SaleItem, SaleItem.product_id == Product.id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(
            Sale.created_at >= start_of_day,
            Sale.created_at < end_of_day,
            ~select(Credit.id).where(Credit.sale_id == Sale.id, Credit.status == "PENDING").exists(),
        )
        .group_by(Product.name)
        .order_by(Product.name)
    ).all()
    product_rows = [
        MonthlyProductRow(
            product_name=name,
            units_sold=units or 0,
            sales_total=sales or 0,
            cost_total=cost or 0,
            profit_total=(sales or 0) - (cost or 0),
            unit_price=price or 0,
        )
        for name, units, sales, cost, price in products
    ]

    return DashboardSummary(
        date=selected_date.isoformat(),
        balance_total=balance_total,
        pending_credit_count=pending_credit_count,
        cash_balance=cash_balance,
        nequi_balance=nequi_balance,
        income_today=income_today,
        expenses_today=expenses_today,
        cost_today=cost_today,
        profit_today=income_today - cost_today - expenses_today,
        sales_today=sales_today,
        products_sold_today=products_sold_today,
        pending_credits=pending_credits,
        low_stock_products=low_stock_products,
        products=product_rows,
    )


@router.get("/monthly-report", response_model=MonthlyReport)
def monthly_report(
    month: str = Query(pattern=r"^\d{4}-\d{2}$"),
    database: Session = Depends(get_db),
    _: User = Depends(require_section("dashboard")),
) -> MonthlyReport:
    month_start = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
    next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    days = (next_month.date() - month_start.date()).days
    income_day = func.date_trunc("day", FinancialMovement.created_at)
    expense_day = func.date_trunc("day", FinancialMovement.created_at)
    sales_day = func.date_trunc("day", Sale.created_at)
    income_by_day = database.execute(select(income_day, func.sum(FinancialMovement.amount)).where(FinancialMovement.movement_type == "INCOME", FinancialMovement.created_at >= month_start, FinancialMovement.created_at < next_month, ~select(Credit.id).where(Credit.sale_id == FinancialMovement.sale_id, Credit.status == "PENDING").exists()).group_by(income_day)).all()
    expense_by_day = database.execute(select(expense_day, func.sum(FinancialMovement.amount)).where(FinancialMovement.movement_type == "EXPENSE", FinancialMovement.created_at >= month_start, FinancialMovement.created_at < next_month).group_by(expense_day)).all()
    sales_by_day = database.execute(select(sales_day, func.count(Sale.id)).where(Sale.created_at >= month_start, Sale.created_at < next_month).group_by(sales_day)).all()
    income_map = {value.date(): total or 0 for value, total in income_by_day}
    expense_map = {value.date(): total or 0 for value, total in expense_by_day}
    sales_map = {value.date(): count for value, count in sales_by_day}
    date_list = [month_start.date() + timedelta(days=index) for index in range(days)]
    balance_total = database.scalar(
        select(func.coalesce(func.sum(case((FinancialMovement.movement_type == "INCOME", FinancialMovement.amount), else_=-FinancialMovement.amount)), 0))
        .where(~select(Credit.id).where(Credit.sale_id == FinancialMovement.sale_id, Credit.status == "PENDING").exists())
    ) or Decimal("0")
    products = database.execute(select(Product.name, func.sum(SaleItem.quantity), func.sum(SaleItem.quantity * SaleItem.unit_price), func.sum(SaleItem.quantity * SaleItem.unit_cost_snapshot), func.avg(SaleItem.unit_price)).join(SaleItem, SaleItem.product_id == Product.id).join(Sale, Sale.id == SaleItem.sale_id).where(Sale.created_at >= month_start, Sale.created_at < next_month, ~select(Credit.id).where(Credit.sale_id == Sale.id, Credit.status == "PENDING").exists()).group_by(Product.name).order_by(Product.name)).all()
    product_rows = [MonthlyProductRow(product_name=name, units_sold=units or 0, sales_total=sales or 0, cost_total=cost or 0, profit_total=(sales or 0) - (cost or 0), unit_price=price or 0) for name, units, sales, cost, price in products]
    return MonthlyReport(month=month, balance_total=balance_total, days=[value.isoformat() for value in date_list], income_by_day=[income_map.get(value, 0) for value in date_list], expenses_by_day=[expense_map.get(value, 0) for value in date_list], sales_by_day=[sales_map.get(value, 0) for value in date_list], total_income=sum(income_map.values(), Decimal("0")), total_expenses=sum(expense_map.values(), Decimal("0")), total_sales=sum(sales_map.values()), products=product_rows)


@router.get("/alerts", response_model=AlertsResponse)
def dashboard_alerts(
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("dashboard")),
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

    assigned_seller = aliased(User)
    cashier = aliased(User)
    recent_sales = database.execute(
        select(Sale, cashier.full_name, assigned_seller.full_name)
        .join(cashier, cashier.id == Sale.user_id)
        .outerjoin(assigned_seller, assigned_seller.id == Sale.assigned_seller_id)
        .where(Sale.created_at >= datetime.now(timezone.utc) - timedelta(hours=24))
        .order_by(Sale.created_at.desc())
        .limit(10)
    ).all()
    sale_ids = [sale.id for sale, _, _ in recent_sales]
    items_by_sale: dict[int, list[str]] = {}
    if sale_ids:
        sale_items = database.execute(
            select(SaleItem.sale_id, Product.name, SaleItem.quantity)
            .join(Product, Product.id == SaleItem.product_id)
            .where(SaleItem.sale_id.in_(sale_ids))
        ).all()
        for sale_id, product_name, quantity in sale_items:
            items_by_sale.setdefault(sale_id, []).append(f"{format_quantity(quantity)} x {product_name}")
    for sale, cashier_name, assigned_seller_name in recent_sales:
        items = ", ".join(items_by_sale.get(sale.id, [])) or "Venta registrada"
        assigned_label = assigned_seller_name or "Sin vendedor asignado"
        alerts.append(AlertItem(
            id=f"sale-{sale.id}",
            kind="SALE",
            title=f"{cashier_name} registró la venta",
            detail=f"Vendedor asignado: {assigned_label} · {items} · Total {sale.total}",
            created_at=sale.created_at,
            href="/movimientos",
        ))
    alerts.sort(key=lambda alert: alert.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    alerts = alerts[:15]
    alert_ids = [alert.id for alert in alerts]
    read_alert_ids = set(database.scalars(select(AlertRead.alert_id).where(AlertRead.user_id == current_user.id, AlertRead.alert_id.in_(alert_ids))).all()) if alert_ids else set()
    return AlertsResponse(alerts=alerts, unread_count=sum(alert.id not in read_alert_ids for alert in alerts))


@router.post("/alerts/read", status_code=204)
def mark_alerts_read(
    request: AlertReadRequest,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("dashboard")),
) -> None:
    existing_alert_ids = set(database.scalars(select(AlertRead.alert_id).where(AlertRead.user_id == current_user.id, AlertRead.alert_id.in_(request.alert_ids))).all()) if request.alert_ids else set()
    for alert_id in set(request.alert_ids) - existing_alert_ids:
        database.add(AlertRead(user_id=current_user.id, alert_id=alert_id))
    database.commit()