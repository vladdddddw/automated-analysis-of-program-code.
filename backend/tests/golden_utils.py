"""Допоміжні функції «золотих» (еталонних) тестів рефакторингу.

Еталон знято з аналізатора ДО рефакторингу (лабораторна 12): тести доводять, що після впровадження патернів результати
не змінились ані на символ.
"""
import json
import re
from pathlib import Path

from app.services.analyzer import RuleConfig, analyze_source

GOLDEN = Path(__file__).parent / "golden"
CORPUS = GOLDEN / "corpus"

# налаштування правил, що збігаються зі значеннями за замовчуванням у БД
DEFAULT_RULES = {
    "AC001": RuleConfig(severity="low"), "AC002": RuleConfig(severity="medium"), "AC003": RuleConfig(severity="medium"),
    "AC004": RuleConfig(severity="critical"), "AC005": RuleConfig(severity="low", threshold=50),
    "AC006": RuleConfig(severity="medium", threshold=10), "AC007": RuleConfig(severity="medium", threshold=4),
    "AC008": RuleConfig(severity="low", threshold=5), "AC009": RuleConfig(severity="info"),
    "AC010": RuleConfig(severity="high"),
}


def analyze_corpus(rules=None) -> dict:
    """Результат аналізу кожного файлу корпусу у вигляді простих структур (зручно для порівняння)."""
    out = {}
    for path in sorted(CORPUS.glob("*.txt")):
        r = analyze_source(path.stem + ".py", path.read_text(encoding="utf8"), rules or DEFAULT_RULES)
        out[path.stem] = {
            "loc": r.loc, "sloc": r.sloc, "max_complexity": r.max_complexity, "max_nesting": r.max_nesting,
            "syntax_error": r.syntax_error,
            "functions": [[f.name, f.start_line, f.end_line, f.complexity, f.nesting_depth, f.params] for f in r.functions],
            "issues": [[i.rule_id, i.severity, i.line, i.message] for i in r.issues],
        }
    return out


def load_golden() -> dict:
    return json.loads((GOLDEN / "analyzer_golden.json").read_text(encoding="utf8"))


def normalize_export(text: str) -> str:
    """Прибирає змінні частини експорту (ідентифікатори, дати, тривалість), щоб порівнювати решту."""
    text = re.sub(r'"id": \d+', '"id": N', text)
    text = re.sub(r'"createdAt": "[^"]*"', '"createdAt": "T"', text)
    text = re.sub(r'"durationMs": \d+', '"durationMs": 0', text)
    text = re.sub(r"Дата: [\d.: ]+\.", "Дата: T.", text)
    return text
