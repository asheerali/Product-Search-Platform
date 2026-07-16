from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models import Document, ProcessedFile


def is_file_processed(content_hash: str, db: Session) -> tuple[bool, str | None]:
    """
    Returns (is_duplicate, existing_document_id).
    Checks by sha256 hash — if any file with the same content was already
    ingested, even under a different name, it is considered a duplicate.
    """
    existing = db.query(ProcessedFile).filter_by(content_hash=content_hash).first()
    if existing:
        return True, existing.document_id
    return False, None


def get_processed_filenames(db: Session) -> set[str]:
    """Return a set of all filenames that were ever successfully processed."""
    rows = db.query(ProcessedFile.filename).all()
    return {r.filename for r in rows}
