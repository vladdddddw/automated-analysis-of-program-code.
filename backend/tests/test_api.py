import io
import zipfile

CODE = "import os\n\ndef f(a, b=[]):\n    try:\n        return eval(a)\n    except:\n        pass\n"


def make_analysis(client, headers, title="t", path="a.py", code=CODE, source="snippet"):
    return client.post("/api/analyses", headers=headers, json={"title": title, "sourceType": source, "files": [{"path": path, "content": code}]})


def test_create_analysis_returns_issues_and_metrics(client, student):
    r = make_analysis(client, student, "мій код")
    assert r.status_code == 201
    a = r.json()
    rules = {i["ruleId"] for f in a["files"] for i in f["issues"]}
    assert {"AC001", "AC002", "AC003", "AC004", "AC009"} <= rules
    assert a["status"] == "done" and a["filesCount"] == 1 and a["files"][0]["functions"][0]["name"] == "f"
    assert 0 <= a["score"] < 100 and a["owner"] == "student@example.com"


def test_syntax_error_analysis_is_failed_but_saved(client, student):
    a = make_analysis(client, student, "bad", code="def broken(:\n").json()
    assert a["status"] == "failed" and a["score"] is None and a["files"][0]["syntaxError"]


def test_get_list_and_delete(client, student):
    aid = make_analysis(client, student, "to-delete").json()["id"]
    assert client.get(f"/api/analyses/{aid}", headers=student).json()["title"] == "to-delete"
    assert any(x["id"] == aid for x in client.get("/api/analyses", headers=student).json())
    assert client.delete(f"/api/analyses/{aid}", headers=student).status_code == 204
    r = client.get(f"/api/analyses/{aid}", headers=student)
    assert r.status_code == 404 and r.json() == {"status": 404, "message": "Аналіз не знайдено"}


def test_student_sees_only_own_but_teacher_sees_all(client, student, teacher):
    new = client.post("/api/auth/register", json={"email": "other@example.com", "password": "pass1234"}).json()
    other = {"Authorization": f"Bearer {new['token']}"}
    aid = make_analysis(client, other, "private").json()["id"]
    assert client.get(f"/api/analyses/{aid}", headers=student).status_code == 404
    assert client.delete(f"/api/analyses/{aid}", headers=student).status_code == 404
    assert client.get(f"/api/analyses/{aid}", headers=teacher).status_code == 200
    assert aid in [x["id"] for x in client.get("/api/analyses", headers=teacher).json()]
    assert aid not in [x["id"] for x in client.get("/api/analyses", headers=student).json()]


def test_validation_errors(client, student):
    assert client.post("/api/analyses", headers=student, json={"files": []}).status_code == 422
    dup = {"files": [{"path": "a.py", "content": "x"}, {"path": "a.py", "content": "y"}]}
    assert client.post("/api/analyses", headers=student, json=dup).status_code == 422
    bad_path = {"files": [{"path": "../etc/passwd.py", "content": "x"}]}
    assert client.post("/api/analyses", headers=student, json=bad_path).status_code == 422
    assert client.post("/api/analyses", headers=student, json={"sourceType": "zip", "files": [{"path": "a.py", "content": ""}]}).status_code == 422


def test_too_large_code_rejected(client, student):
    big = "x = 1\n" * 200_000
    r = client.post("/api/analyses", headers=student, json={"files": [{"path": "big.py", "content": big}]})
    assert r.status_code in (413, 422)


