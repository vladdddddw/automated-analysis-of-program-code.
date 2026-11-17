"""Лабораторна 12. Еталонні (golden) тести: результати аналізатора й експорту після рефакторингу не змінились.

Еталон знято з коду до впровадження патернів (tests/golden/make_golden.py). Корпус – заморожені копії модулів
проєкту й синтетичний файл із дефектами всіх 10 правил.
"""
import golden_utils as gu


def test_analyzer_results_identical_to_golden():
    golden, current = gu.load_golden(), gu.analyze_corpus()
    assert current.keys() == golden.keys()
    for name in golden:
        assert current[name] == golden[name], f"результат аналізу змінився для {name}"


def test_golden_corpus_covers_all_rules():
    ids = {i[0] for v in gu.load_golden().values() for i in v["issues"]}
    assert ids == {f"AC{n:03d}" for n in range(1, 11)}


def test_export_identical_to_golden(client, student):
    code = (gu.CORPUS / "defects.txt").read_text(encoding="utf8")
    r = client.post("/api/analyses", headers=student, json={
        "title": "golden", "sourceType": "file", "files": [{"path": "defects.py", "content": code}]})
    aid = r.json()["id"]
    for fmt in ("json", "html"):
        out = client.get(f"/api/analyses/{aid}/export", params={"format": fmt}, headers=student)
        expected = (gu.GOLDEN / f"export_{fmt}.golden").read_text(encoding="utf8")
        assert gu.normalize_export(out.text) == expected, f"експорт {fmt} змінився"
