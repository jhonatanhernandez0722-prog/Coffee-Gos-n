from decimal import Decimal

from pydantic import BaseModel, Field


class SaleItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0)


class SaleCreate(BaseModel):
    customer_id: int | None = Field(default=None, gt=0)
    buyer_name: str | None = Field(default=None, max_length=150)
    assigned_seller_id: int | None = Field(default=None, gt=0)
    payment_method: str = Field(pattern="^(CASH|NEQUI|CREDIT)$")
    items: list[SaleItemCreate] = Field(min_length=1)


class SaleItemResponse(BaseModel):
    name: str
    quantity: Decimal
    unit_price: Decimal
    line_total: Decimal


class SaleResponse(BaseModel):
    id: int
    sale_number: str
    total: Decimal
    payment_method: str
    credit_created: bool
    customer_name: str | None
    created_at: str
    items: list[SaleItemResponse]