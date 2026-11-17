"""Лабораторна 11. Модульне тестування: 10 тестів функцій проєкту (без БД і HTTP).

Перевіряються граничні значення, типові й некоректні вхідні дані та виняткові ситуації.
"""
import ast

import pytest
from pydantic import ValidationError

from app.schemas import FileIn, RegisterIn
from app.security import hash_password, verify_password
from app.services.analyzer import count_params, cyclomatic_complexity, nesting_depth
from app.services.archive import ArchiveError, extract_python_files
from app.services.scoring import quality_score


def parse_func(code: str) -> ast.AST:
    return ast.parse(code).body[0]


# ---- quality_score(): оцінка якості 0–100 ----------------------------------
def test_quality_score_without_issues_is_100():
    assert quality_score([]) == 100


def test_quality_score_uses_severity_weights():
    # критична 18 + висока 10 + середня 5 = 33 штрафних бали
    assert quality_score(["critical", "high", "medium"]) == 67


def test_quality_score_never_below_zero():
    assert quality_score(["critical"] * 50) == 0


# ---- метрики складності ----------------------------------------------------
def test_complexity_of_straight_code_is_one():
    assert cyclomatic_complexity(parse_func("def f(a):\n    return a + 1\n")) == 1


def test_complexity_counts_if_loop_and_boolean_operator():
    code = "def f(a, b):\n    if a and b:\n        for i in a:\n            pass\n    return a\n"
    # 1 (початок) + if + (and) + for = 4
    assert cyclomatic_complexity(parse_func(code)) == 4


def test_nesting_and_params_edge_cases():
    flat = parse_func("def f(self, a, *args, **kwargs):\n    return a\n")
    assert nesting_depth(flat) == 0
    assert count_params(flat) == 3  # self не рахується; a, *args, **kwargs


# ---- паролі ----------------------------------------------------------------
def test_password_hash_verify_and_malformed_hash():
    stored = hash_password("Secret123")
    assert verify_password("Secret123", stored) is True
    assert verify_password("secret123", stored) is False
    assert verify_password("Secret123", "not-a-valid-hash") is False  # без винятку


# ---- валідація вхідних даних -----------------------------------------------
def test_register_rejects_short_and_blank_password():
    assert RegisterIn(email="A@B.com", password="Secret1").email == "a@b.com"
    for bad in ("12345", "        "):
        with pytest.raises(ValidationError):
            RegisterIn(email="a@b.com", password=bad)


def test_file_validator_rejects_unsafe_input():
    assert FileIn(path="pkg/mod.py", content="x = 1").path == "pkg/mod.py"
    for path, content in (("../evil.py", "x"), ("/etc/passwd.py", "x"), ("notes.txt", "x"), ("ok.py", "x\u0000")):
        with pytest.raises(ValidationError):
            FileIn(path=path, content=content)


# ---- безпечне читання архіву -----------------------------------------------
def test_archive_rejects_not_zip_and_unsafe_paths():
    import io
    import zipfile

    with pytest.raises(ArchiveError):
        extract_python_files(b"this is not a zip")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("../evil.py", "x = 1")
    with pytest.raises(ArchiveError, match="небезпечн"):
        extract_python_files(buf.getvalue())
