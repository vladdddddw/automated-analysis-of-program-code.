"""Лабораторна 11. Інтеграційне тестування: серверна логіка ⇄ база даних.

Перевіряється взаємодія шару сервісів із реальною БД через ORM (SQLAlchemy). За замовчуванням
використовується тимчасова база SQLite; щоб перевірити на PostgreSQL, задайте TEST_DATABASE_URL.
"""
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import Analysis, Function, Issue, Role, RuleSetting, SourceFile, User
from app.security import hash_password
from app.services import analyses as svc
from app.services.analyzer import analyze_files

CODE = (
    "import os\n"
    "def process(data, cache=[]):\n"
    "    result = eval(data)\n"
    "    return result\n"
)


@pytest.fixture()
def db(client):  # client створює таблиці й початкові дані
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def student(db):
    return db.scalar(select(User).where(User.email == "student@example.com"))


def count(db, model, **where):
    q = select(func.count()).select_from(model)
    for col, val in where.items():
        q = q.where(getattr(model, col) == val)
    return db.scalar(q)


def test_it001_analysis_is_saved_and_can_be_read_back(db):
    """IT-001: результат аналізу зберігається в БД і читається за ідентифікатором разом із дочірніми записами."""
    result = analyze_files([("pkg/mod.py", CODE)], svc.rule_configs(db))
    saved = svc.save_analysis(db, student(db), "IT-001", "snippet", result)

    db.expire_all()
    loaded = db.get(Analysis, saved.id)
    assert loaded.title == "IT-001" and loaded.user.email == "student@example.com"
    assert [f.file_path for f in loaded.files] == ["pkg/mod.py"]
    assert len(loaded.files[0].functions) == 1
    rule_ids = {i.rule_id for i in loaded.files[0].issues}
    assert {"AC001", "AC003", "AC004"} <= rule_ids
    assert any(i.severity.name == "critical" for i in loaded.files[0].issues)  # eval → критична серйозність


def test_it002_cascade_delete_removes_dependent_rows(db):
    """IT-002: видалення аналізу каскадно видаляє файли, функції та зауваження."""
    result = analyze_files([("a.py", CODE), ("b.py", "x = 1\n")], svc.rule_configs(db))
    saved = svc.save_analysis(db, student(db), "IT-002", "file", result)
    file_ids = [f.id for f in saved.files]
    assert count(db, SourceFile, analysis_id=saved.id) == 2

    db.delete(db.get(Analysis, saved.id))
    db.commit()

    assert count(db, Analysis, id=saved.id) == 0
    assert count(db, SourceFile, analysis_id=saved.id) == 0
    assert db.scalar(select(func.count()).select_from(Function).where(Function.file_id.in_(file_ids))) == 0
    assert db.scalar(select(func.count()).select_from(Issue).where(Issue.file_id.in_(file_ids))) == 0


def test_it003_rule_threshold_from_database_changes_analysis(db):
    """IT-003: поріг правила, збережений у БД, впливає на результат аналізатора."""
    code = "def f():\n    '''d'''\n" + "    x = 1\n" * 10
    before = analyze_files([("t.py", code)], svc.rule_configs(db))
    assert "AC005" not in [i.rule_id for i in before.files[0].issues]  # поріг за замовчуванням 50 рядків

    setting = db.get(RuleSetting, "AC005")
    old = setting.threshold
    setting.threshold = 5
    db.commit()
    try:
        after = analyze_files([("t.py", code)], svc.rule_configs(db))
        assert "AC005" in [i.rule_id for i in after.files[0].issues]
    finally:
        setting.threshold = old
        db.commit()


def test_it004_database_enforces_unique_email(db):
    """IT-004: обмеження UNIQUE на рівні БД не дозволяє створити двох користувачів з однаковим email."""
    role = db.scalar(select(Role).where(Role.name == "user"))
    db.add(User(email="unique.check@example.com", password_hash=hash_password("Secret123"), role_id=role.id))
    db.commit()
    db.add(User(email="unique.check@example.com", password_hash=hash_password("Secret123"), role_id=role.id))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert count(db, User, email="unique.check@example.com") == 1
