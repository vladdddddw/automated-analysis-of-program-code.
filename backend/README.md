# Бекенд CodeInspector

FastAPI + SQLAlchemy + PostgreSQL. Повний опис, запуск і розгортання – у [README репозиторію](../README.md).

Швидко:

```bash
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload     # SQLite, http://localhost:8000/docs
pytest                            # 45 тестів
```

Тест на PostgreSQL: `TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/db pytest`
(таблиці в цій базі будуть перестворені!).

## Змінні середовища

| Змінна | За замовчуванням | Призначення |
|--------|------------------|-------------|
| `DATABASE_URL` | `sqlite:///./codeinspector.db` | адреса бази (Render підставляє сам) |
| `SECRET_KEY` | `dev-secret-change-me` | ключ підпису JWT (у продакшені обов’язково свій) |
| `APP_ENV` | `development` | `production` вмикає попередження про слабкий ключ |
| `SEED_DEMO_DATA` | `true` | створити демо-користувачів і два приклади аналізу |
| `CORS_ORIGINS` | `*` | дозволені джерела через кому |
| `TOKEN_TTL_MINUTES` | `720` | термін дії токена |
| `STATIC_DIR` | `backend/static` | папка зі зібраним фронтендом (у Docker-образі) |
