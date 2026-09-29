import os
import tempfile
from pathlib import Path

# Тестова БД: за замовчуванням тимчасовий файл SQLite; щоб перевірити на PostgreSQL,
# задайте змінну TEST_DATABASE_URL (сторінку буде очищено перед запуском).
_tmp = Path(tempfile.mkdtemp()) / "test.db"
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", f"sqlite:///{_tmp.as_posix()}")
os.environ["SECRET_KEY"] = "test-secret"
os.environ["SEED_DEMO_DATA"] = "true"
os.environ["STATIC_DIR"] = str(Path(tempfile.mkdtemp()) / "no-static")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:  # lifespan створює таблиці й демо-дані
        yield c


def _login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def student(client):
    return _login(client, "student@example.com", "student123")


@pytest.fixture(scope="session")
def teacher(client):
    return _login(client, "teacher@example.com", "teacher123")


@pytest.fixture(scope="session")
def admin(client):
    return _login(client, "admin@example.com", "admin123")
