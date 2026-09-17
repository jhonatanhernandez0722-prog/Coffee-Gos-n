from pydantic import BaseModel


class PaymentQrResponse(BaseModel):
    image_data: str | None = None