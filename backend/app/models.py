"""ORM-моделі. Відповідають схемі БД із лабораторної роботи № 5
(єдине розширення: source_files.content та поля блокування входу в users)."""
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(20), unique=True)


class Severity(Base):
    __tablename__ = "severities"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(20), unique=True)
    rank: Mapped[int] = mapped_column(Integer, unique=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", onupdate="CASCADE", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    role: Mapped[Role] = relationship(lazy="joined")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="user", cascade="all, delete-orphan", passive_deletes=True)


class Rule(Base):
    __tablename__ = "rules"
    id: Mapped[str] = mapped_column(String(10), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(20))
    default_severity_id: Mapped[int] = mapped_column(ForeignKey("severities.id"))
    default_threshold: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recommendation: Mapped[str] = mapped_column(Text)

    default_severity: Mapped[Severity] = relationship(lazy="joined")
    setting: Mapped["RuleSetting"] = relationship(back_populates="rule", uselist=False, lazy="joined", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("category IN ('security','reliability','maintainability','style')", name="rules_category_check"),
    )


class RuleSetting(Base):
    __tablename__ = "rule_settings"
    rule_id: Mapped[str] = mapped_column(ForeignKey("rules.id", ondelete="CASCADE"), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    threshold: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    rule: Mapped[Rule] = relationship(back_populates="setting")


class Analysis(Base):
    __tablename__ = "analyses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_type: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(10), default="done")
    duration_ms: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user: Mapped[User] = relationship(back_populates="analyses", lazy="joined")
    files: Mapped[list["SourceFile"]] = relationship(back_populates="analysis", cascade="all, delete-orphan",
                                                     passive_deletes=True, order_by="SourceFile.id")

    __table_args__ = (
        CheckConstraint("source_type IN ('file','archive','snippet')", name="analyses_source_check"),
        CheckConstraint("status IN ('done','failed')", name="analyses_status_check"),
    )


class SourceFile(Base):
    __tablename__ = "source_files"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    analysis_id: Mapped[int] = mapped_column(ForeignKey("analyses.id", ondelete="CASCADE"), index=True)
    file_path: Mapped[str] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text, default="")
    loc: Mapped[int] = mapped_column(Integer)
    sloc: Mapped[int] = mapped_column(Integer)
    max_complexity: Mapped[int] = mapped_column(Integer, default=0)
    max_nesting: Mapped[int] = mapped_column(Integer, default=0)
    syntax_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    analysis: Mapped[Analysis] = relationship(back_populates="files")
    functions: Mapped[list["Function"]] = relationship(back_populates="file", cascade="all, delete-orphan",
                                                       passive_deletes=True, order_by="Function.id")
    issues: Mapped[list["Issue"]] = relationship(back_populates="file", cascade="all, delete-orphan",
                                                 passive_deletes=True, order_by="Issue.line, Issue.id")

    __table_args__ = (UniqueConstraint("analysis_id", "file_path", name="uq_file_per_analysis"),)


class Function(Base):
    __tablename__ = "functions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("source_files.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    start_line: Mapped[int] = mapped_column(Integer)
    end_line: Mapped[int] = mapped_column(Integer)
    complexity: Mapped[int] = mapped_column(Integer)
    nesting_depth: Mapped[int] = mapped_column(Integer)
    params_count: Mapped[int] = mapped_column(Integer)

    file: Mapped[SourceFile] = relationship(back_populates="functions")


class Issue(Base):
    __tablename__ = "issues"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("source_files.id", ondelete="CASCADE"), index=True)
    rule_id: Mapped[str] = mapped_column(ForeignKey("rules.id"), index=True)
    severity_id: Mapped[int] = mapped_column(ForeignKey("severities.id"))
    line: Mapped[int] = mapped_column(Integer)
    message: Mapped[str] = mapped_column(Text)

    file: Mapped[SourceFile] = relationship(back_populates="issues")
    severity: Mapped[Severity] = relationship(lazy="joined")
