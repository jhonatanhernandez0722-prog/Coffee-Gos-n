from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class IncomeCreate(BaseModel):
    person_name: str = Field(min_length=2, max_length=120)
    amount: Decimal = Field(gt=0, decimal_places=2)
    income_type: str = Field(pattern="^(DONATION|OLD_INCOME|CONTRIBUTION|OTHER)$")
    payment_method: str = Field(pattern="^(CASH|NEQUI)$")
    occurred_on: date
    description: str = Field(default="", max_length=500)


class IncomeResponse(BaseModel):
    id: int
    amount: Decimal
    person_name: str | None
    income_type: str
    payment_method: str
    occurred_on: date
    description: str
    created_at: datetime


class IncomesResponse(BaseModel):
    incomes: list[IncomeResponse]
    total: Decimal