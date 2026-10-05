from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import require_admin
from app.core.business_time import BUSINESS_TZ, business_day_bounds, business_today
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Credit, FinancialMovement, InventoryMovement, Liability, OpeningBalanceCorrection, Product, Sale, SaleItem, User
from app.schemas.financial_reports import BalanceReport, CashReconciliation, MethodFlow, LiabilityCreate, LiabilityResponse, OpeningBalanceCorrectionCreate, OpeningBalanceCorrectionResponse, OpeningBalanceResponse

router = APIRouter(prefix="/financial-reports", tags=["financial-reports"])


MONEY_DATE = func.coalesce(FinancialMovement.settled_at, FinancialMovement.occurred_at, FinancialMovement.created_at)


def available_financial_filters():
    # Las ventas a crédito no generan ingreso al venderse; cada abono es un ingreso real
    # (aunque el crédito siga pendiente), así que no se excluye por estado del crédito.
    return [FinancialMovement.movement_type.in_(("INCOME", "EXPENSE")), (FinancialMovement.movement_type == "INCOME") | FinancialMovement.settled_at.is_not(None)]


def signed_amount():
    return case((FinancialMovement.movement_type == "INCOME", FinancialMovement.amount), else_=-FinancialMovement.amount)


def cash_balance(database: Session, method: str | None = None, as_of: datetime | None = None) -> Decimal:
    filters = available_financial_filters()
    if method:
        filters.append(FinancialMovement.payment_method == method)
    if as_of:
        filters.append(MONEY_DATE < as_of)
    return database.scalar(select(func.coalesce(func.sum(signed_amount()), 0)).where(*filters)) or Decimal("0")


def pending_receivables(database: Session, as_of: datetime | None = None) -> Decimal:
    if as_of is None:
        return database.scalar(select(func.coalesce(func.sum(Credit.pending_amount), 0)).where(Credit.status == "PENDING")) or Decimal("0")
    # Saldo de cada crédito tal como estaba en esa fecha: lo fiado menos los abonos hechos antes del corte.
    paid_before = (
        select(func.coalesce(func.sum(FinancialMovement.amount), 0))
        .where(FinancialMovement.sale_id == Credit.sale_id, FinancialMovement.movement_type == "INCOME", FinancialMovement.created_at < as_of)
        .scalar_subquery()
    )
    return database.scalar(
        select(func.coalesce(func.sum(func.greatest(Credit.original_amount - paid_before, 0)), 0)).where(Credit.created_at < as_of)
    ) or Decimal("0")


def day_flows(database: Session, start: datetime, end: datetime) -> dict[tuple[str, str], Decimal]:
    is_credit_sale = select(Credit.id).where(Credit.sale_id == FinancialMovement.sale_id).exists()
    category = case(
        (FinancialMovement.movement_type == "EXPENSE", "expenses"),
        (FinancialMovement.sale_id.is_(None), "other_income"),
        (is_credit_sale, "credit_payments"),
        else_="sales",
    )
    rows = database.execute(
        select(FinancialMovement.payment_method, category, func.sum(FinancialMovement.amount))
        .where(*available_financial_filters(), MONEY_DATE >= start, MONEY_DATE < end)
        .group_by(FinancialMovement.payment_method, category)
    ).all()
    return {(method or "", kind): total or Decimal("0") for method, kind, total in rows}


def method_flow(database: Session, method: str, start: datetime, end: datetime, flows: dict[tuple[str, str], Decimal]) -> MethodFlow:
    return MethodFlow(
        opening=cash_balance(database, method, start),
        sales=flows.get((method, "sales"), Decimal("0")),
        credit_payments=flows.get((method, "credit_payments"), Decimal("0")),
        other_income=flows.get((method, "other_income"), Decimal("0")),
        expenses=flows.get((method, "expenses"), Decimal("0")),
        closing=cash_balance(database, method, end),
    )


def liability_response(liability: Liability) -> LiabilityResponse:
    return LiabilityResponse(id=liability.id, kind=liability.kind, description=liability.description, amount=liability.amount, due_date=liability.due_date, status=liability.status, created_at=liability.created_at, paid_at=liability.paid_at)


@router.get("/cash-reconciliation", response_model=CashReconciliation)
def cash_reconciliation(report_date: date | None = None, database: Session = Depends(get_db), _: User = Depends(require_section("arqueo"))) -> CashReconciliation:
    selected_date = report_date or business_today()
    start, end = business_day_bounds(selected_date)
    flows = day_flows(database, start, end)
    cash_flow = method_flow(database, "CASH", start, end, flows)
    bank_flow = method_flow(database, "NEQUI", start, end, flows)
    receivables = pending_receivables(database, end)
    credits_granted = database.scalar(select(func.coalesce(func.sum(Credit.original_amount), 0)).where(Credit.created_at >= start, Credit.created_at < end)) or Decimal("0")
    return CashReconciliation(
        date=selected_date,
        cash=cash_flow.closing,
        bank=bank_flow.closing,
        receivables=receivables,
        total=cash_flow.closing + bank_flow.closing + receivables,
        cash_flow=cash_flow,
        bank_flow=bank_flow,
        receivables_opening=pending_receivables(database, start),
        credits_granted=credits_granted,
        credits_collected=cash_flow.credit_payments + bank_flow.credit_payments,
    )


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
        start = datetime.strptime(month, "%Y-%m").replace(tzinfo=BUSINESS_TZ)
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
    income_filters = [FinancialMovement.movement_type == "INCOME", FinancialMovement.income_type.is_distinct_from("OPENING_BALANCE")]
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
