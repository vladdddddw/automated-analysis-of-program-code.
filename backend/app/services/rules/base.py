"""Інтерфейс стратегії перевірки коду (патерн Strategy) і контекст, який отримує кожне правило."""
import ast
from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import ClassVar

from ..metrics import FunctionInfo, RuleConfig


@dataclass(frozen=True)
class Finding:
    """Знайдена проблема: рядок і текст. Код правила й серйозність додає аналізатор (вони залежать від налаштувань у БД)."""
    line: int
    message: str


@dataclass
class AnalysisContext:
    """Усе, що потрібно правилу: дерево, функції з метриками та налаштування (порогів) правил."""
    tree: ast.AST
    functions: list[tuple[ast.AST, FunctionInfo]]
    config: dict[str, RuleConfig] = field(default_factory=dict)

    def threshold(self, rule_id: str, default: int) -> int:
        cfg = self.config.get(rule_id)
        return cfg.threshold if cfg and cfg.threshold else default


class Rule(ABC):
    """Стратегія: одне правило перевірки. Аналізатор (контекст) викликає лише check() і нічого не знає про конкретні правила."""

    rule_id: ClassVar[str]
    default_threshold: ClassVar[int | None] = None

    @abstractmethod
    def check(self, ctx: AnalysisContext) -> Iterator[Finding]:
        """Повертає всі проблеми, які це правило знайшло в коді."""

    def threshold(self, ctx: AnalysisContext) -> int:
        """Поріг правила: значення з БД або стандартне."""
        return ctx.threshold(self.rule_id, self.default_threshold)
