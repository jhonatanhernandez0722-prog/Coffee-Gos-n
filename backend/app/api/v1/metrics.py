from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Credit, ExpenseCategory, FinancialMovement, Sale, User
from app.schemas.metrics import MetricPoint, MetricsResponse

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("", response_model=MetricsResponse)
def metrics(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    database: Session = Depends(get_db),
    _: User = Depends(require_section("metricas")),
) -> MetricsResponse:
    end = datetime.combine(date_to or datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc) + timedelta(days=1)
    start = datetime.combine(date_from or (end.date() - timedelta(days=29)), time.min, tzinfo=timezone.utc)
    day = func.date_trunc("day", FinancialMovement.created_at)
    income_rows = database.execute(select(day, func.sum(FinancialMovement.amount)).where(FinancialMovement.movement_type == "INCOME", FinancialMovement.created_at >= start, FinancialMovement.created_at < end, ~select(Credit.id).where(Credit.sale_id == FinancialMovement.sale_id, Credit.status == "PENDING").exists()).group_by(day).order_by(day)).all()
    expense_date = func.coalesce(FinancialMovement.settled_at, FinancialMovement.created_at)
    expense_day = func.date_trunc("day", expense_date)
    expense_rows = database.execute(select(expense_day, func.sum(FinancialMovement.amount)).where(FinancialMovement.movement_type == "EXPENSE", FinancialMovement.settled_at.is_not(None), expense_date >= start, expense_date < end).group_by(expense_day).order_by(expense_day)).all()
    sales_day = func.date_trunc("day", Sale.created_at)
    sales_rows = database.execute(select(sales_day, func.count(Sale.id)).where(Sale.created_at >= start, Sale.created_at < end).group_by(sales_day).order_by(sales_day)).all()
    credits_day = func.date_trunc("day", Credit.created_at)
    credits_rows = database.execute(select(credits_day, func.sum(Credit.original_amount)).where(Credit.created_at >= start, Credit.created_at < end).group_by(credits_day).order_by(credits_day)).all()
    method_rows = database.execute(select(FinancialMovement.payment_method, func.sum(FinancialMovement.amount)).where(FinancialMovement.movement_type == "EXPENSE", FinancialMovement.settled_at.is_not(None), expense_date >= start, expense_date < end).group_by(FinancialMovement.payment_method)).all()
    category_rows = database.execute(select(ExpenseCategory.name, func.sum(FinancialMovement.amount)).join(FinancialMovement, FinancialMovement.expense_category_id == ExpenseCategory.id).where(FinancialMovement.movement_type == "EXPENSE", FinancialMovement.settled_at.is_not(None), expense_date >= start, expense_date < end).group_by(ExpenseCategory.name).order_by(func.sum(FinancialMovement.amount).desc())).all()
    def daily_points(rows: list[tuple[object, object]]) -> list[MetricPoint]:
        values = {value.date() if hasattr(value, "date") else value: total or 0 for value, total in rows}
        days = (end.date() - start.date()).days
        return [MetricPoint(label=(start.date() + timedelta(days=index)).strftime("%d/%m"), value=values.get(start.date() + timedelta(days=index), 0)) for index in range(days)]
    total_income = sum((total or 0 for _, total in income_rows), 0)
    total_expenses = sum((total or 0 for _, total in expense_rows), 0)
    return MetricsResponse(income_by_day=daily_points(income_rows), expenses_by_day=daily_points(expense_rows), sales_by_day=daily_points(sales_rows), credits_by_day=daily_points(credits_rows), payment_methods=[MetricPoint(label=method or "Sin definir", value=total or 0) for method, total in method_rows], expense_categories=[MetricPoint(label=name, value=total or 0) for name, total in category_rows], total_income=total_income, total_expenses=total_expenses, total_sales=sum(count for _, count in sales_rows))