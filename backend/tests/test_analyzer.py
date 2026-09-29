"""Модульні тести аналізатора (без БД і HTTP)."""
from app.services.analyzer import RuleConfig, analyze_source
from app.services.scoring import quality_score

RULES = {
    "AC001": RuleConfig(severity="low"), "AC002": RuleConfig(severity="medium"), "AC003": RuleConfig(severity="medium"),
    "AC004": RuleConfig(severity="critical"), "AC005": RuleConfig(severity="low", threshold=50),
    "AC006": RuleConfig(severity="medium", threshold=10), "AC007": RuleConfig(severity="medium", threshold=4),
    "AC008": RuleConfig(severity="low", threshold=5), "AC009": RuleConfig(severity="info"),
    "AC010": RuleConfig(severity="high"),
}


def rule_ids(code, rules=RULES):
    return [i.rule_id for i in analyze_source("t.py", code, rules).issues]


def test_syntax_error_is_reported_not_raised():
    r = analyze_source("t.py", "def broken(:\n    pass\n", RULES)
    assert r.syntax_error and "рядок 1" in r.syntax_error
    assert r.issues == [] and r.loc == 2


def test_unused_import_detected_and_used_ignored():
    assert rule_ids("import os\nimport sys\nprint(sys.argv)\n").count("AC001") == 1
    assert "AC001" not in rule_ids("from typing import List\nx: List[int] = []\n")


def test_future_and_star_imports_ignored():
    assert "AC001" not in rule_ids("from __future__ import annotations\nfrom os import *\n")


def test_bare_except_and_except_pass():
    assert "AC002" in rule_ids("try:\n    pass\nexcept:\n    pass\n")
    assert "AC002" in rule_ids("try:\n    pass\nexcept ValueError:\n    pass\n")
    assert "AC002" not in rule_ids("try:\n    pass\nexcept ValueError as e:\n    print(e)\n")


def test_mutable_default_argument():
    assert "AC003" in rule_ids("def f(a, b=[]):\n    '''d'''\n")
    assert "AC003" in rule_ids("def f(a, b=dict()):\n    '''d'''\n")
    assert "AC003" not in rule_ids("def f(a, b=None):\n    '''d'''\n")


def test_eval_and_exec():
    ids = rule_ids("x = eval('1+1')\nexec('y=1')\nobj.eval('safe')\n")
    assert ids.count("AC004") == 2  # метод obj.eval не рахується


def test_long_function_uses_threshold():
    code = "def f():\n    '''d'''\n" + "    x = 1\n" * 6
    rules = {**RULES, "AC005": RuleConfig(severity="low", threshold=5)}
    assert "AC005" in rule_ids(code, rules)
    assert "AC005" not in rule_ids(code)


def test_complexity_counts_branches_and_boolean_operators():
    code = '''def f(a, b):
    """d"""
    if a and b or a:
        for i in range(3):
            if i:
                pass
    return [x for x in range(3) if x]
'''
    r = analyze_source("t.py", code, RULES)
    # 1 + if + (and,or → 2) + for + if + comprehension(1+1) = 8
    assert r.functions[0].complexity == 8


def test_high_complexity_rule():
    body = "".join(f"    if a == {i}:\n        pass\n" for i in range(12))
    assert "AC006" in rule_ids(f"def f(a):\n    '''d'''\n{body}")


def test_nesting_depth_and_rule():
    code = '''def f(a):
    """d"""
    for i in a:
        if i:
            while i:
                try:
                    with i:
                        for k in i:
                            pass
                except Exception:
                    pass
'''
    r = analyze_source("t.py", code, RULES)
    assert r.functions[0].nesting_depth == 6
    assert "AC007" in [i.rule_id for i in r.issues]


def test_elif_does_not_increase_nesting():
    code = "def f(a):\n    '''d'''\n    if a == 1:\n        pass\n    elif a == 2:\n        pass\n    elif a == 3:\n        pass\n"
    assert analyze_source("t.py", code, RULES).functions[0].nesting_depth == 1


def test_too_many_params_ignores_self():
    assert "AC008" in rule_ids("def f(a, b, c, d, e, g):\n    '''d'''\n")
    assert "AC008" not in rule_ids("class A:\n    '''d'''\n    def m(self, a, b, c, d, e):\n        '''d'''\n")


def test_missing_docstring_for_public_only():
    ids = rule_ids("def pub():\n    pass\ndef _priv():\n    pass\nclass C:\n    pass\n")
    assert ids.count("AC009") == 2  # pub і C


def test_hardcoded_secret():
    assert "AC010" in rule_ids('PASSWORD = "admin12345"\n')
    assert "AC010" in rule_ids('self.api_key = "abcdef"\n')
    assert "AC010" not in rule_ids('PASSWORD = os.environ["X"]\nname = "admin12345"\n')


def test_disabled_rule_is_skipped():
    rules = {**RULES, "AC004": RuleConfig(enabled=False, severity="critical")}
    assert "AC004" not in rule_ids("eval('1')\n", rules)


def test_code_is_never_executed(tmp_path):
    marker = tmp_path / "pwned.txt"
    code = f"open(r'{marker}', 'w').write('x')\n"
    analyze_source("t.py", code, RULES)
    assert not marker.exists()


def test_loc_and_sloc():
    r = analyze_source("t.py", "# c\n\nx = 1\ny = 2\n", RULES)
    assert (r.loc, r.sloc) == (4, 2)


def test_quality_score():
    assert quality_score([]) == 100
    assert quality_score(["critical", "high", "medium", "medium", "medium", "medium", "low", "low", "info", "info"]) == 47
    assert quality_score(["critical"] * 10) == 0
