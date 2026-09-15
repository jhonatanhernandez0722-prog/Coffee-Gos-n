from decimal import Decimal

from pydantic import BaseModel, Field


class InternalUseCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)
    observation: str | None = Field(default=None, max_length=500)


class InventorySummary(BaseModel):
    product_count: int
    total_units: Decimal
    stock_value: Decimal
    consumed_units: Decimal
    consumed_value: Decimal