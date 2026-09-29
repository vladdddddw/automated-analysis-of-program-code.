# CodeInspector

Вебсистема **автоматизованого аналізу програмного коду** (тема № 48): завантажуєте Python-код – отримуєте зауваження,
метрики складності, оцінку якості та поради щодо виправлення.

| Частина | Технології | Папка |
|---------|-----------|-------|
| Фронтенд | React 18, Vite, React Router | [`frontend/`](frontend) |
| Бекенд | Python 3.12, FastAPI, SQLAlchemy, модуль `ast`, JWT | [`backend/`](backend) |
| База даних | PostgreSQL (SQLite для розробки й тестів) | створюється бекендом автоматично |
| Розгортання | Docker, Render Blueprint | `Dockerfile`, `docker-compose.yml`, `render.yaml` |

Гілки: `lab6-7` – лише фронтенд з мок-даними (демо на GitHub Pages), `lab8-10` – повний сервіс з бекендом.

## Розгорнути на Render однією кнопкою

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/vladdddddw/automated-analysis-of-program-code./tree/lab8-10)

Якщо Render запитає гілку – оберіть **`lab8-10`**. Файл [`render.yaml`](render.yaml) сам створює базу PostgreSQL
і веб-сервіс (бекенд + готовий фронтенд в одному Docker-образі), підставляє адресу бази та генерує секретний ключ.
Покроково:

1. Render → **New +** → **Blueprint**.
2. Підключіть GitHub, виберіть цей репозиторій і гілку `lab8-10`.
3. Натисніть **Apply** та дочекайтесь статусу **Live** (перший запуск 3–6 хвилин).
4. Відкрийте адресу сервісу `https://codeinspector-….onrender.com`.

## Локальний запуск

```bash
docker compose up --build        # застосунок + PostgreSQL
```

Сайт: <http://localhost:8000> · документація API: <http://localhost:8000/docs> · перевірка: <http://localhost:8000/api/health>

Тестові облікові записи (створюються, якщо `SEED_DEMO_DATA=true`):

| Роль | Email | Пароль |
|------|-------|--------|
| Розробник | student@example.com | student123 |
| Викладач | teacher@example.com | teacher123 |
| Адміністратор | admin@example.com | admin123 |

### Розробка без Docker

```bash
# бекенд (SQLite, без окремої бази)
cd backend
python -m venv .venv && .venv\Scripts\activate      # Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload                        # http://localhost:8000
pytest                                               # тести

# фронтенд (в іншому терміналі)
cd frontend
npm install
set VITE_BACKEND=real&& set VITE_API_URL=http://localhost:8000&& npm run dev   # Linux/macOS: VITE_BACKEND=real VITE_API_URL=... npm run dev
```

Без змінних `VITE_*` фронтенд працює на мок-даних у браузері (як демо на GitHub Pages).

## Що вміє бекенд

- **Автентифікація**: реєстрація, вхід, JWT-токени, ролі (розробник, викладач, керівник, адміністратор), блокування
  після 5 невдалих входів, паролі лише у вигляді PBKDF2-хешів із сіллю.
- **Аналіз коду** (`ast`, код не виконується): 10 правил (безпека, надійність, супроводжуваність, стиль), метрики
  LOC/SLOC, цикломатична складність, вкладеність, кількість параметрів; оцінка якості 0–100.
- **Вхідні дані**: фрагмент, файли `.py`, архів `.zip` (захист від path traversal і zip-бомб, обмеження розмірів).
- **REST API** з валідацією, єдиним форматом помилок `{"status": 404, "message": "..."}` і документацією OpenAPI.
- **Права доступу**: розробник бачить лише свої аналізи, викладач/керівник/адміністратор – усі, правила змінює лише адміністратор.

## API коротко

| Метод | Адреса | Призначення |
|-------|--------|-------------|
| POST | `/api/auth/register`, `/api/auth/login` | реєстрація, вхід (повертає токен) |
| GET | `/api/auth/me` | поточний користувач |
| GET / POST | `/api/analyses` | історія / новий аналіз (JSON) |
| POST | `/api/analyses/archive` | новий аналіз з `.zip` (multipart) |
| GET / DELETE | `/api/analyses/{id}` | звіт / видалення |
| GET | `/api/analyses/{id}/export?format=json\|html` | експорт |
| GET | `/api/stats` | статистика для панелі |
| GET | `/api/rules` | список правил |
| PUT | `/api/rules/{id}` | змінити правило (адміністратор) |
| POST | `/api/rules/reset` | скинути правила (адміністратор) |
| GET | `/api/health` | стан сервісу |

## Структура

```
backend/
  app/
    main.py            точка входу FastAPI
    config.py          налаштування зі змінних середовища
    database.py        підключення до БД
    models.py          ORM-моделі (схема з лабораторної № 5)
    security.py        паролі, JWT, перевірка ролей
    errors.py          єдиний формат помилок
    seed.py            початкові дані
    routers/           auth.py, analyses.py, rules.py
    services/          analyzer.py (ast), analyses.py, archive.py, scoring.py, reports.py
  tests/               45 тестів (модульні й інтеграційні)
frontend/              React-застосунок
Dockerfile             збірка фронтенду й бекенду в один образ
docker-compose.yml     локальний запуск із PostgreSQL
render.yaml            Blueprint для Render
```
