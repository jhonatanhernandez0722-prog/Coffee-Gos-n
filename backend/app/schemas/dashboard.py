from decimal import Decimal

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    date: str
    income_today: Decimal
    expenses_today: Decimal
    cost_today: Decimal
    profit_today: Decimal
    sales_today: int
    products_sold_today: Decimal
    pending_credits: Decimal
    low_stock_products: int