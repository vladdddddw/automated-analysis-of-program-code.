"""Безпечне читання .zip-архіву з Python-файлами.

Захист: розмір архіву й кількість файлів обмежені, шляхи з «..» та абсолютні шляхи відкидаються
(path traversal), розпакування виконується в пам'яті (на диск нічого не пишеться), розмір
кожного файлу перевіряється за заголовком і під час читання (захист від «zip-бомби»).
"""
import io
import zipfile
from pathlib import PurePosixPath

from ..config import settings

MAX_FILE_BYTES = 1_000_000


class ArchiveError(ValueError):
    pass


def extract_python_files(data: bytes) -> list[tuple[str, str]]:
    if len(data) > settings.max_archive_bytes:
        raise ArchiveError("Розмір архіву перевищує 10 МБ")
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ArchiveError("Файл не є коректним .zip-архівом") from exc

    files: list[tuple[str, str]] = []
    total = 0
    for info in zf.infolist():
        if info.is_dir():
            continue
        name = info.filename.replace("\\", "/")
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts:
            continue  # небезпечний шлях – пропускаємо
        if path.suffix != ".py" or "__pycache__" in path.parts or any(p.startswith(".") for p in path.parts):
            continue
        if info.file_size > MAX_FILE_BYTES:
            raise ArchiveError(f"Файл «{name}» більший за 1 МБ")
        with zf.open(info) as fh:
            raw = fh.read(MAX_FILE_BYTES + 1)
        if len(raw) > MAX_FILE_BYTES:
            raise ArchiveError(f"Файл «{name}» більший за 1 МБ")
        total += len(raw)
        if total > settings.max_archive_bytes:
            raise ArchiveError("Сумарний розмір файлів в архіві завеликий")
        files.append((str(path), raw.decode("utf-8", errors="replace")))
        if len(files) > settings.max_archive_files:
            raise ArchiveError(f"В архіві забагато файлів .py (максимум {settings.max_archive_files})")
    if not files:
        raise ArchiveError("В архіві немає файлів .py")
    return files
