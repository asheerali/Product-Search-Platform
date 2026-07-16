import os
import shutil
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import http_bad_request
from app.db.models import Document, IngestionJob, ProcessedFile
from app.schemas.document import (
    DocumentOut,
    FolderIngestRequest,
    IngestionJobOut,
    ProcessedFileOut,
)
from app.services.ingestion.deduplication import compute_file_hash
from app.workers.ingestion_worker import enqueue_document

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

ALLOWED_EXTENSIONS = {".pdf", ".pptx", ".xlsx", ".xls", ".jpg", ".jpeg", ".png", ".webp"}


def _get_file_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    mapping = {
        ".pdf": "pdf",
        ".pptx": "pptx",
        ".xlsx": "xlsx",
        ".xls": "xlsx",
        ".jpg": "image",
        ".jpeg": "image",
        ".png": "image",
        ".webp": "image",
    }
    return mapping.get(ext, "unknown")


def _register_and_enqueue(
    file_path: str,
    filename: str,
    supplier_name: str | None,
    db: Session,
    background_tasks: BackgroundTasks,
) -> dict:
    """
    Hash the file, check for duplicates, create Document + Job rows, and
    enqueue the background processing task. Returns a status dict.
    """
    content_hash = compute_file_hash(file_path)

    # -- Duplicate check: same hash → already processed
    existing = db.query(ProcessedFile).filter_by(content_hash=content_hash).first()
    if existing:
        return {
            "filename": filename,
            "status": "skipped",
            "reason": "duplicate",
            "existing_document_id": existing.document_id,
        }

    file_type = _get_file_type(filename)
    if file_type == "unknown":
        return {"filename": filename, "status": "skipped", "reason": "unsupported_type"}

    file_size = os.path.getsize(file_path)

    doc = Document(
        filename=filename,
        original_path=file_path,
        file_type=file_type,
        file_size=file_size,
        content_hash=content_hash,
        supplier_name=supplier_name,
        status="pending",
    )
    db.add(doc)
    db.flush()

    job = IngestionJob(document_id=doc.id, stage="queued", status="pending")
    db.add(job)

    pf = ProcessedFile(
        filename=filename,
        content_hash=content_hash,
        file_size=file_size,
        document_id=doc.id,
    )
    db.add(pf)
    db.commit()

    background_tasks.add_task(enqueue_document, doc.id, file_path, job.id)

    return {"filename": filename, "status": "queued", "document_id": doc.id, "job_id": job.id}


# ---------------------------------------------------------------------------
# POST /ingest/file  — upload one or more files directly
# ---------------------------------------------------------------------------
@router.post("/file")
async def ingest_file(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    supplier_name: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    """Accept file uploads and queue them for ingestion."""
    results = []
    tmp_dir = Path(settings.UPLOAD_TEMP_DIR)

    for upload in files:
        ext = Path(upload.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            results.append({"filename": upload.filename, "status": "skipped", "reason": "unsupported_type"})
            continue

        # Save to temp location
        tmp_path = tmp_dir / upload.filename
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(upload.file, f)

        result = _register_and_enqueue(
            file_path=str(tmp_path),
            filename=upload.filename,
            supplier_name=supplier_name,
            db=db,
            background_tasks=background_tasks,
        )
        results.append(result)

    return {"submitted": len(results), "results": results}


# ---------------------------------------------------------------------------
# POST /ingest/folder  — provide a server-side folder path
# ---------------------------------------------------------------------------
@router.post("/folder")
def ingest_folder(
    request: FolderIngestRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Scan a local folder path and queue all supported files.
    Files that were already processed (by hash) are silently skipped.
    """
    folder = Path(request.folder_path)
    if not folder.exists() or not folder.is_dir():
        raise http_bad_request(f"Folder not found: {request.folder_path}")

    pattern = "**/*" if request.recursive else "*"
    all_files = [f for f in folder.glob(pattern) if f.is_file()]
    supported = [f for f in all_files if f.suffix.lower() in ALLOWED_EXTENSIONS]

    results = []
    for file_path in supported:
        result = _register_and_enqueue(
            file_path=str(file_path),
            filename=file_path.name,
            supplier_name=request.supplier_name,
            db=db,
            background_tasks=background_tasks,
        )
        results.append(result)

    return {
        "folder": str(folder),
        "total_found": len(all_files),
        "supported": len(supported),
        "submitted": len(results),
        "results": results,
    }


# ---------------------------------------------------------------------------
# GET /ingest/jobs  — list all jobs
# ---------------------------------------------------------------------------
@router.get("/jobs", response_model=List[IngestionJobOut])
def list_jobs(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    return db.query(IngestionJob).order_by(IngestionJob.created_at.desc()).offset(offset).limit(limit).all()


# ---------------------------------------------------------------------------
# GET /ingest/jobs/{job_id}  — single job status
# ---------------------------------------------------------------------------
@router.get("/jobs/{job_id}", response_model=IngestionJobOut)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(IngestionJob).filter_by(id=job_id).first()
    if not job:
        raise http_bad_request(f"Job {job_id} not found")
    return job


# ---------------------------------------------------------------------------
# GET /ingest/processed-files  — what has already been ingested
# ---------------------------------------------------------------------------
@router.get("/processed-files", response_model=List[ProcessedFileOut])
def list_processed_files(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    return db.query(ProcessedFile).order_by(ProcessedFile.processed_at.desc()).offset(offset).limit(limit).all()
