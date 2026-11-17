"""Статичний аналізатор Python-коду на основі модуля ast.

Код НІКОЛИ не виконується: він лише розбирається в абстрактне синтаксичне дерево (AST), яке обходять правила
(патерн Strategy, див. app/services/rules) і метрики (app/services/metrics).

Аналізатор – контекст патерна: він розбирає код, рахує метрики функцій і по черзі викликає кожне ввімкнене правило
через спільний інтерфейс Rule.check(). Про конкретні правила він нічого не знає.
"""
import ast
import time

from .metrics import (
    FUNC_NODES,
    AnalysisResult,
    FileResult,
    FunctionInfo,
    IssueInfo,
    RuleConfig,
    count_params,
    cyclomatic_complexity,
    function_info,
    nesting_depth,
)
from .rules import AnalysisContext, all_rules

__all__ = ["AnalysisResult", "FileResult", "FunctionInfo", "IssueInfo", "RuleConfig", "analyze_files", "analyze_source",
           "count_params", "cyclomatic_complexity", "nesting_depth"]


def _split_lines(content: str) -> tuple[str, int, int]:
    """Нормалізований текст, кількість рядків (LOC) і непорожніх рядків без коментарів (SLOC)."""
    text = content.replace("\r\n", "\n")
    lines = text.split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    sloc = sum(1 for ln in lines if ln.strip() and not ln.strip().startswith("#"))
    return text, len(lines), sloc


def _parse(text: str, path: str) -> tuple[ast.AST | None, str | None]:
    """Дерево розбору або повідомлення про синтаксичну помилку."""
    try:
        return ast.parse(text, filename=path), None
    except SyntaxError as e:
        return None, f"Синтаксична помилка: {e.msg} (рядок {e.lineno or '?'})"
    except (ValueError, RecursionError):  # нульові байти, надто глибока вкладеність
        return None, "Синтаксична помилка: код неможливо розібрати"


def analyze_source(path: str, content: str, rules: dict[str, RuleConfig]) -> FileResult:
    text, loc, sloc = _split_lines(content)
    result = FileResult(path=path, content=content, loc=loc, sloc=sloc)
    tree, error = _parse(text, path)
    if tree is None:
        result.syntax_error = error
        return result

    functions = [(n, function_info(n)) for n in ast.walk(tree) if isinstance(n, FUNC_NODES)]
    result.functions = sorted((info for _, info in functions), key=lambda f: f.start_line)
    result.max_complexity = max((f.complexity for f in result.functions), default=0)
    result.max_nesting = max((f.nesting_depth for f in result.functions), default=0)

    ctx = AnalysisContext(tree=tree, functions=functions, config=rules)
    for rule in all_rules():
        cfg = rules.get(rule.rule_id)
        if cfg is None or not cfg.enabled:
            continue
        result.issues.extend(IssueInfo(rule.rule_id, cfg.severity, f.line, f.message) for f in rule.check(ctx))
    result.issues.sort(key=lambda i: (i.line, i.rule_id))
    return result


def analyze_files(files: list[tuple[str, str]], rules: dict[str, RuleConfig]) -> AnalysisResult:
    started = time.perf_counter()
    results = [analyze_source(path, content, rules) for path, content in files]
    return AnalysisResult(files=results, duration_ms=max(1, round((time.perf_counter() - started) * 1000)))
