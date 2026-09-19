from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user, require_admin
from app.core.permissions import require_any_section, require_section
from app.core.config import settings
from app.core.media import upload_to_imagekit
from app.db.session import get_db
from app.models import Category, ComboComponent, InventoryMovement, Product, User
from app.models import SaleItem
from app.schemas.catalog import (
    CategoryCreate,
    CategoryResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)


def validate_components(
    product_id: int | None,
    is_combo: bool,
    components: list,
    database: Session,
) -> list[tuple[Product, object]]:
    if not is_combo:
        if components:
            raise HTTPException(status_code=400, detail="Un producto normal no puede tener composición")
        return []
    if not components:
        raise HTTPException(status_code=400, detail="Un combo debe tener al menos un producto componente")
    component_ids = [component.product_id for component in components]
    if len(component_ids) != len(set(component_ids)):
        raise HTTPException(status_code=400, detail="Un producto no puede repetirse en la composición")
    if product_id is not None and product_id in component_ids:
        raise HTTPException(status_code=400, detail="Un combo no puede componerse de sí mismo")
    products = {
        product.id: product
        for product in database.scalars(select(Product).where(Product.id.in_(component_ids))).all()
    }
    if len(products) != len(component_ids):
        raise HTTPException(status_code=400, detail="Todos los productos componentes deben existir")
    for component in components:
        product = products[component.product_id]
        if not product.is_active or not product.is_saleable:
            raise HTTPException(status_code=400, detail=f"El producto componente no está disponible: {product.name}")
        if product.unit in {"UNIT", "PAQUETE"} and component.quantity != component.quantity.to_integral_value():
            raise HTTPException(status_code=400, detail=f"La cantidad de {product.name} debe ser un número entero")
        if product_id is not None and product.is_combo:
            pending = [component.product_id]
            visited: set[int] = set()
            while pending:
                current_id = pending.pop()
                if current_id == product_id:
                    raise HTTPException(status_code=400, detail="La composición de combos contiene un ciclo")
                if current_id in visited:
                    continue
                visited.add(current_id)
                pending.extend(
                    database.scalars(
                        select(ComboComponent.component_product_id).where(ComboComponent.combo_product_id == current_id)
                    ).all()
                )
    return [(products[component.product_id], component.quantity) for component in components]


def replace_components(product: Product, components: list[tuple[Product, object]], database: Session) -> None:
    product.combo_components.clear()
    for component_product, quantity in components:
        product.combo_components.append(ComboComponent(component_product=component_product, quantity=quantity))
router = APIRouter(tags=["catalog"])
media_directory = Path(__file__).resolve().parents[3] / "storage"


@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(
    include_disabled: bool = False,
    database: Session = Depends(get_db),
    _: User = Depends(require_any_section("productos", "comanda")),
) -> list[Category]:
    statement = select(Category).order_by(Category.name)
    if not include_disabled:
        statement = statement.where(Category.is_active.is_(True))
    return list(database.scalars(statement))


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: CategoryCreate,
    database: Session = Depends(get_db),
    _: User = Depends(require_section("productos")),
) -> Category:
    category = Category(name=payload.name.strip(), description=payload.description)
    database.add(category)
    try:
        database.commit()
    except IntegrityError:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category name already exists") from None
    database.refresh(category)
    return category


