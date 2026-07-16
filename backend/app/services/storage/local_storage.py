"""
Local file storage utilities.
All files are stored on the local filesystem (no S3 for now).
"""
import os
import shutil
from pathlib import Path

from app.core.config import settings


def ensure_dir(path: str) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def pics_dir_for(document_id: str) -> Path:
    return ensure_dir(str(Path(settings.PICS_DIR) / document_id))


def move_to_pics(source_path: str, document_id: str, filename: str) -> str:
    """Move a file into pics/{document_id}/ and return the new absolute path."""
    dest_dir = pics_dir_for(document_id)
    dest_path = dest_dir / filename
    shutil.move(source_path, str(dest_path))
    return str(dest_path)


def delete_file(path: str):
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass


def file_size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0
