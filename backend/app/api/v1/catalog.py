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
from app.models import Category, InventoryMovement, Product, User
from app.models import SaleItem
from app.schemas.catalog import (
    CategoryCreate,
    CategoryResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)
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
    product = Product(**payload.model_dump())
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
    for field, value in values.items():
        setattr(product, field, value)
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
    if sale_count or movement_count:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este producto tiene historial y no se puede eliminar; puedes deshabilitarlo")
    database.delete(product)
    database.commit()
    return {"deleted": True}