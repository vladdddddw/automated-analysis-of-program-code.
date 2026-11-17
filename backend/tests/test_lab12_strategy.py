"""Лабораторна 12. Патерн Strategy: правила перевірки як взаємозамінні стратегії.

Тести перевіряють кожне правило окремо (без аналізатора й БД), реєстр правил та розширюваність без зміни аналізатора.
"""
import ast

import pytest

from app.services.analyzer import analyze_source
from app.services.metrics import RuleConfig, function_info
from app.services.rules import AnalysisContext, Finding, Rule, all_rules, register, unregister
from app.services.rules import catalog as c


def run_rule(rule_cls, code: str, config=None) -> list[Finding]:
    """Запускає одне правило напряму, як це робить аналізатор, але без нього."""
    tree = ast.parse(code)
    funcs = [(n, function_info(n)) for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    return list(rule_cls().check(AnalysisContext(tree=tree, functions=funcs, config=config or {})))


# (клас правила, код із проблемою, код без проблеми)
CASES = [
    (c.UnusedImportRule, "import os\n", "import os\nprint(os.name)\n"),
    (c.EmptyExceptRule, "try:\n    pass\nexcept:\n    pass\n", "try:\n    pass\nexcept ValueError as e:\n    print(e)\n"),
    (c.MutableDefaultRule, "def f(a=[]):\n    '''d'''\n", "def f(a=None):\n    '''d'''\n"),
    (c.EvalExecRule, "x = eval('1')\n", "x = int('1')\n"),
    (c.LongFunctionRule, "def f():\n    '''d'''\n" + "    x = 1\n" * 55, "def f():\n    '''d'''\n    x = 1\n"),
    (c.HighComplexityRule, "def f(a):\n    '''d'''\n" + "    if a:\n        pass\n" * 11, "def f(a):\n    '''d'''\n    return a\n"),
    (c.DeepNestingRule, "def f(a):\n    '''d'''\n    if a:\n        if a:\n            if a:\n                if a:\n                    if a:\n                        pass\n",
     "def f(a):\n    '''d'''\n    if a:\n        pass\n"),
    (c.TooManyParamsRule, "def f(a, b, c, d, e, g):\n    '''d'''\n", "def f(a, b):\n    '''d'''\n"),
    (c.MissingDocstringRule, "def f():\n    pass\n", "def f():\n    '''d'''\n"),
    (c.HardcodedSecretRule, "PASSWORD = 'admin12345'\n", "PASSWORD = os.environ['P']\n"),
]


@pytest.mark.parametrize("rule_cls,bad,good", CASES, ids=[cls.rule_id for cls, _, _ in CASES])
def test_each_rule_works_in_isolation(rule_cls, bad, good):
    assert run_rule(rule_cls, bad), f"{rule_cls.__name__} має знайти проблему"
    assert not run_rule(rule_cls, good), f"{rule_cls.__name__} не має спрацьовувати на чистому коді"


def test_registry_contains_all_rules_once():
    rules = all_rules()
    assert [r.rule_id for r in rules] == [f"AC{n:03d}" for n in range(1, 11)]
    assert all(isinstance(r, Rule) for r in rules)


def test_duplicate_rule_id_is_rejected():
    with pytest.raises(ValueError, match="AC001"):
        @register
        class Duplicate(Rule):
            rule_id = "AC001"

            def check(self, ctx):
                return iter(())


def test_threshold_comes_from_configuration_with_default_fallback():
    code = "def f():\n    '''d'''\n" + "    x = 1\n" * 10
    assert run_rule(c.LongFunctionRule, code) == []                                   # поріг за замовчуванням: 50 рядків
    custom = {"AC005": RuleConfig(severity="low", threshold=5)}
    assert run_rule(c.LongFunctionRule, code, custom)[0].message.endswith("(поріг 5)")  # поріг із налаштувань


def test_new_rule_is_added_without_changing_analyzer():
    """Суть патерна: нове правило – це лише новий клас, аналізатор не змінюється."""
    @register
    class NoPrintRule(Rule):
        rule_id = "AC900"

        def check(self, ctx):
            for node in ast.walk(ctx.tree):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "print":
                    yield Finding(node.lineno, "Використано print()")

    try:
        config = {"AC900": RuleConfig(severity="info")}
        result = analyze_source("t.py", "print('x')\n", config)
        assert [(i.rule_id, i.severity, i.line) for i in result.issues] == [("AC900", "info", 1)]
    finally:
        unregister("AC900")
    assert "AC900" not in [r.rule_id for r in all_rules()]


def test_disabled_or_unconfigured_rule_is_never_called():
    calls = []

    @register
    class SpyRule(Rule):
        rule_id = "AC901"

        def check(self, ctx):
            calls.append(1)
            return iter(())

    try:
        analyze_source("t.py", "x = 1\n", {"AC901": RuleConfig(enabled=False)})
        analyze_source("t.py", "x = 1\n", {})
        assert calls == []
        analyze_source("t.py", "x = 1\n", {"AC901": RuleConfig()})
        assert calls == [1]
    finally:
        unregister("AC901")
