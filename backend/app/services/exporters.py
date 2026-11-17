"""Експорт звіту про аналіз у різні формати (патерн Factory Method).

ReportExporter – продукт (вміє подати аналіз у конкретному форматі). ReportCreator – творець: його підкласи
перевизначають фабричний метод create_exporter(), а спільна логіка експорту живе в базовому класі.
Щоб додати формат, достатньо написати пару «експортер + творець» і додати її в CREATORS.
"""
import csv
import io
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import ClassVar

from ..models import Analysis
from . import analyses as svc
from .reports import analysis_to_html


@dataclass(frozen=True)
class ExportedReport:
    """Готовий до відправлення звіт: вміст, тип і ім'я файлу."""

    content: str
    media_type: str
    filename: str


class UnknownFormatError(ValueError):
    """Запитано формат, якого немає серед творців."""

    pass


# ----------------------------------------------------------------- продукти
class ReportExporter(ABC):
    """Продукт фабричного методу: подає аналіз у конкретному форматі."""

    media_type: ClassVar[str]
    extension: ClassVar[str]

    @abstractmethod
    def render(self, analysis: Analysis) -> str:
        """Подає аналіз у вигляді тексту в конкретному форматі."""


class JsonExporter(ReportExporter):
    """Експорт у JSON (без вихідного коду)."""

    media_type = "application/json"
    extension = "json"

    def render(self, analysis: Analysis) -> str:
        """Звіт у JSON."""
        data = svc.detail_dict(analysis)
        for f in data["files"]:
            f.pop("content", None)  # вихідний код у звіт не потрапляє
        return json.dumps(data, ensure_ascii=False, indent=2)


class HtmlExporter(ReportExporter):
    """Експорт у HTML-таблицю зауважень."""

    media_type = "text/html"
    extension = "html"

    def render(self, analysis: Analysis) -> str:
        """Звіт у HTML."""
        return analysis_to_html(analysis)


class CsvExporter(ReportExporter):
    """Експорт зауважень у CSV."""

    media_type = "text/csv"
    extension = "csv"

    def render(self, analysis: Analysis) -> str:
        """Зауваження у CSV: файл, рядок, правило, серйозність, опис."""
        out = io.StringIO()
        writer = csv.writer(out, lineterminator="\n")
        writer.writerow(["file", "line", "rule", "severity", "message"])
        for f in analysis.files:
            for i in sorted(f.issues, key=lambda i: (i.line, i.rule_id)):
                writer.writerow([f.file_path, i.line, i.rule_id, i.severity.name, i.message])
        return out.getvalue()


# ----------------------------------------------------------------- творці
class ReportCreator(ABC):
    """Творець: містить фабричний метод і спільну логіку експорту."""

    @abstractmethod
    def create_exporter(self) -> ReportExporter:
        """Фабричний метод: підклас вирішує, який експортер створити."""

    def export(self, analysis: Analysis) -> ExportedReport:
        """Експортує аналіз: створює експортер, викликає його й формує ім'я файлу."""
        exporter = self.create_exporter()
        return ExportedReport(exporter.render(analysis), exporter.media_type, f"analysis-{analysis.id}.{exporter.extension}")


class JsonReportCreator(ReportCreator):
    """Створює JsonExporter."""

    def create_exporter(self) -> ReportExporter:
        """Фабричний метод."""
        return JsonExporter()


class HtmlReportCreator(ReportCreator):
    """Створює HtmlExporter."""

    def create_exporter(self) -> ReportExporter:
        """Фабричний метод."""
        return HtmlExporter()


class CsvReportCreator(ReportCreator):
    """Створює CsvExporter."""

    def create_exporter(self) -> ReportExporter:
        """Фабричний метод."""
        return CsvExporter()


CREATORS: dict[str, type[ReportCreator]] = {
    "json": JsonReportCreator,
    "html": HtmlReportCreator,
    "csv": CsvReportCreator,
}


def get_creator(fmt: str) -> ReportCreator:
    """Творець для формату (json, html, csv); для невідомого – UnknownFormatError."""
    try:
        return CREATORS[fmt]()
    except KeyError:
        raise UnknownFormatError(f"Невідомий формат експорту «{fmt}». Доступні: {', '.join(sorted(CREATORS))}") from None
