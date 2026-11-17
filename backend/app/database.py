"""Підключення до бази даних (SQLAlchemy)."""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

_is_sqlite = settings.database_url.startswith("sqlite")
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,  # перевіряє з'єднання перед використанням (важливо для безкоштовної БД на Render)
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)


if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _):
        """SQLite за замовчуванням не перевіряє зовнішні ключі й не виконує ON DELETE CASCADE."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


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
