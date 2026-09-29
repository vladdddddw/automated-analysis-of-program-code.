"""Статичний аналізатор Python-коду на основі модуля ast.

Код НІКОЛИ не виконується: він лише розбирається в абстрактне синтаксичне дерево (AST),
яке потім обходиться, щоб знайти проблеми та порахувати метрики.
"""
import ast
import re
import time
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


_FUNC_NODES = (ast.FunctionDef, ast.AsyncFunctionDef)
_BLOCK_NODES = (ast.If, ast.For, ast.AsyncFor, ast.While, ast.With, ast.AsyncWith, ast.Try, ast.Match)
_TRY_NODES = tuple(t for t in (getattr(ast, "Try", None), getattr(ast, "TryStar", None)) if t)
_SECRET_RE = re.compile(r"(password|passwd|pwd|secret|token|api[_-]?key)", re.IGNORECASE)


# ----------------------------------------------------------------- метрики
def _walk_own(node: ast.AST):
    """Обхід вузлів функції без занурення у вкладені функції та класи (вони рахуються окремо)."""
    stack = list(ast.iter_child_nodes(node))
    while stack:
        cur = stack.pop()
        yield cur
        if isinstance(cur, (*_FUNC_NODES, ast.ClassDef, ast.Lambda)):
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
            if isinstance(s, (*_FUNC_NODES, ast.ClassDef)):
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


# ----------------------------------------------------------------- правила
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


def analyze_source(path: str, content: str, rules: dict[str, RuleConfig]) -> FileResult:
    text = content.replace("\r\n", "\n")
    lines = text.split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    loc = len(lines)
    sloc = sum(1 for ln in lines if ln.strip() and not ln.strip().startswith("#"))
    result = FileResult(path=path, content=content, loc=loc, sloc=sloc)

    try:
        tree = ast.parse(text, filename=path)
    except SyntaxError as e:
        result.syntax_error = f"Синтаксична помилка: {e.msg} (рядок {e.lineno or '?'})"
        return result
    except (ValueError, RecursionError):  # нульові байти, надто глибока вкладеність
        result.syntax_error = "Синтаксична помилка: код неможливо розібрати"
        return result

    def cfg(rule_id: str) -> RuleConfig | None:
        r = rules.get(rule_id)
        return r if r and r.enabled else None

    def add(rule_id: str, line: int, message: str):
        r = cfg(rule_id)
        if r:
            result.issues.append(IssueInfo(rule_id, r.severity, line, message))

    def threshold(rule_id: str, default: int) -> int:
        r = rules.get(rule_id)
        return (r.threshold if r and r.threshold else default)

    # --- функції та метрики
    for node in ast.walk(tree):
        if not isinstance(node, _FUNC_NODES):
            continue
        info = FunctionInfo(
            name=node.name, start_line=node.lineno, end_line=node.end_lineno or node.lineno,
            complexity=cyclomatic_complexity(node), nesting_depth=nesting_depth(node), params=count_params(node),
        )
        result.functions.append(info)

        length = info.end_line - info.start_line + 1
        if length > threshold("AC005", 50):
            add("AC005", node.lineno, f"Функція {node.name} має {length} рядків (поріг {threshold('AC005', 50)})")
        if info.complexity > threshold("AC006", 10):
            add("AC006", node.lineno, f"Цикломатична складність {info.complexity} перевищує поріг {threshold('AC006', 10)}")
        if info.nesting_depth > threshold("AC007", 4):
            add("AC007", node.lineno, f"Глибина вкладеності {info.nesting_depth} перевищує поріг {threshold('AC007', 4)}")
        if info.params > threshold("AC008", 5):
            add("AC008", node.lineno, f"Функція {node.name} має {info.params} параметрів (поріг {threshold('AC008', 5)})")
        defaults = [*node.args.defaults, *node.args.kw_defaults]
        if any(_is_mutable_default(d) for d in defaults if d is not None):
            add("AC003", node.lineno, f"Змінне значення за замовчуванням у функції {node.name}")
        if not node.name.startswith("_") and ast.get_docstring(node) is None:
            add("AC009", node.lineno, f"Функція {node.name} без docstring")

    result.functions.sort(key=lambda f: f.start_line)
    result.max_complexity = max((f.complexity for f in result.functions), default=0)
    result.max_nesting = max((f.nesting_depth for f in result.functions), default=0)

    # --- інші вузли
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            if not node.name.startswith("_") and ast.get_docstring(node) is None:
                add("AC009", node.lineno, f"Клас {node.name} без docstring")
        elif isinstance(node, ast.ExceptHandler):
            if node.type is None:
                add("AC002", node.lineno, "Порожній блок except без типу винятку")
            elif len(node.body) == 1 and isinstance(node.body[0], ast.Pass):
                add("AC002", node.lineno, "Блок except лише з pass: помилка мовчки ігнорується")
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in {"eval", "exec"}:
            add("AC004", node.lineno, f"Використано {node.func.id}() з довільним рядком")
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            value = node.value
            if isinstance(value, ast.Constant) and isinstance(value.value, str) and len(value.value) >= 3:
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                if any((n := _target_name(t)) and _SECRET_RE.search(n) for t in targets):
                    add("AC010", node.lineno, "Секрет записано безпосередньо в коді")

    for name, line in _unused_imports(tree):
        add("AC001", line, f"Імпорт {name} не використовується")

    result.issues.sort(key=lambda i: (i.line, i.rule_id))
    return result


def analyze_files(files: list[tuple[str, str]], rules: dict[str, RuleConfig]) -> AnalysisResult:
    started = time.perf_counter()
    results = [analyze_source(path, content, rules) for path, content in files]
    return AnalysisResult(files=results, duration_ms=max(1, round((time.perf_counter() - started) * 1000)))
