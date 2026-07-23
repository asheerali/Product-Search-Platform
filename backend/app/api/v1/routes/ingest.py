import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import http_bad_request
from app.db.models import Document, IngestionJob, MediaAsset, ProcessedFile, Product, ProductImage
from app.schemas.document import (
    DocumentOut,
    FolderIngestRequest,
    IngestionJobOut,
    ProcessedFileOut,
)
from app.services.ai.embeddings import vector_store
from app.services.ingestion.deduplication import compute_file_hash
from app.services.storage import s3_storage
from app.workers.ingestion_worker import enqueue_document

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

ALLOWED_EXTENSIONS = {
    ".pdf", ".pptx", ".xlsx", ".xls", ".jpg", ".jpeg", ".png", ".webp", ".eml", ".msg",
}


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
        ".eml": "eml",
        ".msg": "msg",
    }
    return mapping.get(ext, "unknown")


def _register_and_enqueue(
    file_path: str,
    filename: str,
    supplier_name: str | None,
    db: Session,
    background_tasks: BackgroundTasks,
    original_path: str | None = None,
    cleanup_after: bool = False,
) -> dict:
    """
    Hash the file, check for duplicates, create Document + Job rows, and
    enqueue the background processing task. Returns a status dict.

    file_path is where the pipeline reads the file from (must be local).
    original_path is what's recorded as the document's source of truth
    (defaults to file_path) — pass an s3:// URI when file_path is just a
    local temp copy of a file already archived elsewhere.
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
        original_path=original_path or file_path,
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

    background_tasks.add_task(enqueue_document, doc.id, file_path, job.id, cleanup_after)

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
    # Every uploaded original is archived to S3; the local copy is just a
    # working file for the pipeline to parse and is deleted once processed.
    temp_dir = Path(settings.UPLOAD_TEMP_DIR)
    temp_dir.mkdir(parents=True, exist_ok=True)

    for upload in files:
        ext = Path(upload.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            results.append({"filename": upload.filename, "status": "skipped", "reason": "unsupported_type"})
            continue

        # Prefixed to avoid collisions between suppliers uploading same-named files.
        temp_path = temp_dir / f"{uuid.uuid4().hex[:8]}_{upload.filename}"
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(upload.file, f)

        s3_uri = s3_storage.upload_original(str(temp_path), upload.filename)

        result = _register_and_enqueue(
            file_path=str(temp_path),
            filename=upload.filename,
            supplier_name=supplier_name,
            db=db,
            background_tasks=background_tasks,
            original_path=s3_uri,
            cleanup_after=True,
        )
        if result.get("status") == "skipped":
            # Duplicate/unsupported — already archived to S3, just drop the local temp copy.
            temp_path.unlink(missing_ok=True)
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
    filename: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(ProcessedFile)
    if filename:
        q = q.filter(ProcessedFile.filename.ilike(f"%{filename}%"))
    files = q.order_by(ProcessedFile.processed_at.desc()).offset(offset).limit(limit).all()

    out = []
    for pf in files:
        d = ProcessedFileOut.model_validate(pf)
        doc = db.query(Document).filter_by(id=pf.document_id).first() if pf.document_id else None
        if doc:
            d.file_type = doc.file_type
            d.status = doc.status
            d.supplier_name = doc.supplier_name
        out.append(d)
    return out


# ---------------------------------------------------------------------------
# POST /ingest/jobs/{job_id}/cancel  — stop an in-progress job
# ---------------------------------------------------------------------------
@router.post("/jobs/{job_id}/cancel", response_model=IngestionJobOut)
def cancel_job(job_id: str, db: Session = Depends(get_db)):
    """
    Mark a job as cancelled. The running pipeline checks this flag between
    stages and stops at the next checkpoint (it cannot be interrupted
    mid-stage, but no further stages will run).
    """
    job = db.query(IngestionJob).filter_by(id=job_id).first()
    if not job:
        raise http_bad_request(f"Job {job_id} not found")
    if job.status in ("done", "error", "cancelled"):
        raise http_bad_request(f"Job is already {job.status}")

    job.status = "cancelled"
    job.error_message = "Cancelled by user"
    job.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


# ---------------------------------------------------------------------------
# POST /ingest/jobs/cancel-all  — stop every in-progress job at once
# (e.g. after a folder ingest queued many files and you want to abort all of them)
# ---------------------------------------------------------------------------
@router.post("/jobs/cancel-all")
def cancel_all_jobs(db: Session = Depends(get_db)):
    jobs = db.query(IngestionJob).filter(IngestionJob.status.in_(["pending", "queued", "running"])).all()
    for job in jobs:
        job.status = "cancelled"
        job.error_message = "Cancelled by user"
        job.completed_at = datetime.utcnow()
    db.commit()
    return {"cancelled_count": len(jobs)}


# ---------------------------------------------------------------------------
# DELETE /ingest/processed-files/{file_id}  — remove a file and everything
# derived from it (jobs, products, images, embeddings, pics/ folder)
# ---------------------------------------------------------------------------
@router.delete("/processed-files/{file_id}")
def delete_processed_file(file_id: str, db: Session = Depends(get_db)):
    pf = db.query(ProcessedFile).filter_by(id=file_id).first()
    if not pf:
        raise http_bad_request(f"Processed file {file_id} not found")

    document_id = pf.document_id

    if document_id:
        products = db.query(Product).filter_by(document_id=document_id).all()
        for p in products:
            db.query(ProductImage).filter_by(product_id=p.id).delete()
            vector_store.delete("product_text", p.id)
            db.delete(p)

        assets = db.query(MediaAsset).filter_by(document_id=document_id).all()
        for a in assets:
            vector_store.delete("product_images", a.id)
            db.delete(a)

        db.flush()  # products/assets must be gone before the FK-constrained bulk deletes below

        db.query(IngestionJob).filter_by(document_id=document_id).delete()
        db.query(ProcessedFile).filter_by(document_id=document_id).delete()
        db.query(Document).filter_by(id=document_id).delete()
    else:
        db.delete(pf)

    db.commit()

    if document_id:
        folder = Path(settings.PICS_DIR) / document_id
        if folder.exists():
            shutil.rmtree(folder, ignore_errors=True)

    return {"deleted": True, "document_id": document_id}
