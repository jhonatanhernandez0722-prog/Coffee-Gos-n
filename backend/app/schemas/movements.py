from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class MovementRow(BaseModel):
    id: int
    domain: str
    related_id: int | None
    product_id: int | None = None
    movement_type: str
    amount: Decimal | None = None
    unit_cost: Decimal | None = None
    quantity: Decimal | None = None
    concept: str
    product_name: str | None = None
    seller_name: str | None = None
    customer_name: str | None = None
    created_at: datetime


class MovementsResponse(BaseModel):
    movements: list[MovementRow]


class InventoryMovementUpdate(BaseModel):
    product_id: int | None = Field(default=None, gt=0)
    quantity: Decimal | None = Field(default=None, ge=0)
    unit_cost: Decimal | None = Field(default=None, ge=0)
    observation: str | None = Field(default=None, max_length=500)
    assigned_seller_id: int | None = Field(default=None, gt=0)


class FinancialMovementUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, ge=0)
    concept: str | None = Field(default=None, max_length=180)
    payment_method: str | None = Field(default=None, max_length=20)
