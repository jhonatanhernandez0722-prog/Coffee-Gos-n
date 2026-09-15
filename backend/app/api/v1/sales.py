from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import (
    Credit,
    Customer,
    FinancialMovement,
    InventoryMovement,
    Product,
    Sale,
    SaleItem,
    User,
)
from app.schemas.sales import SaleCreate, SaleItemResponse, SaleResponse

router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    payload: SaleCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_section("comanda")),
) -> SaleResponse:
    if payload.payment_method == "CREDIT" and not payload.customer_id and not payload.buyer_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A credit sale requires a customer")

    product_ids = [item.product_id for item in payload.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Each product can appear only once")

    try:
        locked_products = {}
        for item in payload.items:
            product = database.scalar(select(Product).where(Product.id == item.product_id).with_for_update())
            if product is None or not product.is_active or not product.is_saleable:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product is not available")
            if product.stock < item.quantity:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Insufficient stock for {product.name}")
            locked_products[item.product_id] = product

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

        subtotal = sum((locked_products[item.product_id].sale_price * item.quantity for item in payload.items), Decimal("0"))
        sale = Sale(
            sale_number=f"V-{datetime.now(timezone.utc):%Y%m%d%H%M%S}-{uuid4().hex[:6].upper()}",
            customer_id=customer.id if customer else None,
            user_id=current_user.id,
            payment_method=payload.payment_method,
            subtotal=subtotal,
            total=subtotal,
        )
        database.add(sale)
        database.flush()
        for item in payload.items:
            product = locked_products[item.product_id]
            product.stock -= item.quantity
            database.add(SaleItem(sale_id=sale.id, product_id=product.id, quantity=item.quantity, unit_price=product.sale_price, unit_cost_snapshot=product.acquisition_cost))
            database.add(InventoryMovement(product_id=product.id, user_id=current_user.id, movement_type="SALE", quantity=item.quantity, stock_after=product.stock, sale_id=sale.id))
        database.add(FinancialMovement(user_id=current_user.id, movement_type="INCOME", amount=subtotal, concept=f"Venta {sale.sale_number}", sale_id=sale.id))
        credit_created = payload.payment_method == "CREDIT"
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
        )
    except HTTPException:
        database.rollback()
        raise
    except Exception:
        database.rollback()
        raise