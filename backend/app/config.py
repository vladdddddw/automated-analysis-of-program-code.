"""Налаштування застосунку. Значення беруться зі змінних середовища."""
import os
from dataclasses import dataclass
from pathlib import Path


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./codeinspector.db")
    # Render та Heroku віддають адресу у вигляді postgres:// або postgresql://,
    # а SQLAlchemy потрібен явний драйвер.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]
    return url


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = _database_url()
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-change-me")
    token_ttl_minutes: int = int(os.getenv("TOKEN_TTL_MINUTES", "720"))
    seed_demo_data: bool = _bool("SEED_DEMO_DATA", True)
    cors_origins: tuple = tuple(o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip())
    # папка зі зібраним фронтендом (у Docker-образі), якщо існує – віддається з кореня сайту
    static_dir: Path = Path(os.getenv("STATIC_DIR", str(Path(__file__).resolve().parent.parent / "static")))

    # обмеження безпеки
    max_code_bytes: int = 1_000_000          # сумарний розмір коду в одному запиті
    max_archive_bytes: int = 10_000_000      # розмір завантаженого архіву
    max_archive_files: int = 200             # кількість файлів .py в архіві
    max_login_attempts: int = 5              # невдалих входів до тимчасового блокування
    lock_minutes: int = 5

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()
