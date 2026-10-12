from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class PurchaseCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, decimal_places=3)
    unit_cost: Decimal = Field(gt=0)
    payment_method: Literal["CASH", "NEQUI"] = "CASH"
    observation: str | None = Field(default=None, max_length=500)


class InternalUseCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, decimal_places=3)
    assigned_seller_id: int | None = Field(default=None, gt=0)
    observation: str | None = Field(default=None, max_length=500)


class DamageCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, decimal_places=3)
    unit_cost: Decimal | None = Field(default=None, gt=0)
    observation: str = Field(min_length=2, max_length=500)


class InventorySummary(BaseModel):
    product_count: int
    total_units: Decimal
    stock_value: Decimal
    consumed_units: Decimal
    consumed_value: Decimal

class DisappearanceCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, decimal_places=3)
    observation: str | None = Field(default=None, max_length=500)


class DisappearanceSale(BaseModel):
    buyer_name: str = Field(min_length=1, max_length=150)
    assigned_seller_id: int = Field(gt=0)
    payment_method: Literal["CASH", "NEQUI", "CREDIT"]
    amount_received: Decimal | None = Field(default=None, ge=0, decimal_places=2)


class DisappearanceResolve(BaseModel):
    resolution: Literal["FOUND", "SALE", "INTERNAL_USE", "DAMAGE"]
    observation: str | None = Field(default=None, max_length=500)
    unit_cost: Decimal | None = Field(default=None, gt=0)
    sale: DisappearanceSale | None = None


class DisappearanceRow(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_unit: str
    is_saleable: bool
    sale_price: Decimal
    acquisition_cost: Decimal
    quantity: Decimal
    observation: str | None
    reported_by: str | None
    status: str
    resolution: str | None
    resolved_by: str | None
    resolved_at: datetime | None
    created_at: datetime
    days_missing: int
