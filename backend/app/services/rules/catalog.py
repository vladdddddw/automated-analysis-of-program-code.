"""Каталог правил AC001–AC010: кожне правило – окремий клас (конкретна стратегія)."""
import ast
import re
from collections.abc import Iterator

from .base import AnalysisContext, Finding, Rule
from .registry import register

_SECRET_RE = re.compile(r"(password|passwd|pwd|secret|token|api[_-]?key)", re.IGNORECASE)


def _unused_imports(tree: ast.AST):
    bound = []  # (ім'я, рядок)
    for n in ast.walk(tree):
        if isinstance(n, ast.Import):
            for al in n.names:
                bound.append(((al.asname or al.name.split(".")[0]), n.lineno))
        elif isinstance(n, ast.ImportFrom):
            if n.module == "__future__":
                continue
            for al in n.names:
                if al.name != "*":
                    bound.append(((al.asname or al.name), n.lineno))
    used = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)}
    # імена в __all__ теж вважаються використаними
    for n in ast.walk(tree):
        if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "__all__" for t in n.targets):
            if isinstance(n.value, (ast.List, ast.Tuple)):
                used |= {e.value for e in n.value.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)}
    return [(name, line) for name, line in bound if name not in used]


def _is_mutable_default(node: ast.AST | None) -> bool:
    if isinstance(node, (ast.List, ast.Dict, ast.Set, ast.ListComp, ast.DictComp, ast.SetComp)):
        return True
    return isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in {"list", "dict", "set"}


def _target_name(t: ast.AST) -> str | None:
    if isinstance(t, ast.Name):
        return t.id
    if isinstance(t, ast.Attribute):
        return t.attr
    return None


@register
class UnusedImportRule(Rule):
    """Імпорт, ім'я з якого ніде не використовується."""

    rule_id = "AC001"

    def check(self, ctx: AnalysisContext) -> Iterator[Finding]:
        """Повертає знайдені проблеми."""
        for name, line in _unused_imports(ctx.tree):
            yield Finding(line, f"Імпорт {name} не використовується")


@register
class EmptyExceptRule(Rule):
    """Блок except без типу винятку або лише з pass."""

    rule_id = "AC002"

    def check(self, ctx: AnalysisContext) -> Iterator[Finding]:
        """Повертає знайдені проблеми."""
        for node in ast.walk(ctx.tree):
            if not isinstance(node, ast.ExceptHandler):
                continue
            if node.type is None:
                yield Finding(node.lineno, "Порожній блок except без типу винятку")
            elif len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
                yield Finding(node.lineno, "Блок except лише з pass: помилка мовчки ігнорується")


@register
class MutableDefaultRule(Rule):
    """Список, словник чи множина як значення параметра за замовчуванням."""

    rule_id = "AC003"

    def check(self, ctx: AnalysisContext) -> Iterator[Finding]:
        """Повертає знайдені проблеми."""
        for node, _ in ctx.functions:
            defaults = [*node.args.defaults, *node.args.kw_defaults]
            if any(_is_mutable_default(d) for d in defaults if d is not None):
                yield Finding(node.lineno, f"Змінне значення за замовчуванням у функції {node.name}")


@register
class EvalExecRule(Rule):
    """Виклик eval() або exec()."""

    rule_id = "AC004"

    def check(self, ctx: AnalysisContext) -> Iterator[Finding]:
        """Повертає знайдені проблеми."""
        for node in ast.walk(ctx.tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in {"eval", "exec"}:
                yield Finding(node.lineno, f"Використано {node.func.id}() з довільним рядком")


@register
class LongFunctionRule(Rule):
    """Функція довша за поріг (рядків)."""

    rule_id = "AC005"
    default_threshold = 50

    def check(self, ctx: AnalysisContext) -> Iterator[Finding]:
        """Повертає знайдені проблеми."""
        limit = self.threshold(ctx)
        for node, info in ctx.functions:
            length = info.end_line - info.start_line + 1
            if length > limit:
                yield Finding(node.lineno, f"Функція {node.name} має {length} рядків (поріг {limit})")


@register
class HighComplexityRule(Rule):
    """Цикломатична складність функції вища за поріг."""

    rule_id = "AC006"
    default_threshold = 10

    def check(self, ctx: AnalysisContext) -> Iterator[Finding]:
        """Повертає знайдені проблеми."""
        limit = self.threshold(ctx)
        for node, info in ctx.functions:
            if info.complexity > limit:
                yield Finding(node.lineno, f"Цикломатична складність {info.complexity} перевищує поріг {limit}")


@register
class DeepNestingRule(Rule):
    """Глибина вкладеності блоків вища за поріг."""

    rule_id = "AC007"
    default_threshold = 4

    def check(self, ctx: AnalysisContext) -> Iterator[Finding]:
        """Повертає знайдені проблеми."""
        limit = self.threshold(ctx)
        for node, info in ctx.functions:
            if info.nesting_depth > limit:
                yield Finding(node.lineno, f"Глибина вкладеності {info.nesting_depth} перевищує поріг {limit}")


@register
class TooManyParamsRule(Rule):
    """Кількість параметрів функції вища за поріг."""

    rule_id = "AC008"
    default_threshold = 5

    def check(self, ctx: AnalysisContext) -> Iterator[Finding]:
        """Повертає знайдені проблеми."""
        limit = self.threshold(ctx)
        for node, info in ctx.functions:
            if info.params > limit:
                yield Finding(node.lineno, f"Функція {node.name} має {info.params} параметрів (поріг {limit})")


@register
class MissingDocstringRule(Rule):
    """Публічна функція чи клас без документаційного рядка."""

    rule_id = "AC009"

    def check(self, ctx: AnalysisContext) -> Iterator[Finding]:
        """Повертає знайдені проблеми."""
        for node, _ in ctx.functions:
            if not node.name.startswith("_") and ast.get_docstring(node) is None:
                yield Finding(node.lineno, f"Функція {node.name} без docstring")
        for node in ast.walk(ctx.tree):
            if isinstance(node, ast.ClassDef) and not node.name.startswith("_") and ast.get_docstring(node) is None:
                yield Finding(node.lineno, f"Клас {node.name} без docstring")


@register
class HardcodedSecretRule(Rule):
    """Пароль, токен чи ключ, записані рядком безпосередньо в коді."""

    rule_id = "AC010"

    def check(self, ctx: AnalysisContext) -> Iterator[Finding]:
        """Повертає знайдені проблеми."""
        for node in ast.walk(ctx.tree):
            if not isinstance(node, (ast.Assign, ast.AnnAssign)):
                continue
            value = node.value
            if isinstance(value, ast.Constant) and isinstance(value.value, str) and len(value.value) >= 3:
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                if any((name := _target_name(t)) and _SECRET_RE.search(name) for t in targets):
                    yield Finding(node.lineno, "Секрет записано безпосередньо в коді")

