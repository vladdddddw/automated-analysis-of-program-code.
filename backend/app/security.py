"""Автентифікація та авторизація: хешування паролів, JWT-токени, перевірка ролей."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .errors import ApiError
from .models import User

_ITERATIONS = 240_000
_bearer = HTTPBearer(auto_error=False)


# ------------------------------------------------------------------ паролі
def hash_password(password: str) -> str:
    """PBKDF2-HMAC-SHA256 із випадковою сіллю. Пароль у відкритому вигляді ніде не зберігається."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest.hex(), digest_hex)  # порівняння за сталий час


# ------------------------------------------------------------------ токени
def create_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user.id), "role": user.role.name, "iat": now, "exp": now + timedelta(minutes=settings.token_ttl_minutes)}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise ApiError(401, "Сесія завершилась, увійдіть знову") from exc
    except jwt.PyJWTError as exc:
        raise ApiError(401, "Недійсний токен") from exc


# ------------------------------------------------------------------ залежності FastAPI
def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise ApiError(401, "Потрібна автентифікація")
    payload = _decode(creds.credentials)
    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise ApiError(401, "Користувача не знайдено")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role.name != "admin":
        raise ApiError(403, "Змінювати правила може лише адміністратор")
    return user
