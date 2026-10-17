from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import require_admin
from app.core.business_time import BUSINESS_TZ, business_midday
from app.core.permissions import require_section
from app.core.transfers import TRANSFER, transfer_pair
from app.db.session import get_db
from app.models import FinancialMovement, User
from app.schemas.transfers import TransferCreate, TransferResponse, TransfersResponse

router = APIRouter(prefix="/transfers", tags=["transfers"])

METHOD_LABELS = {"CASH": "Efectivo", "NEQUI": "Nequi"}


def other_method(method: str) -> str:
    return "NEQUI" if method == "CASH" else "CASH"


def response_for(outgoing: FinancialMovement) -> TransferResponse:
    from_method = outgoing.payment_method or "CASH"
    return TransferResponse(
        id=outgoing.id,
        amount=outgoing.amount,
        from_method=from_method,
        to_method=other_method(from_method),
        occurred_on=(outgoing.occurred_at or outgoing.created_at).astimezone(BUSINESS_TZ).date(),
        description=outgoing.observation or "",
        created_at=outgoing.created_at,
    )


@router.get("", response_model=TransfersResponse)
def list_transfers(database: Session = Depends(get_db), _: User = Depends(require_section("ingresos"))) -> TransfersResponse:
    # Cada traslado se lista por su mitad de salida.
    outgoing = database.scalars(
        select(FinancialMovement)
        .where(FinancialMovement.income_type == TRANSFER, FinancialMovement.movement_type == "EXPENSE")
        .order_by(FinancialMovement.occurred_at.desc(), FinancialMovement.id.desc())
        .limit(200)
    ).all()
    return TransfersResponse(transfers=[response_for(movement) for movement in outgoing])


@router.post("", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
def create_transfer(payload: TransferCreate, database: Session = Depends(get_db), current_user: User = Depends(require_section("ingresos"))) -> TransferResponse:
    to_method = other_method(payload.from_method)
    concept = f"Traslado {METHOD_LABELS[payload.from_method]} → {METHOD_LABELS[to_method]}"
    moment = business_midday(payload.occurred_on)
    # El mismo created_at enlaza las dos mitades del traslado.
    created_at = datetime.now(timezone.utc)
    common = dict(
        user_id=current_user.id,
        amount=payload.amount,
        concept=concept,
        income_type=TRANSFER,
        occurred_at=moment,
        settled_at=moment,
        observation=payload.description.strip() or None,
        created_at=created_at,
    )
    outgoing = FinancialMovement(movement_type="EXPENSE", payment_method=payload.from_method, **common)
    database.add_all([outgoing, FinancialMovement(movement_type="INCOME", payment_method=to_method, **common)])
    database.commit()
    database.refresh(outgoing)
    return response_for(outgoing)


@router.delete("/{transfer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transfer(transfer_id: int, database: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    movement = database.get(FinancialMovement, transfer_id)
    if movement is None or movement.income_type != TRANSFER:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Traslado no encontrado")
    for half in transfer_pair(database, movement):
        database.delete(half)
    database.commit()
