from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import ExpenseCategory, FinancialMovement, InventoryMovement, Product, User
from app.schemas.inventory import DamageCreate, InternalUseCreate, InventorySummary, PurchaseCreate

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.post("/purchase")
def register_purchase(
    payload: PurchaseCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("productos")),
) -> dict:
    product = database.scalar(select(Product).where(Product.id == payload.product_id).with_for_update())
    if product is None or not product.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden comprar productos activos")
    if payload.unit_cost <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El costo unitario debe ser mayor a cero")

    product.stock += payload.quantity
    product.acquisition_cost = payload.unit_cost

    expense_category = database.scalar(select(ExpenseCategory).where(ExpenseCategory.name.ilike("Aseo")).limit(1))
    if expense_category is None:
        expense_category = ExpenseCategory(name="Aseo")
        database.add(expense_category)
        database.flush()

    movement = InventoryMovement(
        product_id=product.id,
        user_id=current_user.id,
        movement_type="PURCHASE",
        quantity=payload.quantity,
        stock_after=product.stock,
        observation=payload.observation or "Compra de inventario",
    )
    database.add(movement)

    expense_amount = payload.quantity * payload.unit_cost
    financial_movement = FinancialMovement(
        user_id=current_user.id,
        movement_type="EXPENSE",
        amount=expense_amount,
        concept=f"Compra de {product.name}",
        payment_method=payload.payment_method,
        expense_category_id=expense_category.id,
        observation=payload.observation or f"Compra de {product.name}",
    )
    database.add(financial_movement)

    database.commit()
    database.refresh(product)
    return {
        "movement_id": movement.id,
        "product_id": product.id,
        "stock_after": int(product.stock),
        "movement_type": "PURCHASE",
        "expense_amount": float(expense_amount),
    }


@router.post("/internal-use")
def register_internal_use(
    payload: InternalUseCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("productos")),
) -> dict:
    product = database.scalar(select(Product).where(Product.id == payload.product_id).with_for_update())
    if product is None or not product.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only active products can be taken internally")
    if product.stock < payload.quantity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient stock for {product.name}")
    seller = database.scalar(select(User).where(User.id == payload.assigned_seller_id, User.role == "SELLER", User.is_active.is_(True)))
    if seller is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La vendedora seleccionada no está disponible")
    product.stock -= payload.quantity
    movement = InventoryMovement(product_id=product.id, user_id=current_user.id, assigned_seller_id=seller.id, movement_type="INTERNAL_USE", quantity=payload.quantity, stock_after=product.stock, observation=payload.observation)
    database.add(movement)
    database.commit()
    return {"movement_id": movement.id, "product_id": product.id, "stock_after": int(product.stock), "movement_type": "INTERNAL_USE"}


@router.post("/damage")
def register_damage(
    payload: DamageCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("productos")),
) -> dict:
    product = database.scalar(select(Product).where(Product.id == payload.product_id).with_for_update())
    if product is None or not product.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden reportar daños de productos activos")
    if product.stock < payload.quantity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Stock insuficiente para {product.name}")

    category = database.scalar(select(ExpenseCategory).where(ExpenseCategory.name.ilike("Daño de inventario")).limit(1))
    if category is None:
        category = ExpenseCategory(name="Daño de inventario")
        database.add(category)
        database.flush()

    product.stock -= payload.quantity
    loss_amount = product.acquisition_cost * payload.quantity
    movement = InventoryMovement(
        product_id=product.id,
        user_id=current_user.id,
        movement_type="DAMAGE",
        quantity=payload.quantity,
        stock_after=product.stock,
        observation=payload.observation.strip(),
    )
    database.add(movement)
    database.add(FinancialMovement(
        user_id=current_user.id,
        movement_type="EXPENSE",
        amount=loss_amount,
        concept=f"Daño de {product.name}",
        payment_method="CASH",
        product=product.name,
        expense_category_id=category.id,
        observation=payload.observation.strip(),
        settled_at=datetime.now(timezone.utc),
    ))
    database.commit()
    database.refresh(product)
    return {
        "movement_id": movement.id,
        "product_id": product.id,
        "stock_after": int(product.stock),
        "movement_type": "DAMAGE",
        "expense_amount": float(loss_amount),
    }


@router.get("/aseo-summary", response_model=InventorySummary)
def aseo_summary(
    database: Session = Depends(get_db),
    _: User = Depends(require_section("productos")),
) -> InventorySummary:
    products = database.scalars(select(Product).where(Product.is_saleable.is_(False), Product.is_active.is_(True))).all()
    consumed_units = database.scalar(select(func.coalesce(func.sum(InventoryMovement.quantity), 0)).join(Product, Product.id == InventoryMovement.product_id).where(InventoryMovement.movement_type == "INTERNAL_USE", Product.is_saleable.is_(False))) or Decimal("0")
    consumed_value = database.scalar(select(func.coalesce(func.sum(InventoryMovement.quantity * Product.acquisition_cost), 0)).join(Product, Product.id == InventoryMovement.product_id).where(InventoryMovement.movement_type == "INTERNAL_USE", Product.is_saleable.is_(False))) or Decimal("0")
    return InventorySummary(product_count=len(products), total_units=sum((product.stock for product in products), Decimal("0")), stock_value=sum((product.stock * product.acquisition_cost for product in products), Decimal("0")), consumed_units=consumed_units, consumed_value=consumed_value)