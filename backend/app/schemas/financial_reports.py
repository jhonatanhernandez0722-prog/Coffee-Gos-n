from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class CashReconciliation(BaseModel):
    date: date
    cash: Decimal
    bank: Decimal
    receivables: Decimal
    total: Decimal


class OpeningBalanceResponse(BaseModel):
    cash: Decimal
    nequi: Decimal


class OpeningBalanceCorrectionCreate(BaseModel):
    cash: Decimal = Field(ge=0, decimal_places=2)
    nequi: Decimal = Field(ge=0, decimal_places=2)
    reason: str = Field(min_length=5, max_length=500)


class OpeningBalanceCorrectionResponse(OpeningBalanceResponse):
    reason: str
    corrected_at: datetime


class LiabilityCreate(BaseModel):
    kind: str = Field(pattern="^(SUPPLIER|SERVICE|CHURCH_CONTRIBUTION)$")
    description: str = Field(min_length=2, max_length=240)
    amount: Decimal = Field(gt=0, decimal_places=2)
    due_date: date | None = None


class LiabilityResponse(BaseModel):
    id: int
    kind: str
    description: str
    amount: Decimal
    due_date: date | None
    status: str
    created_at: datetime
    paid_at: datetime | None


class BalanceReport(BaseModel):
    cash: Decimal
    bank: Decimal
    receivables: Decimal
    inventory: Decimal
    total_assets: Decimal
    liabilities: list[LiabilityResponse]
    total_liabilities: Decimal
    equity: Decimal
    income: Decimal
    costs: Decimal
    expenses: Decimal
    profit: Decimal