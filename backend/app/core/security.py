from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from app.core.config import settings

import bcrypt


def hash_password(password: str) -> str:
    encoded_password = password.encode("utf-8")
    if len(encoded_password) > 72:
        raise ValueError("Password cannot be longer than 72 bytes")
    return bcrypt.hashpw(encoded_password, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    encoded_password = password.encode("utf-8")
    if len(encoded_password) > 72:
        return False
    return bcrypt.checkpw(encoded_password, password_hash.encode("utf-8"))


def create_access_token(user_id: int, role: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "role": role, "exp": expires_at}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, str]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError as error:
        raise ValueError("Invalid access token") from error