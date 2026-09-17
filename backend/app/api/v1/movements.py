from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased

from app.api.v1.dependencies import require_admin
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Customer, FinancialMovement, InventoryMovement, Product, Sale, SaleItem, SaleSupport, User
from app.schemas.movements import FinancialMovementUpdate, InventoryMovementUpdate, MovementRow, MovementsResponse

router = APIRouter(prefix="/movements", tags=["movements"])


@router.get("", response_model=MovementsResponse)
def list_movements(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    movement_type: str | None = Query(default=None, max_length=20),
    database: Session = Depends(get_db),
    _: User = Depends(require_section("movimientos")),
) -> MovementsResponse:
    inventory_statement = select(InventoryMovement, Product.name).join(Product, Product.id == InventoryMovement.product_id)
    financial_statement = (
        select(FinancialMovement, func.coalesce(func.sum(SaleItem.quantity), 0).label("quantity"))
        .outerjoin(SaleItem, SaleItem.sale_id == FinancialMovement.sale_id)
        .where(or_(FinancialMovement.income_type.is_(None), FinancialMovement.income_type != "OPENING_BALANCE"))
        .group_by(FinancialMovement.id)
    )

    if date_from:
        start = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
        inventory_statement = inventory_statement.where(InventoryMovement.created_at >= start)
        financial_statement = financial_statement.where(FinancialMovement.created_at >= start)
    if date_to:
        end = datetime.combine(date_to, time.min, tzinfo=timezone.utc) + timedelta(days=1)
        inventory_statement = inventory_statement.where(InventoryMovement.created_at < end)
        financial_statement = financial_statement.where(FinancialMovement.created_at < end)
    if movement_type:
        inventory_statement = inventory_statement.where(InventoryMovement.movement_type == movement_type.upper())
        financial_statement = financial_statement.where(FinancialMovement.movement_type == movement_type.upper())

    inventory_rows = database.execute(inventory_statement.order_by(InventoryMovement.created_at.desc()).limit(100)).all()
    financial_rows = database.execute(financial_statement.order_by(FinancialMovement.created_at.desc()).limit(100)).all()

    internal_seller_ids = {movement.assigned_seller_id for movement, _ in inventory_rows if movement.assigned_seller_id}
    internal_sellers = dict(database.execute(select(User.id, User.full_name).where(User.id.in_(internal_seller_ids))).all()) if internal_seller_ids else {}

    sale_ids = {movement.sale_id for movement, _ in inventory_rows if movement.sale_id} | {movement.sale_id for movement, _ in financial_rows if movement.sale_id}
    sale_metadata: dict[int, dict[str, object]] = {}
    if sale_ids:
        cashier = aliased(User)
        seller = aliased(User)
        sale_rows = database.execute(
            select(Sale.id, Sale.sale_number, Sale.payment_method, Customer.name, seller.full_name, cashier.full_name)
            .outerjoin(Customer, Customer.id == Sale.customer_id)
            .outerjoin(seller, seller.id == Sale.assigned_seller_id)
            .join(cashier, cashier.id == Sale.user_id)
            .where(Sale.id.in_(sale_ids))
        ).all()

        support_rows = database.scalars(select(SaleSupport).where(SaleSupport.sale_id.in_(sale_ids))).all()
        support_urls: dict[int, list[str]] = {}
        for support in support_rows:
            support_urls.setdefault(support.sale_id, []).append(support.file_url)

        sale_metadata = {
            sale_id: {
                "sale_number": sale_number,
                "payment_method": payment_method,
                "customer_name": customer_name,
                "seller_name": seller_name,
                "cashier_name": cashier_name,
                "support_urls": support_urls.get(sale_id, []),
            }
            for sale_id, sale_number, payment_method, customer_name, seller_name, cashier_name in sale_rows
        }

    rows: list[MovementRow] = []
    for movement, product_name in inventory_rows:
        sale_detail = sale_metadata.get(movement.sale_id, {})
        seller_name = sale_detail.get("seller_name") if sale_detail.get("seller_name") is not None else internal_sellers.get(movement.assigned_seller_id)
        customer_name = sale_detail.get("customer_name")
        rows.append(
            MovementRow(
                id=movement.id,
                domain="inventory",
                related_id=movement.sale_id,
                movement_type=movement.movement_type,
                amount=None,
                quantity=movement.quantity,
                concept=movement.observation or movement.movement_type,
                product_name=product_name,
                seller_name=seller_name,
                customer_name=customer_name,
                created_at=movement.created_at,
            )
        )

    for movement, quantity in financial_rows:
        sale_detail = sale_metadata.get(movement.sale_id, {})
        rows.append(
            MovementRow(
                id=movement.id,
                domain="financial",
                related_id=movement.sale_id,
                movement_type=movement.movement_type,
                amount=movement.amount,
                quantity=quantity if movement.movement_type == "INCOME" else None,
                concept=movement.concept,
                product_name=None,
                seller_name=sale_detail.get("seller_name"),
                customer_name=sale_detail.get("customer_name"),
                created_at=movement.created_at,
            )
        )

    rows.sort(key=lambda row: row.created_at, reverse=True)
    return MovementsResponse(movements=rows[:100])


