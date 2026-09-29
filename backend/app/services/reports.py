"""Експорт звіту в HTML."""
from html import escape

from ..models import Analysis

SEVERITY_LABELS = {"info": "Інформація", "low": "Низька", "medium": "Середня", "high": "Висока", "critical": "Критична"}


def analysis_to_html(a: Analysis) -> str:
    rows = "".join(
        f"<tr><td>{escape(f.file_path)}</td><td>{i.line}</td><td>{i.rule_id}</td>"
        f"<td>{SEVERITY_LABELS.get(i.severity.name, i.severity.name)}</td><td>{escape(i.message)}</td></tr>"
        for f in a.files for i in f.issues
    )
    created = a.created_at.strftime("%d.%m.%Y %H:%M") if a.created_at else ""
    return (
        '<!doctype html><html lang="uk"><meta charset="utf-8">'
        f"<title>{escape(a.title)}</title>"
        "<style>body{font-family:Arial,sans-serif;margin:2rem}table{border-collapse:collapse;width:100%}"
        "td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#eee}</style>"
        f"<h1>Звіт: {escape(a.title)}</h1><p>Дата: {created}. Файлів: {len(a.files)}.</p>"
        "<table><tr><th>Файл</th><th>Рядок</th><th>Правило</th><th>Серйозність</th><th>Опис</th></tr>"
        f"{rows}</table></html>"
    )
