from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.core.config import settings
from app.db.session import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    database: Session = Depends(get_db),
) -> User:
    if credentials is None:
        if settings.environment != "production" and settings.allow_demo_access:
            demo_user = database.query(User).filter(User.email == "demo@localhost").first()
            if demo_user is None:
                demo_user = User(
                    full_name="Usuario de pruebas",
                    email="demo@localhost",
                    password_hash="demo-user-no-password",
                    role="ADMIN",
                    is_active=True,
                )
                database.add(demo_user)
                database.commit()
                database.refresh(demo_user)
            return demo_user
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from None

    user = database.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is not active")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator role required")
    return current_user