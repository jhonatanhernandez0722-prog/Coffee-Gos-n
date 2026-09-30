from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import require_admin
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Credit, FinancialMovement, InventoryMovement, Liability, OpeningBalanceCorrection, Product, Sale, SaleItem, User
from app.schemas.financial_reports import BalanceReport, CashReconciliation, LiabilityCreate, LiabilityResponse, OpeningBalanceCorrectionCreate, OpeningBalanceCorrectionResponse, OpeningBalanceResponse

router = APIRouter(prefix="/financial-reports", tags=["financial-reports"])


def pending_credit_exists():
    return ~select(Credit.id).where(Credit.sale_id == FinancialMovement.sale_id, Credit.status == "PENDING").exists()


def available_financial_filters():
    return [pending_credit_exists(), (FinancialMovement.movement_type == "INCOME") | FinancialMovement.settled_at.is_not(None)]


def cash_balance(database: Session, method: str | None = None, as_of: datetime | None = None) -> Decimal:
    filters = available_financial_filters()
    if method:
        filters.append(FinancialMovement.payment_method == method)
    if as_of:
        filters.append(func.coalesce(FinancialMovement.settled_at, FinancialMovement.occurred_at, FinancialMovement.created_at) < as_of)
    filters.append(FinancialMovement.movement_type.in_(("INCOME", "EXPENSE")))
    return database.scalar(
        select(func.coalesce(func.sum(case((FinancialMovement.movement_type == "INCOME", FinancialMovement.amount), else_=-FinancialMovement.amount)), 0)).where(*filters)
    ) or Decimal("0")


def pending_receivables(database: Session, as_of: datetime | None = None) -> Decimal:
    filters = [Credit.status == "PENDING"]
    if as_of:
        filters.append(Credit.created_at < as_of)
    return database.scalar(select(func.coalesce(func.sum(Credit.pending_amount), 0)).where(*filters)) or Decimal("0")


def liability_response(liability: Liability) -> LiabilityResponse:
    return LiabilityResponse(id=liability.id, kind=liability.kind, description=liability.description, amount=liability.amount, due_date=liability.due_date, status=liability.status, created_at=liability.created_at, paid_at=liability.paid_at)


@router.get("/cash-reconciliation", response_model=CashReconciliation)
def cash_reconciliation(report_date: date | None = None, database: Session = Depends(get_db), _: User = Depends(require_section("arqueo"))) -> CashReconciliation:
    selected_date = report_date or datetime.now(timezone.utc).date()
    as_of = datetime.combine(selected_date, time.max, tzinfo=timezone.utc) + timedelta(microseconds=1)
    cash = cash_balance(database, "CASH", as_of)
    bank = cash_balance(database, "NEQUI", as_of)
    receivables = pending_receivables(database, as_of)
    return CashReconciliation(date=selected_date, cash=cash, bank=bank, receivables=receivables, total=cash + bank + receivables)


@router.get("/opening-balance", response_model=OpeningBalanceResponse)
def opening_balance(database: Session = Depends(get_db), _: User = Depends(require_admin)) -> OpeningBalanceResponse:
    values = database.execute(
        select(FinancialMovement.payment_method, FinancialMovement.amount)
        .where(FinancialMovement.movement_type == "INCOME", FinancialMovement.income_type == "OPENING_BALANCE")
    ).all()
    balances = {method: amount for method, amount in values}
    return OpeningBalanceResponse(cash=balances.get("CASH", Decimal("0")), nequi=balances.get("NEQUI", Decimal("0")))


