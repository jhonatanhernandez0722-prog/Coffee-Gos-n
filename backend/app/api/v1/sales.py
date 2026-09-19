from datetime import datetime, timezone
from decimal import Decimal
import os
from uuid import uuid4

from pathlib import Path
import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_section
from app.core.media import upload_to_imagekit
from app.core.config import settings
from app.db.session import get_db
from app.models import (
    ComboComponent,
    Credit,
    Customer,
    FinancialMovement,
    InventoryMovement,
    Product,
    Sale,
    SaleItem,
    SaleSupport,
    User,
)
from app.schemas.sales import SaleCreate, SaleItemResponse, SaleResponse

router = APIRouter(prefix="/sales", tags=["sales"])
media_directory = Path("/tmp/coffee-gosen-media") if settings.environment == "production" or os.getenv("VERCEL") else Path(__file__).resolve().parents[3] / "storage"


def expand_product_requirements(
    product_id: int,
    multiplier: Decimal,
    database: Session,
    requirements: dict[int, Decimal],
    visiting: set[int],
    source_combo_id: int | None = None,
    sources: dict[int, int] | None = None,
) -> None:
    if product_id in visiting:
        raise HTTPException(status_code=400, detail="La composición de combos contiene un ciclo")
    requirements[product_id] = requirements.get(product_id, Decimal("0")) + multiplier
    if source_combo_id is not None and product_id != source_combo_id and sources is not None:
        sources.setdefault(product_id, source_combo_id)
    product = database.get(Product, product_id)
    if product is None or not product.is_combo:
        return
    visiting.add(product_id)
    source_combo_id = source_combo_id or product_id
    components = database.scalars(select(ComboComponent).where(ComboComponent.combo_product_id == product_id)).all()
    if not components:
        raise HTTPException(status_code=400, detail=f"El combo {product.name} no tiene productos componentes")
    for component in components:
        expand_product_requirements(component.component_product_id, multiplier * component.quantity, database, requirements, visiting, source_combo_id, sources)
    visiting.remove(product_id)


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    payload: SaleCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("comanda")),
) -> SaleResponse:
    if not payload.customer_id and not payload.buyer_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes indicar el nombre del cliente")
    if not payload.assigned_seller_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Debes asignar un vendedor")

    product_ids = [item.product_id for item in payload.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Each product can appear only once")

    try:
        requirements: dict[int, Decimal] = {}
        component_sources: dict[int, int] = {}
        for item in payload.items:
            expand_product_requirements(item.product_id, Decimal(item.quantity), database, requirements, set(), None, component_sources)

        locked_products = {
            product.id: product
            for product in database.scalars(
                select(Product).where(Product.id.in_(requirements)).order_by(Product.id).with_for_update()
            ).all()
        }
        for item in payload.items:
            product = locked_products.get(item.product_id)
            if product is None or not product.is_active or not product.is_saleable:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product is not available")
        for product_id, quantity in requirements.items():
            product = locked_products.get(product_id)
            if product is None or not product.is_active or not product.is_saleable:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Un componente del combo no está disponible")
            if product.stock < quantity:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"No hay suficiente stock para {product.name}: se requieren {quantity} y hay {product.stock}")

        customer = None
        if payload.customer_id:
            customer = database.get(Customer, payload.customer_id)
            if customer is None or not customer.is_active:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer is not available")
        elif payload.buyer_name:
            customer = database.scalar(select(Customer).where(Customer.name == payload.buyer_name.strip(), Customer.is_active.is_(True)))
            if customer is None:
                customer = Customer(name=payload.buyer_name.strip(), is_active=True)
                database.add(customer)
                database.flush()

        assigned_seller = database.scalar(select(User).where(User.id == payload.assigned_seller_id, User.role == "SELLER", User.is_active.is_(True)))
        if assigned_seller is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El vendedor seleccionado no está disponible")

        subtotal = sum((locked_products[item.product_id].sale_price * item.quantity for item in payload.items), Decimal("0"))
        sale = Sale(
            sale_number=f"V-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}",
            customer_id=customer.id if customer else None,
            user_id=current_user.id,
            assigned_seller_id=assigned_seller.id if assigned_seller else None,
            payment_method=payload.payment_method,
            subtotal=subtotal,
            total=subtotal,
        )
        database.add(sale)
        database.flush()
        for item in payload.items:
            product = locked_products[item.product_id]
            database.add(SaleItem(sale_id=sale.id, product_id=product.id, quantity=item.quantity, unit_price=product.sale_price, unit_cost_snapshot=product.acquisition_cost))
        for product_id, quantity in requirements.items():
            product = locked_products[product_id]
            product.stock -= quantity
            source_combo_id = component_sources.get(product_id)
            database.add(InventoryMovement(product_id=product.id, user_id=current_user.id, movement_type="SALE", quantity=quantity, stock_after=product.stock, sale_id=sale.id, source_combo_product_id=source_combo_id, observation=f"Componente de combo {locked_products[source_combo_id].name}" if source_combo_id else None))
        credit_created = payload.payment_method == "CREDIT"
        if not credit_created:
            database.add(FinancialMovement(user_id=current_user.id, movement_type="INCOME", amount=subtotal, concept=f"Venta {sale.sale_number}", sale_id=sale.id, payment_method=payload.payment_method))
        if credit_created:
            database.add(Credit(sale_id=sale.id, customer_id=customer.id, original_amount=subtotal, pending_amount=subtotal, status="PENDING"))
        database.commit()
        return SaleResponse(
            id=sale.id,
            sale_number=sale.sale_number,
            total=sale.total,
            payment_method=sale.payment_method,
            credit_created=credit_created,
            customer_name=customer.name if customer else None,
            created_at=sale.created_at.isoformat() if sale.created_at else datetime.now(timezone.utc).isoformat(),
            items=[SaleItemResponse(name=locked_products[item.product_id].name, quantity=item.quantity, unit_price=locked_products[item.product_id].sale_price, line_total=locked_products[item.product_id].sale_price * item.quantity) for item in payload.items],
            support_urls=[],
        )
    except HTTPException:
        database.rollback()
        raise
    except Exception:
        database.rollback()
        raise


