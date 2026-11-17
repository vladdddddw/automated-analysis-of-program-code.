# Бекенд CodeInspector

FastAPI + SQLAlchemy + PostgreSQL. Повний опис, запуск і розгортання – у [README репозиторію](../README.md).

Швидко:

```bash
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload     # SQLite, http://localhost:8000/docs
pytest                            # 86 тестів (лаби 8–12)
```

Тест на PostgreSQL: `TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/db pytest`
(таблиці в цій базі будуть перестворені!).

### Функціональні тести працюючого сервісу (лабораторна 11)

`tests/functional/run_functional.py` виконує 21 тест-кейс методом «чорної скриньки»: частину через REST API, частину –
через інтерфейс у браузері Chrome (Playwright). Сервер має працювати, а фронтенд – бути зібраним (`STATIC_DIR`).

```bash
pip install playwright
set BASE_URL=http://localhost:8000
python tests/functional/run_functional.py --json results.json --shots shots
```

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

## Архітектура (лабораторна 12)

- **Strategy** – правила перевірки: `app/services/rules/` (інтерфейс `Rule`, 10 класів у `catalog.py`, реєстр).
  Нове правило: клас із `@register`, аналізатор змінювати не потрібно.
- **Factory Method** – експорт звітів: `app/services/exporters.py` (`ReportCreator` → `JsonReportCreator`,
  `HtmlReportCreator`, `CsvReportCreator`; формат вибирає `get_creator(format)`).
- Еталонні тести `tests/test_lab12_golden.py` порівнюють результати з еталоном, знятим до рефакторингу.