@router.get("/products", response_model=list[ProductResponse])
def list_products(
    search: str | None = Query(default=None, max_length=150),
    include_disabled: bool = False,
    saleable_only: bool = False,
    database: Session = Depends(get_db),
    _: User = Depends(require_any_section("productos", "comanda")),
) -> list[Product]:
    statement = select(Product).order_by(Product.name)
    if search:
        statement = statement.where(Product.name.ilike(f"%{search.strip()}%"))
    if not include_disabled:
        statement = statement.where(Product.is_active.is_(True))
    if saleable_only:
        statement = statement.where(Product.is_saleable.is_(True))
    return list(database.scalars(statement))


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    database: Session = Depends(get_db),
    _: User = Depends(require_section("productos")),
) -> Product:
    category = database.get(Category, payload.category_id)
    if category is None or not category.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Active category is required")
    if payload.unit in {"UNIT", "PAQUETE"} and any(value != value.to_integral_value() for value in (payload.stock, payload.low_stock_threshold, payload.restock_quantity)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Los productos por unidad o paquete solo aceptan cantidades enteras")
    if payload.is_combo and payload.unit != "UNIT":
        raise HTTPException(status_code=400, detail="Los combos deben medirse en unidades")
    components = validate_components(None, payload.is_combo, payload.components, database)
    product = Product(**payload.model_dump(exclude={"components"}))
    replace_components(product, components, database)
    database.add(product)
    database.commit()
    database.refresh(product)
    return product


@router.patch("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    database: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Product:
    product = database.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    values = payload.model_dump(exclude_unset=True)
    if "category_id" in values:
        category = database.get(Category, values["category_id"])
        if category is None or not category.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Active category is required")
    effective_unit = values.get("unit", product.unit)
    effective_is_combo = values.get("is_combo", product.is_combo)
    if effective_is_combo and effective_unit != "UNIT":
        raise HTTPException(status_code=400, detail="Los combos deben medirse en unidades")
    if "components" in values:
        component_payload = values.pop("components") or []
    else:
        component_payload = None
    if "is_combo" in values:
        values.pop("is_combo")
    if component_payload is not None or "is_combo" in payload.model_fields_set:
        validate_components(product.id, effective_is_combo, component_payload or [], database)
    if effective_unit in {"UNIT", "PAQUETE"}:
        for field in ("stock", "low_stock_threshold", "restock_quantity"):
            value = values.get(field, getattr(product, field))
            if value != value.to_integral_value():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Los productos por unidad o paquete solo aceptan cantidades enteras")
    for field, value in values.items():
        setattr(product, field, value)
    if component_payload is not None:
        replace_components(product, validate_components(product.id, effective_is_combo, component_payload, database), database)
    elif not effective_is_combo:
        replace_components(product, [], database)
    database.commit()
    database.refresh(product)
    return product


@router.post("/products/{product_id}/restock", response_model=ProductResponse)
def restock_product(
    product_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("productos")),
) -> Product:
    product = database.scalar(select(Product).where(Product.id == product_id).with_for_update())
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    product.stock += product.restock_quantity
    database.add(InventoryMovement(
        product_id=product.id,
        user_id=current_user.id,
        movement_type="ADJUSTMENT",
        quantity=product.restock_quantity,
        stock_after=product.stock,
        observation=f"Reposición automática de {product.restock_quantity} unidades",
    ))
    database.commit()
    database.refresh(product)
    return product


@router.post("/products/{product_id}/disable", response_model=ProductResponse)
def disable_product(
    product_id: int,
    database: Session = Depends(get_db),
    _: User = Depends(require_section("productos")),
) -> Product:
    product = database.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    used_by_combo = database.scalar(select(ComboComponent.id).where(ComboComponent.component_product_id == product_id).limit(1))
    if used_by_combo:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este producto forma parte de un combo y no se puede deshabilitar")
    product.is_active = False
    database.commit()
    database.refresh(product)
    return product


@router.post("/products/{product_id}/image", response_model=ProductResponse)
async def upload_product_image(
    product_id: int,
    image: UploadFile = File(...),
    database: Session = Depends(get_db),
    _: User = Depends(require_section("productos")),
) -> Product:
    product = database.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    if image.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only PNG, JPEG or WebP images are supported")
    content = await image.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image must be 5 MB or smaller")
    extension = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}[image.content_type]

    if settings.imagekit_private_key and settings.imagekit_url_endpoint:
        filename = f"{product_id}-{uuid4().hex}{extension}"
        try:
            product.image_url = await upload_to_imagekit(content, filename, image.content_type, settings.imagekit_folder)
            database.commit()
            database.refresh(product)
            return product
        except (httpx.HTTPError, KeyError, ValueError) as error:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="No fue posible subir la imagen a ImageKit") from error

    products_directory = media_directory / "products"
    products_directory.mkdir(exist_ok=True)
    filename = f"{product_id}-{uuid4().hex}{extension}"
    file_path = products_directory / filename
    file_path.write_bytes(content)
    product.image_url = f"/media/products/{filename}"
    database.commit()
    database.refresh(product)
    return product


@router.post("/products/{product_id}/enable", response_model=ProductResponse)
def enable_product(
    product_id: int,
    database: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> Product:
    product = database.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    product.is_active = True
    database.commit()
    database.refresh(product)
    return product


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    database: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> dict[str, bool]:
    product = database.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    sale_count = database.scalar(select(SaleItem.id).where(SaleItem.product_id == product_id).limit(1))
    movement_count = database.scalar(select(InventoryMovement.id).where(InventoryMovement.product_id == product_id).limit(1))
    component_count = database.scalar(select(ComboComponent.id).where(ComboComponent.component_product_id == product_id).limit(1))
    if sale_count or movement_count or component_count:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este producto tiene historial y no se puede eliminar; puedes deshabilitarlo")
    database.delete(product)
    database.commit()
    return {"deleted": True}