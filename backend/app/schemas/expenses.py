from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class ExpenseCategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)


class ExpenseCategoryResponse(ExpenseCategoryCreate):
    id: int
    is_active: bool


class ExpenseCreate(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)
    payment_method: str = Field(pattern="^(CASH|NEQUI)$")
    category_id: int = Field(gt=0)
    product: str | None = Field(default=None, max_length=180)
    observation: str = Field(min_length=2, max_length=500)
    settle_immediately: bool = False
    authorization_pin: str | None = Field(default=None, min_length=4, max_length=20)


class ExpenseResponse(BaseModel):
    id: int
    amount: Decimal
    product: str | None
    payment_method: str
    category_name: str
    observation: str
    created_at: datetime
    settled_at: datetime | None


class ExpensesResponse(BaseModel):
    expenses: list[ExpenseResponse]


class SettleExpensesResponse(BaseModel):
    count: int
    amount: Decimal
    settled_at: datetime