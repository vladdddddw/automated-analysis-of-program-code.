"""Типи результатів аналізу та обчислення метрик коду (LOC, цикломатична складність, вкладеність, параметри).

Модуль не знає про правила перевірки: правила (app/services/rules) залежать від нього, а не навпаки.
"""
import ast
from dataclasses import dataclass, field

# Правила з порогами й серйозністю приходять із БД у вигляді {rule_id: RuleConfig}


@dataclass
class RuleConfig:
    enabled: bool = True
    severity: str = "medium"
    threshold: int | None = None


@dataclass
class FunctionInfo:
    name: str
    start_line: int
    end_line: int
    complexity: int
    nesting_depth: int
    params: int


@dataclass
class IssueInfo:
    rule_id: str
    severity: str
    line: int
    message: str


@dataclass
class FileResult:
    path: str
    content: str
    loc: int
    sloc: int
    max_complexity: int = 0
    max_nesting: int = 0
    syntax_error: str | None = None
    functions: list[FunctionInfo] = field(default_factory=list)
    issues: list[IssueInfo] = field(default_factory=list)


@dataclass
class AnalysisResult:
    files: list[FileResult]
    duration_ms: int

    @property
    def status(self) -> str:
        # «failed», лише якщо жоден файл не вдалося розібрати
        return "failed" if self.files and all(f.syntax_error for f in self.files) else "done"


FUNC_NODES = (ast.FunctionDef, ast.AsyncFunctionDef)
_BLOCK_NODES = (ast.If, ast.For, ast.AsyncFor, ast.While, ast.With, ast.AsyncWith, ast.Try, ast.Match)
_TRY_NODES = tuple(t for t in (getattr(ast, "Try", None), getattr(ast, "TryStar", None)) if t)


def _walk_own(node: ast.AST):
    """Обхід вузлів функції без занурення у вкладені функції та класи (вони рахуються окремо)."""
    stack = list(ast.iter_child_nodes(node))
    while stack:
        cur = stack.pop()
        yield cur
        if isinstance(cur, (*FUNC_NODES, ast.ClassDef, ast.Lambda)):
            continue
        stack.extend(ast.iter_child_nodes(cur))


def cyclomatic_complexity(func: ast.AST) -> int:
    """Цикломатична складність Маккейба: 1 + кількість точок розгалуження."""
    score = 1
    for n in _walk_own(func):
        if isinstance(n, (ast.If, ast.For, ast.AsyncFor, ast.While, ast.IfExp, ast.ExceptHandler)):
            score += 1
        elif isinstance(n, ast.BoolOp):
            score += len(n.values) - 1
        elif isinstance(n, ast.comprehension):
            score += 1 + len(n.ifs)
        elif isinstance(n, ast.match_case):
            score += 1
    return score


def nesting_depth(func: ast.AST) -> int:
    """Найбільша кількість вкладених блоків (if/for/while/try/with), що охоплюють якийсь оператор."""
    best = 0

    def visit(stmts, depth):
        nonlocal best
        for s in stmts:
            if isinstance(s, (*FUNC_NODES, ast.ClassDef)):
                continue
            best = max(best, depth)
            if isinstance(s, ast.If):
                visit(s.body, depth + 1)
                # elif – це вкладений If в orelse, глибини він не додає
                if len(s.orelse) == 1 and isinstance(s.orelse[0], ast.If):
                    visit(s.orelse, depth)
                else:
                    visit(s.orelse, depth + 1)
            elif isinstance(s, _TRY_NODES):
                visit(s.body, depth + 1)
                for h in s.handlers:
                    visit(h.body, depth + 1)
                visit(s.orelse, depth + 1)
                visit(s.finalbody, depth + 1)
            elif isinstance(s, ast.Match):
                for case in s.cases:
                    visit(case.body, depth + 1)
            elif isinstance(s, _BLOCK_NODES):
                visit(s.body, depth + 1)
                visit(getattr(s, "orelse", []), depth + 1)

    visit(func.body, 0)
    return best


def count_params(func: ast.AST) -> int:
    a = func.args
    names = [x.arg for x in (*a.posonlyargs, *a.args, *a.kwonlyargs)]
    count = len([n for n in names if n not in {"self", "cls"}])
    return count + (1 if a.vararg else 0) + (1 if a.kwarg else 0)


def function_info(node: ast.AST) -> FunctionInfo:
    """Метрики однієї функції."""
    return FunctionInfo(
        name=node.name, start_line=node.lineno, end_line=node.end_lineno or node.lineno,
        complexity=cyclomatic_complexity(node), nesting_depth=nesting_depth(node), params=count_params(node),
    )
