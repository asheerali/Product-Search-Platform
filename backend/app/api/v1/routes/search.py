import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.search import SearchResponse, SearchResultItem, TextSearchRequest
from app.services.ai.similarity.hybrid_ranker import HybridRanker
from app.services.ai.similarity.image_matcher import ImageMatcher

router = APIRouter(prefix="/search", tags=["Search"])
_ranker = HybridRanker()
_matcher = ImageMatcher()


@router.post("/text", response_model=SearchResponse)
async def text_search(request: TextSearchRequest, db: Session = Depends(get_db)):
    """Semantic text search over all indexed products."""
    results = _ranker.search_text(
        query=request.query,
        limit=request.limit,
        filters=request.filters,
        db=db,
    )
    return SearchResponse(query=request.query, results=results, total=len(results))


@router.post("/image", response_model=SearchResponse)
async def image_search(
    file: UploadFile = File(...),
    limit: int = 20,
    db: Session = Depends(get_db),
):
    """Upload a furniture photo and find visually similar products."""
    tmp_path = Path(settings.UPLOAD_TEMP_DIR) / f"query_{file.filename}"
    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    results = _matcher.find_similar(str(tmp_path), limit=limit, db=db)
    tmp_path.unlink(missing_ok=True)
    return SearchResponse(query=f"image:{file.filename}", results=results, total=len(results))
