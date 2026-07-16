from fastapi import APIRouter

from app.api.v1.routes import files, ingest, products, search

router = APIRouter(prefix="/api/v1")
router.include_router(ingest.router)
router.include_router(products.router)
router.include_router(search.router)
router.include_router(files.router)
