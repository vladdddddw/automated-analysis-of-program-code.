"""Реєстр правил: нове правило підключається декоратором @register, код аналізатора змінювати не потрібно."""
from .base import Rule

_RULES: list[Rule] = []


def register(cls: type[Rule]) -> type[Rule]:
    """Створює екземпляр правила й додає його в реєстр (кожен rule_id – лише один раз)."""
    rule = cls()
    if any(r.rule_id == rule.rule_id for r in _RULES):
        raise ValueError(f"Правило {rule.rule_id} уже зареєстроване")
    _RULES.append(rule)
    return cls


def unregister(rule_id: str) -> None:
    """Видаляє правило з реєстру (потрібне переважно в тестах)."""
    _RULES[:] = [r for r in _RULES if r.rule_id != rule_id]


def all_rules() -> tuple[Rule, ...]:
    return tuple(_RULES)
