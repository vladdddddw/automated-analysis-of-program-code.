"""Знімає еталонні результати з поточного аналізатора й експорту. Запускати лише на коді ДО рефакторингу:

    cd backend && python tests/golden/make_golden.py
"""
import json
import os
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))        # tests/
sys.path.insert(0, str(HERE.parent.parent))  # backend/

os.environ["DATABASE_URL"] = f"sqlite:///{(Path(tempfile.mkdtemp()) / 'g.db').as_posix()}"
os.environ["SECRET_KEY"] = "golden-secret"
os.environ["SEED_DEMO_DATA"] = "true"
os.environ["STATIC_DIR"] = str(Path(tempfile.mkdtemp()) / "none")

from fastapi.testclient import TestClient  # noqa: E402

import golden_utils as gu  # noqa: E402
from app.main import app  # noqa: E402

(HERE / "analyzer_golden.json").write_text(json.dumps(gu.analyze_corpus(), ensure_ascii=False, indent=1), encoding="utf8")

CODE = (HERE / "corpus" / "defects.txt").read_text(encoding="utf8")
with TestClient(app) as c:
    tok = c.post("/api/auth/login", json={"email": "student@example.com", "password": "student123"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    aid = c.post("/api/analyses", headers=h, json={"title": "golden", "sourceType": "file",
                                                   "files": [{"path": "defects.py", "content": CODE}]}).json()["id"]
    for fmt in ("json", "html"):
        r = c.get(f"/api/analyses/{aid}/export", params={"format": fmt}, headers=h)
        (HERE / f"export_{fmt}.golden").write_text(gu.normalize_export(r.text), encoding="utf8")
        print(fmt, r.status_code, r.headers["content-type"], r.headers["content-disposition"])
print("еталон записано")
