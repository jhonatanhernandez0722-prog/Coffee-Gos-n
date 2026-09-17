from datetime import datetime, time, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.api.v1.dependencies import require_admin
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Credit, Customer, FinancialMovement, Sale, User
from app.schemas.incomes import IncomeCreate, IncomeResponse, IncomesResponse

router = APIRouter(prefix="/incomes", tags=["incomes"])


def response_for(movement: FinancialMovement) -> IncomeResponse:
    return IncomeResponse(
        id=movement.id,
        amount=movement.amount,
        person_name=movement.person_name,
        income_type=movement.income_type or "OTHER",
        payment_method=movement.payment_method or "CASH",
        occurred_on=(movement.occurred_at or movement.created_at).date(),
        description=movement.observation or movement.concept,
        created_at=movement.created_at,
    )


def independent_filters() -> list[object]:
    return [
        FinancialMovement.movement_type == "INCOME",
        FinancialMovement.sale_id.is_(None),
        FinancialMovement.income_type.is_not(None),
    ]


def independent_statement():
    return select(FinancialMovement).where(*independent_filters())


@router.get("", response_model=IncomesResponse)
def list_incomes(database: Session = Depends(get_db), _: User = Depends(require_section("ingresos"))) -> IncomesResponse:
    movements = database.scalars(independent_statement().order_by(FinancialMovement.occurred_at.desc(), FinancialMovement.id.desc()).limit(200)).all()
    total = database.scalar(select(func.coalesce(func.sum(FinancialMovement.amount), 0)).where(*independent_filters())) or Decimal("0")
    return IncomesResponse(incomes=[response_for(movement) for movement in movements], total=total)


@router.get("/donations", response_model=IncomesResponse)
def list_donations(database: Session = Depends(get_db), _: User = Depends(require_section("donaciones"))) -> IncomesResponse:
    statement = independent_statement().where(FinancialMovement.income_type == "DONATION")
    movements = database.scalars(statement.order_by(FinancialMovement.occurred_at.desc(), FinancialMovement.id.desc()).limit(200)).all()
    total = database.scalar(select(func.coalesce(func.sum(FinancialMovement.amount), 0)).where(*independent_filters(), FinancialMovement.income_type == "DONATION")) or Decimal("0")
    return IncomesResponse(incomes=[response_for(movement) for movement in movements], total=total)


@router.post("", response_model=IncomeResponse, status_code=status.HTTP_201_CREATED)
def create_income(payload: IncomeCreate, database: Session = Depends(get_db), current_user: User = Depends(require_section("ingresos"))) -> IncomeResponse:
    movement = FinancialMovement(
        user_id=current_user.id,
        movement_type="INCOME",
        amount=payload.amount,
        person_name=payload.person_name.strip(),
        concept=payload.description.strip() or payload.income_type,
        payment_method=payload.payment_method,
        income_type=payload.income_type,
        occurred_at=datetime.combine(payload.occurred_on, time.min, tzinfo=timezone.utc),
        observation=payload.description.strip() or None,
    )
    database.add(movement)
    database.commit()
    database.refresh(movement)
    return response_for(movement)


@router.patch("/{income_id}", response_model=IncomeResponse)
def update_income(income_id: int, payload: IncomeCreate, database: Session = Depends(get_db), _: User = Depends(require_admin)) -> IncomeResponse:
    movement = database.scalar(independent_statement().where(FinancialMovement.id == income_id))
    if movement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingreso no encontrado")
    movement.amount = payload.amount
    movement.person_name = payload.person_name.strip()
    movement.income_type = payload.income_type
    movement.payment_method = payload.payment_method
    movement.occurred_at = datetime.combine(payload.occurred_on, time.min, tzinfo=timezone.utc)
    movement.concept = payload.description.strip() or payload.income_type
    movement.observation = payload.description.strip() or None
    database.commit()
    database.refresh(movement)
    return response_for(movement)


@router.delete("/cleanup", status_code=status.HTTP_200_OK)
def cleanup_income_credit_customer_data(database: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> dict[str, int]:
    independent_incomes = database.scalars(independent_statement()).all()
    preserved_by_method: dict[str, Decimal] = {}
    for movement in independent_incomes:
        method = movement.payment_method or "CASH"
        preserved_by_method[method] = preserved_by_method.get(method, Decimal("0")) + movement.amount

    credit_count = database.query(Credit).count()
    customer_count = database.query(Customer).count()
    database.execute(delete(Credit))
    database.execute(update(Sale).where(Sale.customer_id.is_not(None)).values(customer_id=None))
    database.execute(delete(Customer))
    for movement in independent_incomes:
        database.delete(movement)
    for payment_method, amount in preserved_by_method.items():
        database.add(FinancialMovement(
            user_id=current_user.id,
            movement_type="INCOME",
            amount=amount,
            concept="Saldo conservado al limpiar ingresos",
            payment_method=payment_method,
        ))
    database.commit()
    return {"incomes_deleted": len(independent_incomes), "credits_deleted": credit_count, "customers_deleted": customer_count}


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income(income_id: int, database: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    movement = database.scalar(independent_statement().where(FinancialMovement.id == income_id))
    if movement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingreso no encontrado")
    database.delete(movement)
    database.commit()