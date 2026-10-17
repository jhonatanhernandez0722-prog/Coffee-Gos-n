from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FinancialMovement

# Un traslado entre Efectivo y Nequi se guarda como un egreso en la cuenta de origen y un ingreso en la de
# destino, ambos con este income_type y el mismo created_at. Mueve saldo entre cuentas sin cambiar el total,
# así que no debe contarse como ingreso, egreso ni utilidad en los reportes.
TRANSFER = "TRANSFER"


def not_transfer():
    return FinancialMovement.income_type.is_distinct_from(TRANSFER)


def transfer_pair(database: Session, movement: FinancialMovement) -> list[FinancialMovement]:
    """Las dos mitades del traslado al que pertenece el movimiento."""
    return list(database.scalars(
        select(FinancialMovement).where(
            FinancialMovement.income_type == TRANSFER,
            FinancialMovement.created_at == movement.created_at,
            FinancialMovement.amount == movement.amount,
        )
    ).all())
