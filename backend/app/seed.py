"""Створення таблиць і початкових даних (виконується під час запуску сервера; повторний запуск безпечний)."""
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import demo_data as demo
from .config import settings
from .database import Base, SessionLocal, engine
from .models import Role, Rule, RuleSetting, Severity, User
from .security import hash_password
from .services.analyses import rule_configs, save_analysis
from .services.analyzer import analyze_files

log = logging.getLogger("codeinspector")


def init_db() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        _seed_reference(db)
        if settings.seed_demo_data:
            _seed_demo(db)
        db.commit()


def _seed_reference(db: Session) -> None:
    if not db.scalar(select(Role.id).limit(1)):
        db.add_all(Role(name=n) for n in demo.ROLES)
    if not db.scalar(select(Severity.id).limit(1)):
        db.add_all(Severity(id=i, name=n, rank=r) for i, n, r in demo.SEVERITIES)
    db.flush()
    if not db.scalar(select(Rule.id).limit(1)):
        sev = {s.name: s.id for s in db.scalars(select(Severity))}
        for rid, name, desc, cat, sev_name, thr, rec in demo.RULES:
            db.add(Rule(id=rid, name=name, description=desc, category=cat, default_severity_id=sev[sev_name],
                        default_threshold=thr, recommendation=rec, setting=RuleSetting(enabled=True, threshold=thr)))
    db.flush()


def _seed_demo(db: Session) -> None:
    roles = {r.name: r.id for r in db.scalars(select(Role))}
    for email, password, role in demo.DEMO_USERS:
        if not db.scalar(select(User.id).where(User.email == email)):
            db.add(User(email=email, password_hash=hash_password(password), role_id=roles[role]))
    db.flush()

    student = db.scalar(select(User).where(User.email == "student@example.com"))
    if student and not student.analyses:
        cfg = rule_configs(db)
        for title, code in (("lab2_solution.py (v1)", demo.SAMPLE_CODE_V1), ("lab2_solution.py (v2)", demo.SAMPLE_CODE_V2)):
            result = analyze_files([("lab2_solution.py", code)], cfg)
            save_analysis(db, student, title, "file", result)
        log.info("Створено демонстраційні аналізи")
