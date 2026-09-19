from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased

from app.api.v1.dependencies import require_admin
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Credit, Customer, FinancialMovement, InventoryMovement, Product, Sale, SaleItem, SaleSupport, User
from app.schemas.movements import FinancialMovementUpdate, InventoryMovementUpdate, MovementRow, MovementsResponse

router = APIRouter(prefix="/movements", tags=["movements"])


def delete_sale_records(sale: Sale, database: Session) -> None:
    inventory_movements = database.scalars(select(InventoryMovement).where(InventoryMovement.sale_id == sale.id)).all()
    for movement in inventory_movements:
        product = database.scalar(select(Product).where(Product.id == movement.product_id).with_for_update())
        if product is not None:
            product.stock += movement.quantity
        database.delete(movement)
    database.query(FinancialMovement).filter(FinancialMovement.sale_id == sale.id).delete(synchronize_session=False)
    database.query(SaleItem).filter(SaleItem.sale_id == sale.id).delete(synchronize_session=False)
    database.query(SaleSupport).filter(SaleSupport.sale_id == sale.id).delete(synchronize_session=False)
    database.query(Credit).filter(Credit.sale_id == sale.id).delete(synchronize_session=False)
    database.delete(sale)


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

    inventory_sale_ids = {movement.sale_id for movement, _ in inventory_rows if movement.sale_id}
    sale_financials = {movement.sale_id: (movement, quantity) for movement, quantity in financial_rows if movement.sale_id}
    purchase_financial_ids = {movement.financial_movement_id for movement, _ in inventory_rows if movement.financial_movement_id}
    linked_purchase_financials = database.scalars(select(FinancialMovement).where(FinancialMovement.id.in_(purchase_financial_ids))).all() if purchase_financial_ids else []
    financial_by_id = {movement.id: movement for movement, _ in financial_rows}
    financial_by_id.update({movement.id: movement for movement in linked_purchase_financials})

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
                product_id=movement.product_id,
                movement_type=movement.movement_type,
                amount=(financial_by_id.get(movement.financial_movement_id).amount if movement.financial_movement_id and financial_by_id.get(movement.financial_movement_id) else sale_financials.get(movement.sale_id, (None, None))[0].amount if movement.sale_id and sale_financials.get(movement.sale_id) else None),
                unit_cost=(financial_by_id.get(movement.financial_movement_id).amount / movement.quantity if movement.financial_movement_id and financial_by_id.get(movement.financial_movement_id) and movement.quantity else None),
                quantity=movement.quantity,
                concept=movement.observation or movement.movement_type,
                product_name=product_name,
                seller_name=seller_name,
                customer_name=customer_name,
                source_combo_product_id=movement.source_combo_product_id,
                created_at=movement.created_at,
            )
        )

    for movement, quantity in financial_rows:
        if movement.sale_id in inventory_sale_ids or movement.id in purchase_financial_ids:
            continue
        sale_detail = sale_metadata.get(movement.sale_id, {})
        rows.append(
            MovementRow(
                id=movement.id,
                domain="financial",
                related_id=movement.sale_id,
                product_id=None,
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
    if movement.sale_id:
        raise HTTPException(status_code=409, detail="Los movimientos de una venta no se pueden editar individualmente")

    product = database.get(Product, movement.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    quantity = payload.quantity if payload.quantity is not None else movement.quantity
    new_product = product
    financial_movement = database.get(FinancialMovement, movement.financial_movement_id) if movement.financial_movement_id else None
    if financial_movement is None and movement.movement_type == "PURCHASE":
        financial_movement = database.scalar(
            select(FinancialMovement)
            .where(
                FinancialMovement.user_id == movement.user_id,
                FinancialMovement.movement_type == "EXPENSE",
                FinancialMovement.concept == f"Compra de {product.name}",
                FinancialMovement.created_at >= movement.created_at - timedelta(seconds=2),
                FinancialMovement.created_at <= movement.created_at + timedelta(seconds=2),
            )
            .order_by(FinancialMovement.id.desc())
            .limit(1)
        )
        if financial_movement:
            movement.financial_movement_id = financial_movement.id
    current_unit_cost = financial_movement.amount / movement.quantity if financial_movement and movement.quantity else None
    if payload.product_id is not None and payload.product_id != movement.product_id:
        new_product = database.scalar(select(Product).where(Product.id == payload.product_id).with_for_update())
        if new_product is None or not new_product.is_active:
            raise HTTPException(status_code=400, detail="El nuevo producto no está disponible")
        if movement.movement_type in {"SALE", "DAMAGE", "INTERNAL_USE"}:
            product.stock += movement.quantity
        elif movement.movement_type in {"PURCHASE", "ADJUSTMENT"}:
            product.stock -= movement.quantity
            if product.stock < 0:
                raise HTTPException(status_code=400, detail="El cambio dejaría el stock anterior en negativo")
        movement.product_id = new_product.id
        if movement.sale_id:
            sale_item = database.scalar(select(SaleItem).where(SaleItem.sale_id == movement.sale_id, SaleItem.product_id == product.id))
            if sale_item:
                sale_item.product_id = new_product.id

    if new_product.unit in {"UNIT", "PAQUETE"} and quantity != quantity.to_integral_value():
        raise HTTPException(status_code=400, detail="La cantidad debe ser un número entero para productos por unidad o paquete")

    delta = quantity if new_product.id != product.id else quantity - movement.quantity
    if movement.movement_type in {"SALE", "DAMAGE", "INTERNAL_USE"}:
        new_product.stock -= delta
    elif movement.movement_type in {"PURCHASE", "ADJUSTMENT"}:
        new_product.stock += delta
    if new_product.stock < 0:
        raise HTTPException(status_code=400, detail="La cantidad supera el stock disponible")
    movement.quantity = quantity
    movement.stock_after = new_product.stock

    if financial_movement:
        unit_cost = payload.unit_cost if payload.unit_cost is not None else current_unit_cost
        financial_movement.amount = quantity * unit_cost
        financial_movement.concept = f"Compra de {new_product.name}"
        financial_movement.product = new_product.name
        financial_movement.observation = movement.observation or f"Compra de {new_product.name}"

    if payload.observation is not None:
        movement.observation = payload.observation.strip() or None
        if financial_movement:
            financial_movement.observation = movement.observation or f"Compra de {new_product.name}"

    if payload.assigned_seller_id is not None:
        seller = database.scalar(select(User).where(User.id == payload.assigned_seller_id, User.role == "SELLER", User.is_active.is_(True)))
        if seller is None:
            raise HTTPException(status_code=400, detail="El vendedor seleccionado no está disponible")
        movement.assigned_seller_id = seller.id

    database.commit()
    database.refresh(movement)
    database.refresh(product)
    if new_product.id != product.id:
        database.refresh(new_product)

    sale = database.get(Sale, movement.sale_id) if movement.sale_id else None
    customer_name = database.scalar(select(Customer.name).where(Customer.id == sale.customer_id)) if sale and sale.customer_id else None
    seller_name = database.scalar(select(User.full_name).where(User.id == movement.assigned_seller_id)) if movement.assigned_seller_id else None

    return MovementRow(
        id=movement.id,
        domain="inventory",
        related_id=movement.sale_id,
        product_id=new_product.id,
        movement_type=movement.movement_type,
        amount=financial_movement.amount if financial_movement else None,
        unit_cost=financial_movement.amount / movement.quantity if financial_movement and movement.quantity else None,
        quantity=movement.quantity,
        concept=movement.observation or movement.movement_type,
        product_name=new_product.name,
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
    if movement.sale_id:
        raise HTTPException(status_code=409, detail="Los movimientos de una venta no se pueden editar individualmente")

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
        unit_cost=None,
        quantity=None,
        concept=movement.concept,
        product_name=None,
        seller_name=seller_name,
        customer_name=customer_name,
        created_at=movement.created_at,
    )


@router.delete("/{domain}/{movement_id}", status_code=204)
def delete_movement(
    domain: str,
    movement_id: int,
    database: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> None:
    if domain == "inventory":
        movement = database.get(InventoryMovement, movement_id)
        if movement is None:
            raise HTTPException(status_code=404, detail="Movimiento de inventario no encontrado")
        if movement.sale_id:
            sale = database.get(Sale, movement.sale_id)
            if sale is not None:
                delete_sale_records(sale, database)
        else:
            product = database.scalar(select(Product).where(Product.id == movement.product_id).with_for_update())
            if product is not None:
                if movement.movement_type in {"PURCHASE", "ADJUSTMENT"}:
                    product.stock -= movement.quantity
                else:
                    product.stock += movement.quantity
                if product.stock < 0:
                    raise HTTPException(status_code=400, detail="No se puede eliminar: el stock resultante sería negativo")
            if movement.financial_movement_id:
                financial_movement = database.get(FinancialMovement, movement.financial_movement_id)
                if financial_movement is not None:
                    database.delete(financial_movement)
            database.delete(movement)
    elif domain == "financial":
        movement = database.get(FinancialMovement, movement_id)
        if movement is None:
            raise HTTPException(status_code=404, detail="Movimiento financiero no encontrado")
        if movement.sale_id:
            sale = database.get(Sale, movement.sale_id)
            if sale is not None:
                delete_sale_records(sale, database)
        else:
            linked_inventory = database.scalar(
                select(InventoryMovement).where(
                    InventoryMovement.financial_movement_id == movement.id,
                )
            )
            if linked_inventory is not None:
                product = database.scalar(select(Product).where(Product.id == linked_inventory.product_id).with_for_update())
                if product is not None:
                    product.stock -= linked_inventory.quantity
                    if product.stock < 0:
                        raise HTTPException(status_code=400, detail="No se puede eliminar: el stock resultante sería negativo")
                database.delete(linked_inventory)
            database.delete(movement)
    else:
        raise HTTPException(status_code=400, detail="Dominio de movimiento no válido")
    database.commit()
