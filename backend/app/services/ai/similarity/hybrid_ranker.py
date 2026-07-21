"""
Hybrid ranker — combines semantic text search with optional SQL filters.
Uses text embeddings from pgvector, then hydrates results from PostgreSQL.
"""
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import MediaAsset, Product, ProductImage
from app.schemas.search import SearchResultItem
from app.services.ai.embeddings import vector_store
from app.services.ai.embeddings.text_embedding import TextEmbeddingService

logger = logging.getLogger(__name__)
_embed = TextEmbeddingService()


class HybridRanker:
    def search_text(
        self,
        query: str,
        limit: int = 20,
        filters: dict[str, Any] | None = None,
        db: Session | None = None,
    ) -> list[SearchResultItem]:
        """
        1. Semantic search via CLIP text embeddings → candidate product IDs.
        2. Apply optional SQL filters to narrow down.
        3. Return ranked SearchResultItem list.
        """
        raw = _embed.query(text=query, n_results=limit * 3)
        if not raw or db is None:
            return []
        return self._hydrate(raw, limit=limit, filters=filters, db=db)

    def find_similar_to_product(
        self,
        product_id: str,
        limit: int = 10,
        db: Session | None = None,
    ) -> list[SearchResultItem]:
        """
        Find products similar to an existing one, reusing its stored text
        embedding (no LLM/embedding call needed) so a user can quickly see
        comparable products — and their prices — while developing a new one.
        """
        if db is None:
            return []

        vector = vector_store.get_vector("product_text", product_id)
        if vector is None:
            # Embedding was never generated for this product (best-effort at
            # ingest time) — fall back to re-embedding its own text fields.
            product = db.query(Product).filter_by(id=product_id).first()
            if not product:
                return []
            text_for_embed = " ".join(
                filter(None, [product.title, product.category, product.material, product.style, product.description])
            )
            if not text_for_embed.strip():
                return []
            raw = _embed.query(text=text_for_embed, n_results=limit + 1)
        else:
            raw = vector_store.query("product_text", vector, n_results=limit + 1)

        if not raw:
            return []
        return self._hydrate(raw, limit=limit, filters=None, db=db, exclude_id=product_id)

    def _hydrate(
        self,
        raw: list[dict],
        limit: int,
        filters: dict[str, Any] | None,
        db: Session,
        exclude_id: str | None = None,
    ) -> list[SearchResultItem]:
        candidate_ids = [r["entity_id"] for r in raw if r["entity_id"] != exclude_id]
        score_map = {r["entity_id"]: r["score"] for r in raw}
        if not candidate_ids:
            return []

        q = db.query(Product).filter(Product.id.in_(candidate_ids))

        if filters:
            if filters.get("category"):
                q = q.filter(Product.category.ilike(f"%{filters['category']}%"))
            if filters.get("supplier_name"):
                q = q.filter(Product.supplier_name.ilike(f"%{filters['supplier_name']}%"))
            if filters.get("material"):
                q = q.filter(Product.material.ilike(f"%{filters['material']}%"))
            if filters.get("min_price") is not None:
                q = q.filter(Product.price >= filters["min_price"])
            if filters.get("max_price") is not None:
                q = q.filter(Product.price <= filters["max_price"])

        products = q.all()

        # Sort by embedding score (highest first)
        products.sort(key=lambda p: score_map.get(p.id, 0), reverse=True)

        results = []
        for p in products[:limit]:
            image_url = _first_image_url(p, db)
            results.append(
                SearchResultItem(
                    product_id=p.id,
                    title=p.title,
                    category=p.category,
                    supplier_name=p.supplier_name,
                    price=p.price,
                    currency=p.currency,
                    score=score_map.get(p.id, 0.0),
                    image_url=image_url,
                    description=p.description,
                )
            )

        return results


def _first_image_url(product: Product, db: Session) -> str | None:
    pi = db.query(ProductImage).filter_by(product_id=product.id).order_by(ProductImage.rank).first()
    if not pi:
        return None
    asset = db.query(MediaAsset).filter_by(id=pi.media_asset_id).first()
    if asset and asset.document_id and asset.filename:
        return f"/api/v1/files/pics/{asset.document_id}/{asset.filename}"
    return None
