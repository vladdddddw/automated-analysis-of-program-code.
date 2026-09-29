"""Реєстрація, вхід і поточний користувач."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..errors import ApiError
from ..models import Role, User
from ..schemas import Credentials, RegisterIn
from ..security import create_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def user_dict(u: User) -> dict:
    return {"id": u.id, "email": u.email, "role": u.role.name, "name": u.email.split("@")[0]}


@router.post("/register", status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.email == data.email)):
        raise ApiError(409, "Користувач із таким email уже існує")
    role = db.scalar(select(Role).where(Role.name == "user"))  # нові користувачі завжди «розробники»
    user = User(email=data.email, password_hash=hash_password(data.password), role_id=role.id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_token(user), "user": user_dict(user)}


@router.post("/login")
def login(data: Credentials, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email))
    now = datetime.now(timezone.utc)

    if user and user.locked_until:
        locked = user.locked_until if user.locked_until.tzinfo else user.locked_until.replace(tzinfo=timezone.utc)
        if locked > now:
            raise ApiError(429, "Забагато невдалих спроб входу. Спробуйте за кілька хвилин")

    if not user or not verify_password(data.password, user.password_hash):
        if user:
            user.failed_attempts += 1
            if user.failed_attempts >= settings.max_login_attempts:  # тимчасове блокування від підбору пароля
                user.locked_until = now + timedelta(minutes=settings.lock_minutes)
                user.failed_attempts = 0
            db.commit()
        raise ApiError(401, "Невірний email або пароль")  # однакове повідомлення, щоб не видавати, чи існує email

    user.failed_attempts = 0
    user.locked_until = None
    db.commit()
    return {"token": create_token(user), "user": user_dict(user)}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_dict(user)
