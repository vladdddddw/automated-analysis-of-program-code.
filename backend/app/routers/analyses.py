"""CRUD аналізів, завантаження архіву, статистика й експорт."""
import json

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..errors import ApiError
from ..models import Analysis, User
from ..security import get_current_user
from ..schemas import AnalysisIn
from ..services import analyses as svc
from ..services.analyzer import analyze_files
from ..services.archive import ArchiveError, extract_python_files
from ..services.reports import analysis_to_html

router = APIRouter(prefix="/api", tags=["analyses"])


def _get_visible(db: Session, user: User, analysis_id: int) -> Analysis:
    a = db.scalar(svc.visible_query(user).where(Analysis.id == analysis_id))
    if a is None:
        raise ApiError(404, "Аналіз не знайдено")
    return a


@router.get("/analyses")
def list_analyses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = db.scalars(svc.visible_query(user).order_by(Analysis.created_at.desc(), Analysis.id.desc()))
    return [svc.summary_dict(a) for a in items]


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.detail_dict(_get_visible(db, user, analysis_id))


@router.post("/analyses", status_code=201)
def create_analysis(data: AnalysisIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    paths = [f.path for f in data.files]
    if len(set(paths)) != len(paths):
        raise ApiError(422, "Шляхи файлів мають бути унікальними")
    if sum(len(f.content.encode()) for f in data.files) > settings.max_code_bytes:
        raise ApiError(413, "Розмір коду перевищує 1 МБ")
    result = analyze_files([(f.path, f.content) for f in data.files], svc.rule_configs(db))
    title = data.title.strip() or (data.files[0].path if data.source_type == "file" else "Фрагмент коду")
    analysis = svc.save_analysis(db, user, title, data.source_type, result)
    return svc.detail_dict(analysis)


@router.post("/analyses/archive", status_code=201)
async def create_from_archive(
    file: UploadFile = File(...),
    title: str = Form(default=""),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = await file.read(settings.max_archive_bytes + 1)
    try:
        files = extract_python_files(data)
    except ArchiveError as exc:
        raise ApiError(400, str(exc)) from exc
    result = analyze_files(files, svc.rule_configs(db))
    analysis = svc.save_analysis(db, user, title.strip() or file.filename or "Архів", "archive", result)
    return svc.detail_dict(analysis)


@router.delete("/analyses/{analysis_id}", status_code=204)
def delete_analysis(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_get_visible(db, user, analysis_id))
    db.commit()
    return Response(status_code=204)


@router.get("/analyses/{analysis_id}/export")
def export_analysis(analysis_id: int, format: str = Query("json", pattern="^(json|html)$"),
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = _get_visible(db, user, analysis_id)
    if format == "html":
        return Response(analysis_to_html(a), media_type="text/html",
                        headers={"Content-Disposition": f'attachment; filename="analysis-{a.id}.html"'})
    data = svc.detail_dict(a)
    for f in data["files"]:
        f.pop("content", None)
    return Response(json.dumps(data, ensure_ascii=False, indent=2), media_type="application/json",
                    headers={"Content-Disposition": f'attachment; filename="analysis-{a.id}.json"'})


@router.get("/stats")
def stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.build_stats(db, user)
