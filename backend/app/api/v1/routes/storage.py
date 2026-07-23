"""
Storage routes — plain S3 archive, decoupled from the AI ingestion pipeline.
Uploading here only puts the file in S3; it does not parse it, extract
products, or create Document/Job/ProcessedFile rows. Use /ingest/file for that.
"""
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, UploadFile

from app.services.storage import s3_storage

router = APIRouter(prefix="/storage", tags=["Storage"])


@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload one or more files directly to S3. No processing is triggered."""
    results = []
    for upload in files:
        key_name = f"{uuid.uuid4().hex[:8]}_{upload.filename}"
        s3_uri = s3_storage.upload_fileobj(upload.file, key_name)
        results.append({"filename": upload.filename, "s3_uri": s3_uri, "status": "uploaded"})
    return {"submitted": len(results), "results": results}


@router.get("/files")
def list_files():
    """List everything currently stored in the S3 bucket/prefix."""
    objects = s3_storage.list_objects()
    return [
        {
            "key": obj["Key"],
            "filename": Path(obj["Key"]).name,
            "size": obj["Size"],
            "last_modified": obj["LastModified"].isoformat(),
        }
        for obj in objects
    ]


@router.delete("/files")
def delete_file(key: str):
    """Delete an object from S3 by its key."""
    s3_storage.delete_object(key)
    return {"deleted": True, "key": key}
