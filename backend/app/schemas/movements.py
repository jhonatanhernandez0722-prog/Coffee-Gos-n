from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class MovementRow(BaseModel):
    id: int
    domain: str
    related_id: int | None
    movement_type: str
    amount: Decimal | None
    quantity: Decimal | None
    concept: str
    product_name: str | None
    created_at: datetime
    customer_name: str | None = None
    seller_name: str | None = None
    cashier_name: str | None = None
    sale_number: str | None = None
    payment_method: str | None = None
    support_urls: list[str] = []


class MovementsResponse(BaseModel):
    movements: list[MovementRow]