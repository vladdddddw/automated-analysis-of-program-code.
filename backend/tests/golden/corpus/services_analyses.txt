"""Бізнес-логіка аналізів: збереження результатів, права доступу, побудова відповідей і статистики."""
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Analysis, Function, Issue, Rule, Severity, SourceFile, User
from .analyzer import AnalysisResult, RuleConfig
from .scoring import quality_score

SEVERITY_ORDER = ["info", "low", "medium", "high", "critical"]


def rule_configs(db: Session) -> dict[str, RuleConfig]:
    """Поточні налаштування правил (увімкнено, поріг, серйозність) у вигляді, зручному для аналізатора."""
    cfg = {}
    for r in db.scalars(select(Rule)):
        s = r.setting
        cfg[r.id] = RuleConfig(enabled=s.enabled if s else True, severity=r.default_severity.name,
                               threshold=(s.threshold if s else r.default_threshold))
    return cfg


def save_analysis(db: Session, user: User, title: str, source_type: str, result: AnalysisResult) -> Analysis:
    sev_ids = {s.name: s.id for s in db.scalars(select(Severity))}
    analysis = Analysis(user_id=user.id, source_type=source_type, title=title[:255], status=result.status,
                        duration_ms=result.duration_ms)
    for f in result.files:
        sf = SourceFile(file_path=f.path[:500], content=f.content, loc=f.loc, sloc=f.sloc, max_complexity=f.max_complexity,
                        max_nesting=f.max_nesting, syntax_error=f.syntax_error)
        sf.functions = [Function(name=fn.name[:200], start_line=fn.start_line, end_line=fn.end_line, complexity=fn.complexity,
                                 nesting_depth=fn.nesting_depth, params_count=fn.params) for fn in f.functions]
        sf.issues = [Issue(rule_id=i.rule_id, severity_id=sev_ids[i.severity], line=i.line, message=i.message) for i in f.issues]
        analysis.files.append(sf)
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


def visible_query(user: User):
    """Розробник бачить лише свої аналізи; викладач, керівник та адміністратор – усі."""
    q = select(Analysis).options(selectinload(Analysis.files).selectinload(SourceFile.issues))
    if user.role.name == "user":
        q = q.where(Analysis.user_id == user.id)
    return q


def _iso(dt) -> str:
    return dt.isoformat() if dt else ""


def _issues(a: Analysis):
    return [i for f in a.files for i in f.issues]


def summary_dict(a: Analysis) -> dict:
    issues = _issues(a)
    return {
        "id": a.id, "title": a.title, "sourceType": a.source_type, "status": a.status, "durationMs": a.duration_ms,
        "createdAt": _iso(a.created_at), "filesCount": len(a.files), "issuesCount": len(issues),
        "maxComplexity": max((f.max_complexity for f in a.files), default=0),
        "score": quality_score([i.severity.name for i in issues]) if a.status == "done" else None,
        "owner": a.user.email,
    }


def detail_dict(a: Analysis) -> dict:
    files = []
    for f in a.files:
        files.append({
            "path": f.file_path, "content": f.content, "loc": f.loc, "sloc": f.sloc, "maxComplexity": f.max_complexity,
            "maxNesting": f.max_nesting, "syntaxError": f.syntax_error,
            "functions": [{"name": fn.name, "startLine": fn.start_line, "endLine": fn.end_line, "complexity": fn.complexity,
                           "nestingDepth": fn.nesting_depth, "params": fn.params_count} for fn in f.functions],
            "issues": [{"id": i.id, "ruleId": i.rule_id, "severity": i.severity.name, "line": i.line, "message": i.message}
                       for i in f.issues],
        })
    d = summary_dict(a)
    d["files"] = files
    return d


def build_stats(db: Session, user: User) -> dict:
    analyses = list(db.scalars(visible_query(user).order_by(Analysis.created_at, Analysis.id)))
    severity = {k: 0 for k in SEVERITY_ORDER}
    rules: dict[str, int] = {}
    for a in analyses:
        for i in _issues(a):
            severity[i.severity.name] += 1
            rules[i.rule_id] = rules.get(i.rule_id, 0) + 1
    sums = [summary_dict(a) for a in analyses]
    scores = [s["score"] for s in sums if s["score"] is not None]
    names = {r.id: r.name for r in db.scalars(select(Rule))}
    top = sorted(rules.items(), key=lambda kv: (-kv[1], kv[0]))[:5]
    return {
        "total": len(analyses),
        "issues": sum(severity.values()),
        "critical": severity["critical"] + severity["high"],
        "avgScore": round(sum(scores) / len(scores)) if scores else None,
        "doneCount": sum(1 for a in analyses if a.status == "done"),
        "severity": severity,
        "topRules": [{"id": rid, "name": names.get(rid, rid), "count": n} for rid, n in top],
        "timeline": [{"id": s["id"], "title": s["title"], "issues": s["issuesCount"], "score": s["score"]} for s in sums],
        "recent": sorted(sums, key=lambda s: (s["createdAt"], s["id"]), reverse=True)[:4],
    }
