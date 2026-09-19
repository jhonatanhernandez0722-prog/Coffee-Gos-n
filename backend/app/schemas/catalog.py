from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class CategoryResponse(CategoryCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool


class ComboComponentCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, decimal_places=3)


class ComboComponentResponse(ComboComponentCreate):
    model_config = ConfigDict(from_attributes=True)

    product_name: str = ""

    @model_validator(mode="before")
    @classmethod
    def read_product_name(cls, value: object) -> object:
        if hasattr(value, "component_product"):
            return {
                "product_id": value.component_product_id,
                "quantity": value.quantity,
                "product_name": value.component_product.name if value.component_product else "",
            }
        return value


class ProductCreate(BaseModel):
    category_id: int = Field(gt=0)
    name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=1000)
    image_url: str | None = Field(default=None, max_length=500)
    unit: Literal["KG", "ML", "UNIT", "PAQUETE"] = "UNIT"
    is_combo: bool = False
    components: list[ComboComponentCreate] = Field(default_factory=list)
    content_quantity: Decimal | None = Field(default=None, gt=0, decimal_places=3)
    content_unit: Literal["G", "KG", "ML", "L", "UNIT"] | None = None
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
    unit: Literal["KG", "ML", "UNIT", "PAQUETE"] | None = None
    is_combo: bool | None = None
    components: list[ComboComponentCreate] | None = None
    content_quantity: Decimal | None = Field(default=None, gt=0, decimal_places=3)
    content_unit: Literal["G", "KG", "ML", "L", "UNIT"] | None = None
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
    components: list[ComboComponentResponse] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def read_components(cls, value: object) -> object:
        if hasattr(value, "combo_components"):
            return {
                **{field: getattr(value, field) for field in ProductCreate.model_fields if field != "components"},
                "id": value.id,
                "is_active": value.is_active,
                "components": value.combo_components,
            }
        return value


class AseoAccessRequest(BaseModel):
    pin: str = Field(min_length=4, max_length=20)