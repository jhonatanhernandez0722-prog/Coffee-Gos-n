from decimal import Decimal

from pydantic import BaseModel


class MetricPoint(BaseModel):
    label: str
    value: Decimal


class MetricsResponse(BaseModel):
    income_by_day: list[MetricPoint]
    expenses_by_day: list[MetricPoint]
    sales_by_day: list[MetricPoint]
    credits_by_day: list[MetricPoint]
    payment_methods: list[MetricPoint]
    expense_categories: list[MetricPoint]
    total_income: Decimal
    total_expenses: Decimal
    total_sales: int