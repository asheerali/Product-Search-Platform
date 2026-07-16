"""
Image matcher — finds products visually similar to a query image.
Uses CLIP embeddings in ChromaDB, then resolves asset → product via SQL.
"""
import logging

from sqlalchemy.orm import Session

from app.db.models import MediaAsset, Product, ProductImage
from app.schemas.search import SearchResultItem
from app.services.ai.embeddings.image_embedding import ImageEmbeddingService

logger = logging.getLogger(__name__)
_embed = ImageEmbeddingService()


class ImageMatcher:
    def find_similar(
        self,
        query_image_path: str,
        limit: int = 20,
        db: Session | None = None,
    ) -> list[SearchResultItem]:
        """
        Given a query image path, return ranked products ordered by visual similarity.
        """
        raw = _embed.query(image_path=query_image_path, n_results=limit * 2)
        if not raw or db is None:
            return []

        results: list[SearchResultItem] = []
        seen_products: set[str] = set()

        for hit in raw:
            asset_id = hit["asset_id"]
            score = hit["score"]

            # Resolve asset → product
            pi = db.query(ProductImage).filter_by(media_asset_id=asset_id).first()
            if not pi:
                # Asset not linked to a product yet — skip
                continue

            product_id = pi.product_id
            if product_id in seen_products:
                continue
            seen_products.add(product_id)

            p = db.query(Product).filter_by(id=product_id).first()
            if not p:
                continue

            asset = db.query(MediaAsset).filter_by(id=asset_id).first()
            image_url = None
            if asset and asset.document_id and asset.filename:
                image_url = f"/api/v1/files/pics/{asset.document_id}/{asset.filename}"

            results.append(
                SearchResultItem(
                    product_id=p.id,
                    title=p.title,
                    category=p.category,
                    supplier_name=p.supplier_name,
                    price=p.price,
                    currency=p.currency,
                    score=score,
                    image_url=image_url,
                    description=p.description,
                )
            )
            if len(results) >= limit:
                break

        return results
