import base64

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import require_admin
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import AppSetting, User
from app.schemas.settings import PaymentQrResponse

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/payment-qr", response_model=PaymentQrResponse)
def get_payment_qr(database: Session = Depends(get_db), _: User = Depends(require_section("qr_pago"))) -> PaymentQrResponse:
    setting = database.get(AppSetting, "payment_qr")
    return PaymentQrResponse(image_data=setting.value if setting else None)


@router.post("/payment-qr", response_model=PaymentQrResponse)
async def save_payment_qr(
    image: UploadFile = File(...),
    database: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> PaymentQrResponse:
    if image.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se permiten imágenes PNG, JPG o WEBP")
    content = await image.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="La imagen no puede superar 5 MB")
    value = f"data:{image.content_type};base64,{base64.b64encode(content).decode('ascii')}"
    setting = database.get(AppSetting, "payment_qr")
    if setting is None:
        setting = AppSetting(key="payment_qr", value=value)
        database.add(setting)
    else:
        setting.value = value
    database.commit()
    return PaymentQrResponse(image_data=value)


@router.delete("/payment-qr", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_qr(database: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    setting = database.get(AppSetting, "payment_qr")
    if setting is not None:
        database.delete(setting)
        database.commit()