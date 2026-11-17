"""Правила перевірки коду: інтерфейс Rule (стратегія), реєстр і каталог із 10 правил."""
from . import catalog  # noqa: F401  (імпорт реєструє правила AC001–AC010)
from .base import AnalysisContext, Finding, Rule
from .registry import all_rules, register, unregister

__all__ = ["AnalysisContext", "Finding", "Rule", "all_rules", "register", "unregister"]
