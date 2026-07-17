"""
Image embedding service using CLIP (clip-ViT-B-32 via sentence-transformers).
Stores vectors in PostgreSQL using pgvector.
Model is loaded lazily on first use.
"""
import logging
from functools import lru_cache

from app.services.ai.embeddings import vector_store as vs

logger = logging.getLogger(__name__)
COLLECTION_NAME = "product_images"
MODEL_NAME = "clip-ViT-B-32"


@lru_cache(maxsize=1)
def _load_clip():
    from sentence_transformers import SentenceTransformer
    logger.info("Loading CLIP image embedding model: %s", MODEL_NAME)
    return SentenceTransformer(MODEL_NAME)


class ImageEmbeddingService:
    def embed_path(self, image_path: str) -> list[float] | None:
        """Compute CLIP embedding for an image file. Returns None on failure."""
        try:
            from PIL import Image
            model = _load_clip()
            img = Image.open(image_path).convert("RGB")
            vector = model.encode(img, normalize_embeddings=True)
            return vector.tolist()
        except Exception as e:
            logger.warning("Image embedding failed for %s: %s", image_path, e)
            return None

    def upsert(self, asset_id: str, image_path: str):
        """Generate CLIP embedding and store/update in the vector store."""
        vector = self.embed_path(image_path)
        if vector is None:
            return
        vs.upsert(COLLECTION_NAME, asset_id, vector, metadata={"path": image_path})

    def query(self, image_path: str, n_results: int = 20) -> list[dict]:
        """Find visually similar images by CLIP cosine similarity."""
        vector = self.embed_path(image_path)
        if vector is None:
            return []
        try:
            count = vs.count(COLLECTION_NAME)
            if count == 0:
                return []
            results = vs.query(COLLECTION_NAME, vector, n_results=min(n_results, count))
            return [
                {
                    "asset_id": r["entity_id"],
                    "score": r["score"],
                    "path": r["metadata"].get("path", ""),
                }
                for r in results
            ]
        except Exception as e:
            logger.error("Image query failed: %s", e)
            return []
