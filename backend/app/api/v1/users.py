from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user, require_admin
from app.core.permissions import SECTIONS, require_admin_or_viewer, user_sections
from app.core.security import hash_password
from app.db.session import get_db
from app.models import User, UserPermission
from app.schemas.users import SellerCreate, SellerResponse, SellerUpdate

router = APIRouter(prefix="/users", tags=["users"])


def seller_response(user: User) -> SellerResponse:
    return SellerResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        permissions=user_sections(user),
    )


def validate_permissions(permissions: list[str]) -> None:
    invalid = sorted(set(permissions) - set(SECTIONS))
    if invalid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Apartados inválidos: {', '.join(invalid)}")


@router.get("", response_model=list[SellerResponse])
def list_sellers(database: Session = Depends(get_db), _: User = Depends(require_admin_or_viewer)) -> list[SellerResponse]:
    sellers = database.scalars(select(User).where(User.role.in_(["SELLER", "VIEWER"])).order_by(User.full_name)).all()
    return [seller_response(seller) for seller in sellers]


@router.get("/available", response_model=list[SellerResponse])
def available_sellers(database: Session = Depends(get_db), _: User = Depends(get_current_user)) -> list[SellerResponse]:
    sellers = database.scalars(select(User).where(User.role == "SELLER", User.is_active.is_(True)).order_by(User.full_name)).all()
    return [seller_response(seller) for seller in sellers]


@router.post("", response_model=SellerResponse, status_code=status.HTTP_201_CREATED)
def create_seller(payload: SellerCreate, database: Session = Depends(get_db), _: User = Depends(require_admin)) -> SellerResponse:
    validate_permissions(payload.permissions)
    seller = User(full_name=payload.full_name.strip(), email=payload.email, password_hash=hash_password(payload.pin), role=payload.role, is_active=True)
    database.add(seller)
    try:
        database.flush()
        database.add_all(UserPermission(user_id=seller.id, section=section) for section in set(payload.permissions))
        database.commit()
    except IntegrityError:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un usuario con ese correo") from None
    database.refresh(seller)
    return seller_response(seller)


@router.patch("/{user_id}", response_model=SellerResponse)
def update_seller(user_id: int, payload: SellerUpdate, database: Session = Depends(get_db), _: User = Depends(require_admin)) -> SellerResponse:
    seller = database.get(User, user_id)
    if seller is None or seller.role != "SELLER":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendedor no encontrado")
    values = payload.model_dump(exclude_unset=True)
    permissions = values.pop("permissions", None)
    pin = values.pop("pin", None)
    if permissions is not None:
        validate_permissions(permissions)
        database.execute(delete(UserPermission).where(UserPermission.user_id == seller.id))
        database.add_all(UserPermission(user_id=seller.id, section=section) for section in set(permissions))
    if pin is not None:
        seller.password_hash = hash_password(pin)
    for field, value in values.items():
        setattr(seller, field, value.strip() if field in {"full_name", "email"} and isinstance(value, str) else value)
    try:
        database.commit()
    except IntegrityError:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe un usuario con ese correo") from None
    database.refresh(seller)
    return seller_response(seller)