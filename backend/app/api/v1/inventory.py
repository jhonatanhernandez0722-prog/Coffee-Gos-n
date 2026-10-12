from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.api.v1.dependencies import get_current_user
from app.api.v1.sales import create_sale
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import ExpenseCategory, FinancialMovement, InventoryMovement, Product, ProductDisappearance, User
from app.schemas.inventory import (
    DamageCreate,
    DisappearanceCreate,
    DisappearanceResolve,
    DisappearanceRow,
    InternalUseCreate,
    InventorySummary,
    PurchaseCreate,
)
from app.schemas.catalog import ProductResponse
from app.schemas.sales import SaleCreate, SaleItemCreate

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
    if product.unit in {"UNIT", "PAQUETE"} and payload.quantity != payload.quantity.to_integral_value():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser un número entero para productos por unidad o paquete")
    if payload.unit_cost <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El costo unitario debe ser mayor a cero")

    product.stock += payload.quantity
    product.acquisition_cost = payload.unit_cost

    product_category_name = product.category.name.strip().lower()
    if "desech" in product_category_name:
        expense_category_name = "Desechables"
    elif "limpieza" in product_category_name:
        expense_category_name = "Limpieza"
    elif "insumo" in product_category_name or "aseo" in product_category_name:
        expense_category_name = "Insumos"
    else:
        expense_category_name = product.category.name.strip()
    expense_category = database.scalar(
        select(ExpenseCategory)
        .where(ExpenseCategory.name.ilike(expense_category_name))
        .limit(1)
    )
    if expense_category is None:
        expense_category = ExpenseCategory(name=expense_category_name)
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
        product=product.name,
        observation=payload.observation or f"Compra de {product.name}",
    )
    database.add(financial_movement)
    database.flush()
    movement.financial_movement_id = financial_movement.id

    database.commit()
    database.refresh(product)
    return {
        "movement_id": movement.id,
        "product_id": product.id,
        "stock_after": float(product.stock),
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
    if product.unit in {"UNIT", "PAQUETE"} and payload.quantity != payload.quantity.to_integral_value():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser un número entero para productos por unidad o paquete")
    if product.stock < payload.quantity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient stock for {product.name}")
    product.stock -= payload.quantity
    movement = InventoryMovement(product_id=product.id, user_id=current_user.id, assigned_seller_id=payload.assigned_seller_id, movement_type="INTERNAL_USE", quantity=payload.quantity, stock_after=product.stock, observation=payload.observation)
    database.add(movement)
    database.commit()
    return {"movement_id": movement.id, "product_id": product.id, "stock_after": float(product.stock), "movement_type": "INTERNAL_USE"}


@router.post("/damage")
def register_damage(
    payload: DamageCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("productos")),
) -> dict:
    product = database.scalar(select(Product).where(Product.id == payload.product_id).with_for_update())
    if product is None or not product.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden reportar daños de productos activos")
    if product.unit in {"UNIT", "PAQUETE"} and payload.quantity != payload.quantity.to_integral_value():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser un número entero para productos por unidad o paquete")
    if product.stock < payload.quantity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Stock insuficiente para {product.name}")

    unit_cost = payload.unit_cost or product.acquisition_cost
    if unit_cost <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{product.name} no tiene costo de adquisición. Indica el costo unitario de la pérdida.")
    if product.acquisition_cost <= 0:
        product.acquisition_cost = unit_cost

    product.stock -= payload.quantity
    loss_amount = unit_cost * payload.quantity
    movement = InventoryMovement(
        product_id=product.id,
        user_id=current_user.id,
        movement_type="DAMAGE",
        quantity=payload.quantity,
        stock_after=product.stock,
        observation=payload.observation.strip(),
    )
    # Un daño no mueve dinero: se registra como costo (no gasto ni salida de caja).
    cost_movement = FinancialMovement(
        user_id=current_user.id,
        movement_type="COST",
        amount=loss_amount,
        concept=f"Daño de {product.name}",
        product=product.name,
        observation=payload.observation.strip(),
    )
    database.add(cost_movement)
    database.flush()
    movement.financial_movement_id = cost_movement.id
    database.add(movement)
    database.commit()
    database.refresh(product)
    return {
        "movement_id": movement.id,
        "product_id": product.id,
        "stock_after": float(product.stock),
        "movement_type": "DAMAGE",
        "cost_amount": float(loss_amount),
    }