@router.post("/opening-balance/correction", response_model=OpeningBalanceCorrectionResponse)
def correct_opening_balance(
    payload: OpeningBalanceCorrectionCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> OpeningBalanceCorrectionResponse:
    movements = database.scalars(
        select(FinancialMovement)
        .where(FinancialMovement.movement_type == "INCOME", FinancialMovement.income_type == "OPENING_BALANCE")
        .with_for_update()
    ).all()
    by_method = {movement.payment_method: movement for movement in movements}
    missing_methods = {"CASH", "NEQUI"} - set(by_method)
    if missing_methods:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se encontraron los saldos iniciales de efectivo y Nequi")

    cash_before = by_method["CASH"].amount
    nequi_before = by_method["NEQUI"].amount
    by_method["CASH"].amount = payload.cash
    by_method["NEQUI"].amount = payload.nequi
    correction = OpeningBalanceCorrection(
        user_id=current_user.id,
        cash_before=cash_before,
        cash_after=payload.cash,
        nequi_before=nequi_before,
        nequi_after=payload.nequi,
        reason=payload.reason.strip(),
    )
    database.add(correction)
    database.commit()
    database.refresh(correction)
    return OpeningBalanceCorrectionResponse(cash=correction.cash_after, nequi=correction.nequi_after, reason=correction.reason, corrected_at=correction.created_at)


def month_bounds(month: str) -> tuple[datetime, datetime]:
    try:
        start = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El mes debe tener el formato AAAA-MM") from None
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, next_month


def inventory_value(database: Session, as_of: datetime | None = None) -> Decimal:
    products = database.execute(select(Product.id, Product.stock, Product.acquisition_cost).where(Product.is_active.is_(True))).all()
    later_changes: dict[int, Decimal] = {}
    if as_of:
        # Reconstruye el stock al cierre del periodo deshaciendo los movimientos posteriores.
        signed_quantity = case((InventoryMovement.movement_type.in_(("PURCHASE", "ADJUSTMENT")), InventoryMovement.quantity), else_=-InventoryMovement.quantity)
        later_changes = dict(database.execute(
            select(InventoryMovement.product_id, func.sum(signed_quantity))
            .where(InventoryMovement.created_at >= as_of)
            .group_by(InventoryMovement.product_id)
        ).all())
    return sum(((stock - later_changes.get(product_id, Decimal("0"))) * cost for product_id, stock, cost in products), Decimal("0"))


@router.get("/balance", response_model=BalanceReport)
def balance_report(month: str | None = None, database: Session = Depends(get_db), _: User = Depends(require_section("balance"))) -> BalanceReport:
    period_start, period_end = month_bounds(month) if month else (None, None)
    cash = cash_balance(database, "CASH", period_end)
    bank = cash_balance(database, "NEQUI", period_end)
    receivables = pending_receivables(database, period_end)
    inventory = inventory_value(database, period_end)
    liabilities = database.scalars(select(Liability).order_by(Liability.status, Liability.due_date, Liability.created_at)).all()
    if period_end:
        open_liabilities = [item for item in liabilities if item.created_at < period_end and (item.status == "PENDING" or (item.paid_at and item.paid_at >= period_end))]
    else:
        open_liabilities = [item for item in liabilities if item.status == "PENDING"]
    total_liabilities = sum((liability.amount for liability in open_liabilities), Decimal("0"))

    income_date = func.coalesce(FinancialMovement.occurred_at, FinancialMovement.created_at)
    income_filters = [FinancialMovement.movement_type == "INCOME", FinancialMovement.income_type.is_distinct_from("OPENING_BALANCE"), pending_credit_exists()]
    sale_cost_filters = [~select(Credit.id).where(Credit.sale_id == Sale.id, Credit.status == "PENDING").exists()]
    damage_filters = [FinancialMovement.movement_type == "COST"]
    expense_filters = [FinancialMovement.movement_type == "EXPENSE", FinancialMovement.settled_at.is_not(None)]
    if period_start and period_end:
        income_filters += [income_date >= period_start, income_date < period_end]
        sale_cost_filters += [Sale.created_at >= period_start, Sale.created_at < period_end]
        damage_filters += [FinancialMovement.created_at >= period_start, FinancialMovement.created_at < period_end]
        expense_filters += [FinancialMovement.settled_at >= period_start, FinancialMovement.settled_at < period_end]

    income = database.scalar(select(func.coalesce(func.sum(FinancialMovement.amount), 0)).where(*income_filters)) or Decimal("0")
    sale_costs = database.scalar(select(func.coalesce(func.sum(SaleItem.quantity * SaleItem.unit_cost_snapshot), 0)).join(Sale, Sale.id == SaleItem.sale_id).where(*sale_cost_filters)) or Decimal("0")
    damage_costs = database.scalar(select(func.coalesce(func.sum(FinancialMovement.amount), 0)).where(*damage_filters)) or Decimal("0")
    costs = sale_costs + damage_costs
    expenses = database.scalar(select(func.coalesce(func.sum(FinancialMovement.amount), 0)).where(*expense_filters)) or Decimal("0")
    total_assets = cash + bank + receivables + inventory
    return BalanceReport(month=month, cash=cash, bank=bank, receivables=receivables, inventory=inventory, total_assets=total_assets, liabilities=[liability_response(item) for item in open_liabilities], total_liabilities=total_liabilities, equity=total_assets - total_liabilities, income=income, costs=costs, damage_costs=damage_costs, expenses=expenses, profit=income - costs - expenses)


@router.get("/liabilities", response_model=list[LiabilityResponse])
def list_liabilities(database: Session = Depends(get_db), _: User = Depends(require_section("balance"))) -> list[LiabilityResponse]:
    return [liability_response(item) for item in database.scalars(select(Liability).order_by(Liability.status, Liability.due_date, Liability.created_at.desc())).all()]


@router.post("/liabilities", response_model=LiabilityResponse, status_code=status.HTTP_201_CREATED)
def create_liability(payload: LiabilityCreate, database: Session = Depends(get_db), _: User = Depends(require_section("balance"))) -> LiabilityResponse:
    liability = Liability(kind=payload.kind, description=payload.description.strip(), amount=payload.amount, due_date=payload.due_date)
    database.add(liability)
    database.commit()
    database.refresh(liability)
    return liability_response(liability)


@router.patch("/liabilities/{liability_id}", response_model=LiabilityResponse)
def update_liability(liability_id: int, payload: LiabilityCreate, database: Session = Depends(get_db), _: User = Depends(require_admin)) -> LiabilityResponse:
    liability = database.get(Liability, liability_id)
    if liability is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Obligación no encontrada")
    liability.kind = payload.kind
    liability.description = payload.description.strip()
    liability.amount = payload.amount
    liability.due_date = payload.due_date
    database.commit()
    database.refresh(liability)
    return liability_response(liability)


@router.post("/liabilities/{liability_id}/pay", response_model=LiabilityResponse)
def pay_liability(liability_id: int, database: Session = Depends(get_db), _: User = Depends(require_section("balance"))) -> LiabilityResponse:
    liability = database.get(Liability, liability_id)
    if liability is None or liability.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Obligación pendiente no encontrada")
    liability.status = "PAID"
    liability.paid_at = datetime.now(timezone.utc)
    database.commit()
    database.refresh(liability)
    return liability_response(liability)


@router.delete("/liabilities/{liability_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_liability(liability_id: int, database: Session = Depends(get_db), _: User = Depends(require_admin)) -> None:
    liability = database.get(Liability, liability_id)
    if liability is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Obligación no encontrada")
    database.delete(liability)
    database.commit()
