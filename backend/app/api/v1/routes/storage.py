"""
Storage routes — plain S3 archive, decoupled from the AI ingestion pipeline.
Uploading here only puts the file in S3; it does not parse it, extract
products, or create Document/Job/ProcessedFile rows. Use /ingest/file for that.
"""
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, UploadFile

from app.services.storage import s3_storage

router = APIRouter(prefix="/storage", tags=["Storage"])


@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """
    Upload one or more files directly to S3, keyed by their original filename.
    No processing is triggered. Re-uploading the same filename overwrites the
    existing object rather than creating a duplicate.
    """
    results = []
    for upload in files:
        s3_uri = s3_storage.upload_fileobj(upload.file, upload.filename)
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
