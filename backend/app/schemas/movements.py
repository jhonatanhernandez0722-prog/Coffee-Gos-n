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


class MovementsResponse(BaseModel):
    movements: list[MovementRow]