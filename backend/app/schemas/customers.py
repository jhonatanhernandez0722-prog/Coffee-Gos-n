from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class CustomerSuggestion(BaseModel):
    id: int
    name: str


class CustomerSummary(BaseModel):
    id: int
    name: str
    phone: str | None
    purchase_count: int
    total_spent: Decimal
    pending_credit: Decimal
    last_purchase_at: datetime | None


class CustomersDashboard(BaseModel):
    total_customers: int
    total_purchases: int
    total_spent: Decimal
    pending_credits: Decimal
    purchases_today: int
    customers: list[CustomerSummary]