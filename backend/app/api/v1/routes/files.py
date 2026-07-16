from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.exceptions import http_not_found

router = APIRouter(prefix="/files", tags=["Files"])


@router.get("/pics/{document_id}/{filename}")
def serve_extracted_image(document_id: str, filename: str):
    """Serve an extracted product image from the local pics directory."""
    path = Path(settings.PICS_DIR) / document_id / filename
    if not path.exists():
        raise http_not_found("Image not found")
    return FileResponse(str(path))