@router.get("/started", response_model=list[ProductResponse])
def started_products(
    database: Session = Depends(get_db),
    _: User = Depends(require_section("productos")),
) -> list[Product]:
    return list(database.scalars(
        select(Product)
        .where(
            Product.is_saleable.is_(False),
            Product.is_active.is_(True),
            Product.stock > 0,
            select(InventoryMovement.id)
            .where(
                InventoryMovement.product_id == Product.id,
                InventoryMovement.movement_type == "INTERNAL_USE",
            )
            .exists(),
        )
        .order_by(Product.name)
    ))


@router.get("/aseo-summary", response_model=InventorySummary)
def aseo_summary(
    database: Session = Depends(get_db),
    _: User = Depends(require_section("productos")),
) -> InventorySummary:
    products = database.scalars(select(Product).where(Product.is_saleable.is_(False), Product.is_active.is_(True))).all()
    consumed_units = database.scalar(select(func.coalesce(func.sum(InventoryMovement.quantity), 0)).join(Product, Product.id == InventoryMovement.product_id).where(InventoryMovement.movement_type == "INTERNAL_USE", Product.is_saleable.is_(False))) or Decimal("0")
    consumed_value = database.scalar(select(func.coalesce(func.sum(InventoryMovement.quantity * Product.acquisition_cost), 0)).join(Product, Product.id == InventoryMovement.product_id).where(InventoryMovement.movement_type == "INTERNAL_USE", Product.is_saleable.is_(False))) or Decimal("0")
    return InventorySummary(product_count=len(products), total_units=sum((product.stock for product in products), Decimal("0")), stock_value=sum((product.stock * product.acquisition_cost for product in products), Decimal("0")), consumed_units=consumed_units, consumed_value=consumed_value)


def disappearance_rows(database: Session, status_filter: str | None) -> list[DisappearanceRow]:
    reporter = aliased(User)
    resolver = aliased(User)
    statement = (
        select(ProductDisappearance, Product, reporter.full_name, resolver.full_name)
        .join(Product, Product.id == ProductDisappearance.product_id)
        .outerjoin(reporter, reporter.id == ProductDisappearance.user_id)
        .outerjoin(resolver, resolver.id == ProductDisappearance.resolved_by_id)
        .order_by(ProductDisappearance.created_at.desc())
    )
    if status_filter:
        statement = statement.where(ProductDisappearance.status == status_filter)
    now = datetime.now(timezone.utc)
    return [
        DisappearanceRow(
            id=item.id,
            product_id=product.id,
            product_name=product.name,
            product_unit=product.unit,
            is_saleable=product.is_saleable,
            sale_price=product.sale_price,
            acquisition_cost=product.acquisition_cost,
            quantity=item.quantity,
            observation=item.observation,
            reported_by=reporter_name,
            status=item.status,
            resolution=item.resolution,
            resolved_by=resolver_name,
            resolved_at=item.resolved_at,
            created_at=item.created_at,
            days_missing=((item.resolved_at or now) - item.created_at).days,
        )
        for item, product, reporter_name, resolver_name in database.execute(statement).all()
    ]


@router.get("/disappearances", response_model=list[DisappearanceRow])
def list_disappearances(
    status_filter: str | None = Query(default="PENDING", alias="status", pattern="^(PENDING|RESOLVED)$"),
    database: Session = Depends(get_db),
    _: User = Depends(require_section("productos")),
) -> list[DisappearanceRow]:
    return disappearance_rows(database, status_filter)


