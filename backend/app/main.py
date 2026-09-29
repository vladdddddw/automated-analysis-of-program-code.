"""Точка входу FastAPI-застосунку CodeInspector."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import settings
from .database import engine
from .errors import install_error_handlers
from .routers import analyses, auth, rules
from .seed import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("codeinspector")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.is_production and settings.secret_key == "dev-secret-change-me":
        log.warning("SECRET_KEY не задано! Встановіть власний секрет у змінних середовища.")
    init_db()  # створює таблиці й початкові дані
    yield


app = FastAPI(title="CodeInspector API", version="1.0.0", lifespan=lifespan,
              description="Серверна частина системи автоматизованого аналізу програмного коду (лабораторна 8-10).")

# Автентифікація йде через заголовок Authorization (не через cookie), тому CORS безпечно відкритий для кліентів.
app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])
install_error_handlers(app)

app.include_router(auth.router)
app.include_router(analyses.router)
app.include_router(rules.router)


@app.get("/api/health", tags=["service"])
def health():
    """Перевірка стану сервісу й підключення до БД (використовується Render для health check)."""
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok", "version": app.version}


# Якщо поруч є зібраний фронтенд (Docker-образ) – віддаємо його з кореня сайту.
if settings.static_dir.is_dir():
    app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="frontend")
