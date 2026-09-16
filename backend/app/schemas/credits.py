from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class CreditRow(BaseModel):
    id: int
    sale_id: int
    sale_number: str
    customer_name: str
    seller_name: str | None
    cashier_name: str | None
    original_amount: Decimal
    pending_amount: Decimal
    status: str
    created_at: datetime
    support_urls: list[str] = []
    products: list["CreditProduct"] = []

class CreditProduct(BaseModel):
    name: str
    quantity: Decimal

class CreditsResponse(BaseModel):
    credits: list[CreditRow]