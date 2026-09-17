from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class CategoryResponse(CategoryCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class ProductCreate(BaseModel):
    category_id: int = Field(gt=0)
    name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    image_url: str | None = Field(default=None, max_length=500)
    unit: Literal["KG", "ML", "UNIT"] = "UNIT"
    content_quantity: Decimal | None = Field(default=None, gt=0, decimal_places=3)
    content_unit: Literal["G", "KG", "ML", "L"] | None = None
    is_saleable: bool = True
    sale_price: Decimal = Field(ge=0, decimal_places=2)
    acquisition_cost: Decimal = Field(ge=0, decimal_places=2)
    stock: Decimal = Field(ge=0, decimal_places=3)
    low_stock_threshold: Decimal = Field(default=5, ge=0, decimal_places=3)
    restock_quantity: Decimal = Field(default=10, gt=0, decimal_places=3)


class ProductUpdate(BaseModel):
    category_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    image_url: str | None = Field(default=None, max_length=500)
    unit: Literal["KG", "ML", "UNIT"] | None = None
    content_quantity: Decimal | None = Field(default=None, gt=0, decimal_places=3)
    content_unit: Literal["G", "KG", "ML", "L"] | None = None
    is_saleable: bool | None = None
    sale_price: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    acquisition_cost: Decimal | None = Field(default=None, ge=0, decimal_places=2)
    stock: Decimal | None = Field(default=None, ge=0, decimal_places=3)
    low_stock_threshold: Decimal | None = Field(default=None, ge=0, decimal_places=3)
    restock_quantity: Decimal | None = Field(default=None, gt=0, decimal_places=3)


class ProductResponse(ProductCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class AseoAccessRequest(BaseModel):
    pin: str = Field(min_length=4, max_length=20)