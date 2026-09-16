from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.dependencies import require_admin
from app.core.permissions import require_section
from app.core.security import verify_password
from app.db.session import get_db
from app.models import ExpenseCategory, FinancialMovement, User
from app.schemas.expenses import ExpenseCategoryCreate, ExpenseCategoryResponse, ExpenseCreate, ExpenseResponse, ExpensesResponse, SettleExpensesResponse

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("/categories", response_model=list[ExpenseCategoryResponse])
def list_categories(database: Session = Depends(get_db), _: User = Depends(require_section("egresos"))) -> list[ExpenseCategory]:
    return list(database.scalars(select(ExpenseCategory).where(ExpenseCategory.is_active.is_(True)).order_by(ExpenseCategory.name)))


@router.post("/categories", response_model=ExpenseCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(payload: ExpenseCategoryCreate, database: Session = Depends(get_db), _: User = Depends(require_section("egresos"))) -> ExpenseCategory:
    category = ExpenseCategory(name=payload.name.strip())
    database.add(category)
    try:
        database.commit()
    except IntegrityError:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una categoría con ese nombre") from None
    database.refresh(category)
    return category


@router.get("", response_model=ExpensesResponse)
def list_expenses(database: Session = Depends(get_db), _: User = Depends(require_section("egresos"))) -> ExpensesResponse:
    rows = database.execute(select(FinancialMovement, ExpenseCategory.name).join(ExpenseCategory, ExpenseCategory.id == FinancialMovement.expense_category_id).where(FinancialMovement.movement_type == "EXPENSE").order_by(FinancialMovement.created_at.desc()).limit(100)).all()
    return ExpensesResponse(expenses=[ExpenseResponse(id=movement.id, amount=movement.amount, payment_method=movement.payment_method or "CASH", category_name=category_name, product=movement.product, observation=movement.observation or movement.concept, created_at=movement.created_at, settled_at=movement.settled_at) for movement, category_name in rows])


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(payload: ExpenseCreate, database: Session = Depends(get_db), current_user: User = Depends(require_section("egresos"))) -> ExpenseResponse:
    category = database.get(ExpenseCategory, payload.category_id)
    if category is None or not category.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La categoría no está disponible")
    movement = FinancialMovement(user_id=current_user.id, movement_type="EXPENSE", amount=payload.amount, concept=payload.observation.strip(), payment_method=payload.payment_method, expense_category_id=category.id, product=payload.product.strip() if payload.product else None, observation=payload.observation.strip())
    database.add(movement)
    database.commit()
    database.refresh(movement)
    return ExpenseResponse(id=movement.id, amount=movement.amount, payment_method=movement.payment_method or payload.payment_method, category_name=category.name, product=movement.product, observation=movement.observation or payload.observation, created_at=movement.created_at, settled_at=movement.settled_at)


@router.post("/settle-pending", response_model=SettleExpensesResponse)
def settle_pending_expenses(database: Session = Depends(get_db), _: User = Depends(require_section("egresos"))) -> SettleExpensesResponse:
    now = datetime.now(timezone.utc)
    tomorrow = now.date() + timedelta(days=1)
    if tomorrow.month == now.month:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Los egresos pendientes solo se pueden restar el último día del mes")
    pending = database.scalars(select(FinancialMovement).where(FinancialMovement.movement_type == "EXPENSE", FinancialMovement.settled_at.is_(None)).with_for_update()).all()
    amount = sum((movement.amount for movement in pending), Decimal("0"))
    for movement in pending:
        movement.settled_at = now
    database.commit()
    return SettleExpensesResponse(count=len(pending), amount=amount, settled_at=now)


@router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    payload: ExpenseCreate,
    database: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ExpenseResponse:
    movement, category_name = database.execute(
        select(FinancialMovement, ExpenseCategory.name)
        .join(ExpenseCategory, ExpenseCategory.id == FinancialMovement.expense_category_id)
        .where(FinancialMovement.id == expense_id, FinancialMovement.movement_type == "EXPENSE")
    ).one_or_none() or (None, None)
    if movement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Egreso no encontrado")
    if movement.settled_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No se puede editar un egreso ya liquidado")
    category = database.get(ExpenseCategory, payload.category_id)
    if category is None or not category.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La categoría no está disponible")
    movement.amount = payload.amount
    movement.payment_method = payload.payment_method
    movement.expense_category_id = category.id
    movement.product = payload.product.strip() if payload.product else None
    movement.concept = payload.observation.strip()
    movement.observation = payload.observation.strip()
    database.commit()
    database.refresh(movement)
    return ExpenseResponse(
        id=movement.id,
        amount=movement.amount,
        payment_method=movement.payment_method or payload.payment_method,
        category_name=category.name,
        product=movement.product,
        observation=movement.observation or payload.observation,
        created_at=movement.created_at,
        settled_at=movement.settled_at,
    )


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, password: str, database: Session = Depends(get_db), current_user: User = Depends(require_admin)) -> None:
    if not verify_password(password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="La contraseña no es válida")
    movement = database.scalar(select(FinancialMovement).where(FinancialMovement.id == expense_id, FinancialMovement.movement_type == "EXPENSE"))
    if movement is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Egreso no encontrado")
    database.delete(movement)
    database.commit()