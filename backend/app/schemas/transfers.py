from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class TransferCreate(BaseModel):
    amount: Decimal = Field(gt=0, decimal_places=2)
    from_method: str = Field(pattern="^(CASH|NEQUI)$")
    occurred_on: date
    description: str = Field(default="", max_length=500)


class TransferResponse(BaseModel):
    id: int
    amount: Decimal
    from_method: str
    to_method: str
    occurred_on: date
    description: str
    created_at: datetime


class TransfersResponse(BaseModel):
    transfers: list[TransferResponse]
