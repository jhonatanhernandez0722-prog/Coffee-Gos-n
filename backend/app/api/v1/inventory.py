from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user, require_admin
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import InventoryMovement, Product, User
from app.schemas.inventory import InternalUseCreate, InventorySummary

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.post("/internal-use")
def register_internal_use(
    payload: InternalUseCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> dict:
    product = database.scalar(select(Product).where(Product.id == payload.product_id).with_for_update())
    if product is None or not product.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only active products can be taken internally")
    if product.stock < payload.quantity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient stock for {product.name}")
    product.stock -= payload.quantity
    movement = InventoryMovement(product_id=product.id, user_id=current_user.id, movement_type="INTERNAL_USE", quantity=payload.quantity, stock_after=product.stock, observation=payload.observation)
    database.add(movement)
    database.commit()
    return {"movement_id": movement.id, "product_id": product.id, "stock_after": int(product.stock), "movement_type": "INTERNAL_USE"}


@router.get("/aseo-summary", response_model=InventorySummary)
def aseo_summary(
    database: Session = Depends(get_db),
    _: User = Depends(require_section("productos")),
) -> InventorySummary:
    products = database.scalars(select(Product).where(Product.is_saleable.is_(False), Product.is_active.is_(True))).all()
    consumed_units = database.scalar(select(func.coalesce(func.sum(InventoryMovement.quantity), 0)).join(Product, Product.id == InventoryMovement.product_id).where(InventoryMovement.movement_type == "INTERNAL_USE", Product.is_saleable.is_(False))) or Decimal("0")
    consumed_value = database.scalar(select(func.coalesce(func.sum(InventoryMovement.quantity * Product.acquisition_cost), 0)).join(Product, Product.id == InventoryMovement.product_id).where(InventoryMovement.movement_type == "INTERNAL_USE", Product.is_saleable.is_(False))) or Decimal("0")
    return InventorySummary(product_count=len(products), total_units=sum((product.stock for product in products), Decimal("0")), stock_value=sum((product.stock * product.acquisition_cost for product in products), Decimal("0")), consumed_units=consumed_units, consumed_value=consumed_value)