"""Лабораторна 12. Патерн Factory Method: експорт звіту в різні формати."""
from types import SimpleNamespace

import pytest

from app.services import exporters as ex

CODE = "import os\n\ndef process(a, b=[]):\n    return eval(a)\n"


def make_analysis(client, headers, title="export-test"):
    r = client.post("/api/analyses", headers=headers,
                    json={"title": title, "sourceType": "file", "files": [{"path": "mod.py", "content": CODE}]})
    return r.json()["id"]


@pytest.mark.parametrize("fmt,creator,exporter", [
    ("json", ex.JsonReportCreator, ex.JsonExporter),
    ("html", ex.HtmlReportCreator, ex.HtmlExporter),
    ("csv", ex.CsvReportCreator, ex.CsvExporter),
])
def test_creator_returns_matching_exporter(fmt, creator, exporter):
    c = ex.get_creator(fmt)
    assert isinstance(c, creator) and isinstance(c.create_exporter(), exporter)


def test_unknown_format_is_rejected_with_list_of_formats():
    with pytest.raises(ex.UnknownFormatError, match="csv, html, json"):
        ex.get_creator("pdf")


def test_base_creator_builds_filename_and_media_type_from_exporter():
    class TxtExporter(ex.ReportExporter):
        media_type, extension = "text/plain", "txt"

        def render(self, analysis):
            return f"analysis {analysis.id}"

    class TxtCreator(ex.ReportCreator):
        def create_exporter(self):
            return TxtExporter()

    report = TxtCreator().export(SimpleNamespace(id=7))
    assert report == ex.ExportedReport("analysis 7", "text/plain", "analysis-7.txt")


def test_new_format_is_added_without_changing_router(client, student):
    class MdExporter(ex.ReportExporter):
        media_type, extension = "text/markdown", "md"

        def render(self, analysis):
            return f"# {analysis.title}\n"

    class MdCreator(ex.ReportCreator):
        def create_exporter(self):
            return MdExporter()

    ex.CREATORS["md"] = MdCreator
    try:
        aid = make_analysis(client, student, "md-title")
        r = client.get(f"/api/analyses/{aid}/export", params={"format": "md"}, headers=student)
        assert r.status_code == 200 and r.text == "# md-title\n"
        assert r.headers["content-disposition"] == f'attachment; filename="analysis-{aid}.md"'
    finally:
        del ex.CREATORS["md"]
    assert client.get(f"/api/analyses/{aid}/export", params={"format": "md"}, headers=student).status_code == 422


def test_csv_export_through_api(client, student):
    aid = make_analysis(client, student)
    r = client.get(f"/api/analyses/{aid}/export", params={"format": "csv"}, headers=student)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert f'filename="analysis-{aid}.csv"' in r.headers["content-disposition"]
    lines = r.text.strip().split("\n")
    assert lines[0] == "file,line,rule,severity,message"
    assert any(row.startswith("mod.py,1,AC001,low,") for row in lines[1:])
    assert any(",AC004,critical," in row for row in lines[1:])


def test_unknown_format_through_api_returns_422_with_message(client, student):
    aid = make_analysis(client, student)
    r = client.get(f"/api/analyses/{aid}/export", params={"format": "pdf"}, headers=student)
    assert r.status_code == 422 and "Доступні: csv, html, json" in r.json()["message"]


def test_export_still_requires_ownership(client, student, teacher):
    aid = make_analysis(client, student)
    other = client.post("/api/auth/register", json={"email": "other.lab12@example.com", "password": "Secret123"}).json()["token"]
    r = client.get(f"/api/analyses/{aid}/export", params={"format": "csv"}, headers={"Authorization": f"Bearer {other}"})
    assert r.status_code == 404                                                   # чужий аналіз недоступний
    assert client.get(f"/api/analyses/{aid}/export", params={"format": "csv"}, headers=teacher).status_code == 200
