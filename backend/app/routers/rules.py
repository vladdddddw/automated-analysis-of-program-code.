"""Каталог правил. Переглядати може кожен авторизований користувач, змінювати – лише адміністратор."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..errors import ApiError
from ..models import Rule, RuleSetting, User
from ..schemas import RulePatch
from ..security import get_current_user, require_admin

router = APIRouter(prefix="/api/rules", tags=["rules"])


def rule_dict(r: Rule) -> dict:
    s = r.setting
    return {
        "id": r.id, "name": r.name, "description": r.description, "category": r.category,
        "severity": r.default_severity.name, "threshold": s.threshold if s else r.default_threshold,
        "enabled": s.enabled if s else True, "recommendation": r.recommendation,
    }


@router.get("")
def list_rules(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [rule_dict(r) for r in db.scalars(select(Rule).order_by(Rule.id))]


@router.put("/{rule_id}")
def update_rule(rule_id: str, patch: RulePatch, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    rule = db.get(Rule, rule_id)
    if rule is None:
        raise ApiError(404, "Правило не знайдено")
    if patch.threshold is not None and rule.default_threshold is None:
        raise ApiError(422, "Для цього правила поріг не передбачений")
    if rule.setting is None:
        rule.setting = RuleSetting(enabled=True, threshold=rule.default_threshold)
    if patch.enabled is not None:
        rule.setting.enabled = patch.enabled
    if patch.threshold is not None:
        rule.setting.threshold = patch.threshold
    rule.setting.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rule)
    return rule_dict(rule)


@router.post("/reset")
def reset_rules(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    for r in db.scalars(select(Rule)):
        if r.setting is None:
            r.setting = RuleSetting()
        r.setting.enabled = True
        r.setting.threshold = r.default_threshold
    db.commit()
    return [rule_dict(r) for r in db.scalars(select(Rule).order_by(Rule.id))]
