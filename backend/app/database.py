"""Підключення до бази даних (SQLAlchemy)."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

_is_sqlite = settings.database_url.startswith("sqlite")
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,  # перевіряє з'єднання перед використанням (важливо для безкоштовної БД на Render)
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """Залежність FastAPI: відкриває сесію на час запиту й закриває після нього."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
