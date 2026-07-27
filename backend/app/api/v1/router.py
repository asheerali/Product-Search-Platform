from fastapi import APIRouter, Depends

from app.api.v1.routes import auth, files, ingest, products, search, storage
from app.core.security import get_current_user

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
# Image bytes only, unprotected — <img> tags can't send an Authorization
# header, and most of these now resolve to public S3 URLs anyway.
router.include_router(files.router)

_auth_dep = [Depends(get_current_user)]
router.include_router(ingest.router, dependencies=_auth_dep)
router.include_router(products.router, dependencies=_auth_dep)
router.include_router(search.router, dependencies=_auth_dep)
router.include_router(storage.router, dependencies=_auth_dep)