@router.patch("/inventory/{movement_id}", response_model=MovementRow)
def update_inventory_movement(
    movement_id: int,
    payload: InventoryMovementUpdate,
    database: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> MovementRow:
    movement = database.get(InventoryMovement, movement_id)
    if movement is None:
        raise HTTPException(status_code=404, detail="Movimiento de inventario no encontrado")

    product = database.get(Product, movement.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if payload.quantity is not None:
        delta = payload.quantity - movement.quantity
        if movement.movement_type in {"SALE", "DAMAGE", "INTERNAL_USE"}:
            product.stock -= delta
        elif movement.movement_type in {"PURCHASE", "ADJUSTMENT"}:
            product.stock += delta
        movement.quantity = payload.quantity
        movement.stock_after = product.stock

    if payload.observation is not None:
        movement.observation = payload.observation.strip() or None

    if payload.assigned_seller_id is not None:
        seller = database.scalar(select(User).where(User.id == payload.assigned_seller_id, User.role == "SELLER", User.is_active.is_(True)))
        if seller is None:
            raise HTTPException(status_code=400, detail="El vendedor seleccionado no está disponible")
        movement.assigned_seller_id = seller.id

    database.commit()
    database.refresh(movement)
    database.refresh(product)

    sale = database.get(Sale, movement.sale_id) if movement.sale_id else None
    customer_name = database.scalar(select(Customer.name).where(Customer.id == sale.customer_id)) if sale and sale.customer_id else None
    seller_name = database.scalar(select(User.full_name).where(User.id == movement.assigned_seller_id)) if movement.assigned_seller_id else None

    return MovementRow(
        id=movement.id,
        domain="inventory",
        related_id=movement.sale_id,
        movement_type=movement.movement_type,
        amount=None,
        quantity=movement.quantity,
        concept=movement.observation or movement.movement_type,
        product_name=product.name,
        seller_name=seller_name,
        customer_name=customer_name,
        created_at=movement.created_at,
    )


@router.patch("/financial/{movement_id}", response_model=MovementRow)
def update_financial_movement(
    movement_id: int,
    payload: FinancialMovementUpdate,
    database: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> MovementRow:
    movement = database.get(FinancialMovement, movement_id)
    if movement is None:
        raise HTTPException(status_code=404, detail="Movimiento financiero no encontrado")

    if payload.amount is not None:
        movement.amount = payload.amount
    if payload.concept is not None:
        movement.concept = payload.concept.strip()
        movement.observation = payload.concept.strip() if payload.concept.strip() else movement.observation
    if payload.payment_method is not None:
        movement.payment_method = payload.payment_method

    database.commit()
    database.refresh(movement)

    sale = database.get(Sale, movement.sale_id) if movement.sale_id else None
    customer_name = database.scalar(select(Customer.name).where(Customer.id == sale.customer_id)) if sale and sale.customer_id else None
    seller_name = database.scalar(select(User.full_name).where(User.id == sale.assigned_seller_id)) if sale and sale.assigned_seller_id else None

    return MovementRow(
        id=movement.id,
        domain="financial",
        related_id=movement.sale_id,
        movement_type=movement.movement_type,
        amount=movement.amount,
        quantity=None,
        concept=movement.concept,
        product_name=None,
        seller_name=seller_name,
        customer_name=customer_name,
        created_at=movement.created_at,
    )
