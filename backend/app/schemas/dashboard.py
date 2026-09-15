from decimal import Decimal

from pydantic import BaseModel


class MonthlyProductRow(BaseModel):
    product_name: str
    units_sold: Decimal
    sales_total: Decimal
    cost_total: Decimal
    profit_total: Decimal
    unit_price: Decimal


class DashboardSummary(BaseModel):
    date: str
    balance_total: Decimal
    pending_credit_count: int
    cash_balance: Decimal
    nequi_balance: Decimal
    income_today: Decimal
    expenses_today: Decimal
    cost_today: Decimal
    profit_today: Decimal
    sales_today: int
    products_sold_today: Decimal
    pending_credits: Decimal
    low_stock_products: int
    products: list[MonthlyProductRow]


class MonthlyReport(BaseModel):
    month: str
    balance_total: Decimal
    days: list[str]
    income_by_day: list[Decimal]
    expenses_by_day: list[Decimal]
    sales_by_day: list[int]
    total_income: Decimal
    total_expenses: Decimal
    total_sales: int
    products: list[MonthlyProductRow]