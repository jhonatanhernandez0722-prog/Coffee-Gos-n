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
    observation: str = Field(min_length=2, max_length=500)


class ExpenseResponse(BaseModel):
    id: int
    amount: Decimal
    payment_method: str
    category_name: str
    observation: str
    created_at: datetime


class ExpensesResponse(BaseModel):
    expenses: list[ExpenseResponse]