@router.post("/disappearances", response_model=DisappearanceRow, status_code=status.HTTP_201_CREATED)
def register_disappearance(
    payload: DisappearanceCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("productos")),
) -> DisappearanceRow:
    product = database.scalar(select(Product).where(Product.id == payload.product_id).with_for_update())
    if product is None or not product.is_active or product.is_combo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden reportar desapariciones de productos activos que no sean combos")
    if product.unit in {"UNIT", "PAQUETE"} and payload.quantity != payload.quantity.to_integral_value():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La cantidad debe ser un número entero para productos por unidad o paquete")
    if product.stock < payload.quantity:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Stock insuficiente para {product.name}")
    # Sale del stock, pero no es venta, uso ni pérdida: no mueve dinero ni costos hasta que se resuelva.
    product.stock -= payload.quantity
    observation = payload.observation.strip() if payload.observation and payload.observation.strip() else None
    movement = InventoryMovement(product_id=product.id, user_id=current_user.id, movement_type="MISSING", quantity=payload.quantity, stock_after=product.stock, observation=observation or "Producto desaparecido")
    database.add(movement)
    database.flush()
    disappearance = ProductDisappearance(product_id=product.id, user_id=current_user.id, quantity=payload.quantity, observation=observation, inventory_movement_id=movement.id)
    database.add(disappearance)
    database.commit()
    return next(row for row in disappearance_rows(database, "PENDING") if row.id == disappearance.id)


@router.post("/disappearances/{disappearance_id}/resolve", response_model=DisappearanceRow)
def resolve_disappearance(
    disappearance_id: int,
    payload: DisappearanceResolve,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("productos")),
) -> DisappearanceRow:
    disappearance = database.scalar(select(ProductDisappearance).where(ProductDisappearance.id == disappearance_id).with_for_update())
    if disappearance is None or disappearance.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Desaparición pendiente no encontrada")
    product = database.scalar(select(Product).where(Product.id == disappearance.product_id).with_for_update())
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    if payload.resolution == "SALE" and payload.sale is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Indica cliente, vendedor y medio de pago de la venta")

    # Primero se deshace la desaparición (las unidades vuelven al stock) y luego,
    # si no apareció, se registra lo que pasó con la misma lógica de siempre.
    product.stock += disappearance.quantity
    movement = database.get(InventoryMovement, disappearance.inventory_movement_id) if disappearance.inventory_movement_id else None
    disappearance.inventory_movement_id = None
    database.flush()
    if movement is not None:
        database.delete(movement)
    disappearance.status = "RESOLVED"
    disappearance.resolution = payload.resolution
    disappearance.resolved_by_id = current_user.id
    disappearance.resolved_at = datetime.now(timezone.utc)
    database.flush()

    note = payload.observation.strip() if payload.observation and payload.observation.strip() else None
    try:
        if payload.resolution == "FOUND":
            database.commit()
        elif payload.resolution == "INTERNAL_USE":
            register_internal_use(InternalUseCreate(product_id=product.id, quantity=disappearance.quantity, observation=note or "Uso interno (producto desaparecido)"), database, current_user)
        elif payload.resolution == "DAMAGE":
            register_damage(DamageCreate(product_id=product.id, quantity=disappearance.quantity, unit_cost=payload.unit_cost, observation=note or "Pérdida de producto desaparecido"), database, current_user)
        else:
            if disappearance.quantity != disappearance.quantity.to_integral_value():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Solo se pueden vender cantidades enteras")
            sale = payload.sale
            quantity = int(disappearance.quantity)
            total = product.sale_price * quantity
            create_sale(
                SaleCreate(
                    buyer_name=sale.buyer_name,
                    assigned_seller_id=sale.assigned_seller_id,
                    payment_method=sale.payment_method,
                    amount_received=(sale.amount_received if sale.amount_received is not None else total) if sale.payment_method == "CASH" else None,
                    items=[SaleItemCreate(product_id=product.id, quantity=quantity)],
                ),
                database,
                current_user,
            )
    except Exception:
        database.rollback()
        raise
    return next(row for row in disappearance_rows(database, "RESOLVED") if row.id == disappearance_id)