def _zip(files: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_archive_upload_skips_unsafe_and_non_python(client, student):
    data = _zip({"proj/main.py": CODE, "proj/utils.py": "x = 1\n", "../evil.py": "eval('1')", "readme.md": "hi", "proj/__pycache__/x.py": "1"})
    r = client.post("/api/analyses/archive", headers=student, files={"file": ("proj.zip", data, "application/zip")}, data={"title": "архів"})
    assert r.status_code == 201
    a = r.json()
    assert a["sourceType"] == "archive" and sorted(f["path"] for f in a["files"]) == ["proj/main.py", "proj/utils.py"]


def test_archive_errors(client, student):
    r = client.post("/api/analyses/archive", headers=student, files={"file": ("x.zip", b"not a zip", "application/zip")})
    assert r.status_code == 400
    r = client.post("/api/analyses/archive", headers=student, files={"file": ("x.zip", _zip({"a.txt": "x"}), "application/zip")})
    assert r.status_code == 400 and "немає файлів .py" in r.json()["message"]


def test_stats_shape(client, student):
    make_analysis(client, student, "for-stats")
    s = client.get("/api/stats", headers=student).json()
    assert s["total"] >= 2 and set(s["severity"]) == {"info", "low", "medium", "high", "critical"}
    assert s["timeline"] and s["recent"] and s["topRules"] and 0 <= s["avgScore"] <= 100


def test_export_json_and_html(client, student):
    aid = make_analysis(client, student, "<b>exp</b>").json()["id"]
    j = client.get(f"/api/analyses/{aid}/export?format=json", headers=student)
    assert j.status_code == 200 and "content" not in j.json()["files"][0]
    h = client.get(f"/api/analyses/{aid}/export?format=html", headers=student)
    assert "&lt;b&gt;exp" in h.text and "<b>exp</b>" not in h.text  # HTML екранується
    assert client.get(f"/api/analyses/{aid}/export?format=pdf", headers=student).status_code == 422


def test_rules_list_visible_to_all(client, student):
    rules = client.get("/api/rules", headers=student).json()
    assert len(rules) == 10 and {"id", "name", "severity", "threshold", "enabled", "category"} <= set(rules[0])


def test_only_admin_can_change_rules(client, student, teacher, admin):
    assert client.put("/api/rules/AC006", headers=student, json={"enabled": False}).status_code == 403
    assert client.put("/api/rules/AC006", headers=teacher, json={"threshold": 3}).status_code == 403
    r = client.put("/api/rules/AC006", headers=admin, json={"threshold": 3})
    assert r.status_code == 200 and r.json()["threshold"] == 3
    client.post("/api/rules/reset", headers=admin)


def test_rule_validation(client, admin):
    assert client.put("/api/rules/AC006", headers=admin, json={"threshold": 0}).status_code == 422
    assert client.put("/api/rules/AC006", headers=admin, json={"threshold": 9999}).status_code == 422
    assert client.put("/api/rules/AC004", headers=admin, json={"threshold": 5}).status_code == 422  # у правила немає порога
    assert client.put("/api/rules/ZZZ", headers=admin, json={"enabled": True}).status_code == 404


def test_disabled_rule_changes_future_analyses(client, student, admin):
    client.put("/api/rules/AC004", headers=admin, json={"enabled": False})
    try:
        a = make_analysis(client, student, "no-eval").json()
        assert "AC004" not in {i["ruleId"] for f in a["files"] for i in f["issues"]}
    finally:
        client.post("/api/rules/reset", headers=admin)
    a = make_analysis(client, student, "eval-again").json()
    assert "AC004" in {i["ruleId"] for f in a["files"] for i in f["issues"]}


def test_threshold_change_affects_analysis(client, student, admin):
    code = "def f(a):\n    '''d'''\n    if a:\n        pass\n    if a > 1:\n        pass\n"
    assert "AC006" not in {i["ruleId"] for i in make_analysis(client, student, code=code).json()["files"][0]["issues"]}
    client.put("/api/rules/AC006", headers=admin, json={"threshold": 2})
    try:
        assert "AC006" in {i["ruleId"] for i in make_analysis(client, student, code=code).json()["files"][0]["issues"]}
    finally:
        client.post("/api/rules/reset", headers=admin)


def test_unknown_route_returns_json_404(client):
    r = client.get("/api/nothing")
    assert r.status_code == 404 and r.json()["status"] == 404


def test_source_type_file_is_kept(client, student):
    a = make_analysis(client, student, "", path="lab.py", source="file").json()
    assert a["sourceType"] == "file" and a["title"] == "lab.py"  # порожня назва береться з імені файлу
