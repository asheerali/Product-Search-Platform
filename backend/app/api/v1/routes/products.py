from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import http_bad_request, http_not_found
from app.db.models import MediaAsset, Product, ProductImage
from app.schemas.product import MediaAssetOut, ProductListResponse, ProductOut
from app.schemas.search import SearchResponse
from app.services.ai.embeddings import vector_store
from app.services.ai.similarity.hybrid_ranker import HybridRanker

router = APIRouter(prefix="/products", tags=["Products"])
_ranker = HybridRanker()


def _build_image_urls(product: Product) -> list[str]:
    return [
        f"/api/v1/files/pics/{pi.media_asset.document_id}/{pi.media_asset.filename}"
        for pi in product.images
        if pi.media_asset
    ]


@router.get("", response_model=ProductListResponse)
def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    title: Optional[str] = None,
    category: Optional[str] = None,
    supplier_name: Optional[str] = None,
    material: Optional[str] = None,
    style: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Product)
    if title:
        q = q.filter(Product.title.ilike(f"%{title}%"))
    if category:
        q = q.filter(Product.category.ilike(f"%{category}%"))
    if supplier_name:
        q = q.filter(Product.supplier_name.ilike(f"%{supplier_name}%"))
    if material:
        q = q.filter(Product.material.ilike(f"%{material}%"))
    if style:
        q = q.filter(Product.style.ilike(f"%{style}%"))
    if min_price is not None:
        q = q.filter(Product.price >= min_price)
    if max_price is not None:
        q = q.filter(Product.price <= max_price)

    total = q.count()
    items = q.offset((page - 1) * limit).limit(limit).all()

    out = []
    for p in items:
        d = ProductOut.model_validate(p)
        d.image_urls = _build_image_urls(p)
        out.append(d)

    return ProductListResponse(total=total, page=page, limit=limit, items=out)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: str, db: Session = Depends(get_db)):
    p = db.query(Product).filter_by(id=product_id).first()
    if not p:
        raise http_not_found(f"Product {product_id} not found")
    d = ProductOut.model_validate(p)
    d.image_urls = _build_image_urls(p)
    return d


@router.get("/{product_id}/images", response_model=List[MediaAssetOut])
def get_product_images(product_id: str, db: Session = Depends(get_db)):
    p = db.query(Product).filter_by(id=product_id).first()
    if not p:
        raise http_not_found(f"Product {product_id} not found")
    return [pi.media_asset for pi in p.images if pi.media_asset]


@router.get("/{product_id}/similar", response_model=SearchResponse)
def get_similar_products(product_id: str, limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    p = db.query(Product).filter_by(id=product_id).first()
    if not p:
        raise http_not_found(f"Product {product_id} not found")
    results = _ranker.find_similar_to_product(product_id, limit=limit, db=db)
    return SearchResponse(query=f"similar:{product_id}", results=results, total=len(results))


def _delete_product(p: Product, db: Session):
    db.query(ProductImage).filter_by(product_id=p.id).delete()
    vector_store.delete("product_text", p.id)
    db.delete(p)


@router.delete("/{product_id}")
def delete_product(product_id: str, db: Session = Depends(get_db)):
    p = db.query(Product).filter_by(id=product_id).first()
    if not p:
        raise http_not_found(f"Product {product_id} not found")
    _delete_product(p, db)
    db.commit()
    return {"deleted": True, "id": product_id}


@router.delete("")
def delete_products_bulk(
    title: Optional[str] = None,
    category: Optional[str] = None,
    supplier_name: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Bulk-delete products matching a filter — at least one filter is required."""
    if not (title or category or supplier_name):
        raise http_bad_request("At least one of title, category, or supplier_name is required")

    q = db.query(Product)
    if title:
        q = q.filter(Product.title.ilike(f"%{title}%"))
    if category:
        q = q.filter(Product.category.ilike(f"%{category}%"))
    if supplier_name:
        q = q.filter(Product.supplier_name.ilike(f"%{supplier_name}%"))

    products = q.all()
    for p in products:
        _delete_product(p, db)
    db.commit()
    return {"deleted_count": len(products)}
