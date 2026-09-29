"""Pydantic-схеми вхідних даних (валідація на сервері)."""
import re

from pydantic import AliasChoices, BaseModel, Field, field_validator

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


class Credentials(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("некоректний формат email")
        return v


class RegisterIn(Credentials):
    password: str = Field(min_length=6, max_length=128)


class FileIn(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    content: str = Field(max_length=1_000_000)

    @field_validator("path")
    @classmethod
    def _path(cls, v: str) -> str:
        v = v.strip().replace("\\", "/")
        if v.startswith("/") or ".." in v.split("/"):
            raise ValueError("недопустимий шлях файлу")
        return v


class AnalysisIn(BaseModel):
    title: str = Field(default="", max_length=255)
    source_type: str = Field(default="snippet", validation_alias=AliasChoices("sourceType", "source_type"))
    files: list[FileIn] = Field(min_length=1, max_length=200)

    model_config = {"populate_by_name": True}

    @field_validator("source_type")
    @classmethod
    def _source(cls, v: str) -> str:
        if v not in {"file", "snippet"}:
            raise ValueError("sourceType має бути file або snippet")
        return v


class RulePatch(BaseModel):
    enabled: bool | None = None
    threshold: int | None = Field(default=None, ge=1, le=500)