@router.post("/{sale_id}/supports")
async def upload_sale_supports(
    sale_id: int,
    files: list[UploadFile] = File(...),
    database: Session = Depends(get_db),
    _: User = Depends(require_section("comanda")),
) -> dict[str, list[str]]:
    return {"support_urls": await save_sale_supports(sale_id, files, database)}


async def save_sale_supports(sale_id: int, files: list[UploadFile], database: Session) -> list[str]:
    sale = database.get(Sale, sale_id)
    if sale is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sale not found")
    if len(files) > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Puedes adjuntar máximo 5 imágenes")
    urls: list[str] = []
    for file in files:
        if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Los soportes deben ser PNG, JPEG o WebP")
        content = await file.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Cada soporte debe pesar máximo 5 MB")
        extension = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}[file.content_type]
        filename = f"{uuid4().hex}{extension}"
        try:
            url = await upload_to_imagekit(content, filename, file.content_type, f"{settings.imagekit_folder}/sales/{sale_id}")
        except (httpx.HTTPError, KeyError, ValueError) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="No fue posible subir el soporte a ImageKit") from error
        if url is None:
            supports_directory = media_directory / "sales" / str(sale_id)
            supports_directory.mkdir(parents=True, exist_ok=True)
            (supports_directory / filename).write_bytes(content)
            url = f"/media/sales/{sale_id}/{filename}"
        database.add(SaleSupport(sale_id=sale_id, file_url=url, file_name=file.filename or filename))
        urls.append(url)
    database.commit()
    return urls


@router.post("/with-supports", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale_with_supports(
    payload: str = Form(...),
    files: list[UploadFile] = File(default=[]),
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("comanda")),
) -> SaleResponse:
    try:
        sale_payload = SaleCreate.model_validate_json(payload)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Los datos de la venta no son válidos") from error
    if files and sale_payload.payment_method != "NEQUI":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Los soportes solo aplican para pagos con Nequi")
    sale_response = create_sale(sale_payload, database, current_user)
    if files:
        sale_response.support_urls = await save_sale_supports(sale_response.id, files, database)
    return sale_response