from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class PurchaseCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    unit_cost: Decimal = Field(gt=0)
    payment_method: Literal["CASH", "NEQUI"] = "CASH"
    observation: str | None = Field(default=None, max_length=500)


class InternalUseCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    assigned_seller_id: int | None = Field(default=None, gt=0)
    observation: str | None = Field(default=None, max_length=500)


class InventorySummary(BaseModel):
    product_count: int
    total_units: Decimal
    stock_value: Decimal
    consumed_units: Decimal
    consumed_value: Decimal