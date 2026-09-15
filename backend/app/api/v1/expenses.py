from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.permissions import require_section
from app.db.session import get_db
from app.models import ExpenseCategory, FinancialMovement, User
from app.schemas.expenses import ExpenseCategoryCreate, ExpenseCategoryResponse, ExpenseCreate, ExpenseResponse, ExpensesResponse

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
    return ExpensesResponse(expenses=[ExpenseResponse(id=movement.id, amount=movement.amount, payment_method=movement.payment_method or "CASH", category_name=category_name, observation=movement.observation or movement.concept, created_at=movement.created_at) for movement, category_name in rows])


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(payload: ExpenseCreate, database: Session = Depends(get_db), current_user: User = Depends(require_section("egresos"))) -> ExpenseResponse:
    category = database.get(ExpenseCategory, payload.category_id)
    if category is None or not category.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La categoría no está disponible")
    movement = FinancialMovement(user_id=current_user.id, movement_type="EXPENSE", amount=payload.amount, concept=payload.observation.strip(), payment_method=payload.payment_method, expense_category_id=category.id, observation=payload.observation.strip())
    database.add(movement)
    database.commit()
    database.refresh(movement)
    return ExpenseResponse(id=movement.id, amount=movement.amount, payment_method=movement.payment_method or payload.payment_method, category_name=category.name, observation=movement.observation or payload.observation, created_at=movement.created_at)