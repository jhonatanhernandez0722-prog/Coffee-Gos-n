from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.dependencies import get_current_user
from app.core.security import create_access_token, verify_password
from app.core.permissions import user_sections
from app.db.session import get_db
from app.models import User
from app.schemas.auth import LoginRequest, LoginResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, database: Session = Depends(get_db)) -> LoginResponse:
    user = database.query(User).filter(User.email == payload.email, User.is_active.is_(True)).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return LoginResponse(
        access_token=create_access_token(user.id, user.role),
        user=UserResponse(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            permissions=user_sections(user),
        ),
    )


@router.get("/me", response_model=UserResponse)
def current_user(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        permissions=user_sections(current_user),
    )