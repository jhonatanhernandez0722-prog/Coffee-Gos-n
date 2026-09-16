from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import require_admin
from app.core.permissions import require_section
from app.db.session import get_db
from app.models import Credit, FinancialMovement, Liability, Product, Sale, SaleItem, User
from app.schemas.financial_reports import BalanceReport, CashReconciliation, LiabilityCreate, LiabilityResponse

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


@router.get("/balance", response_model=BalanceReport)
def balance_report(database: Session = Depends(get_db), _: User = Depends(require_section("balance"))) -> BalanceReport:
    cash = cash_balance(database, "CASH")
    bank = cash_balance(database, "NEQUI")
    receivables = pending_receivables(database)
    inventory = database.scalar(select(func.coalesce(func.sum(Product.stock * Product.acquisition_cost), 0)).where(Product.is_active.is_(True))) or Decimal("0")
    liabilities = database.scalars(select(Liability).order_by(Liability.status, Liability.due_date, Liability.created_at)).all()
    total_liabilities = sum((liability.amount for liability in liabilities if liability.status == "PENDING"), Decimal("0"))
    income = database.scalar(select(func.coalesce(func.sum(FinancialMovement.amount), 0)).where(FinancialMovement.movement_type == "INCOME", pending_credit_exists())) or Decimal("0")
    costs = database.scalar(select(func.coalesce(func.sum(SaleItem.quantity * SaleItem.unit_cost_snapshot), 0)).join(Sale, Sale.id == SaleItem.sale_id).where(~select(Credit.id).where(Credit.sale_id == Sale.id, Credit.status == "PENDING").exists())) or Decimal("0")
    expenses = database.scalar(select(func.coalesce(func.sum(FinancialMovement.amount), 0)).where(FinancialMovement.movement_type == "EXPENSE", FinancialMovement.settled_at.is_not(None))) or Decimal("0")
    total_assets = cash + bank + receivables + inventory
    return BalanceReport(cash=cash, bank=bank, receivables=receivables, inventory=inventory, total_assets=total_assets, liabilities=[liability_response(item) for item in liabilities], total_liabilities=total_liabilities, equity=total_assets - total_liabilities, income=income, costs=costs, expenses=expenses, profit=income - costs - expenses)


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
