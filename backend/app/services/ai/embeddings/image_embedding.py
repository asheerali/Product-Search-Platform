"""
Image embedding service using CLIP (clip-ViT-B-32 via sentence-transformers).
Stores vectors in ChromaDB collection 'product_images'.
Model is loaded lazily on first use.
"""
import logging
from functools import lru_cache

from app.core.config import settings

logger = logging.getLogger(__name__)
COLLECTION_NAME = "product_images"
MODEL_NAME = "clip-ViT-B-32"


@lru_cache(maxsize=1)
def _load_clip():
    from sentence_transformers import SentenceTransformer
    logger.info("Loading CLIP image embedding model: %s", MODEL_NAME)
    return SentenceTransformer(MODEL_NAME)


@lru_cache(maxsize=1)
def _get_collection():
    import chromadb
    client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


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
        """Generate CLIP embedding and store/update in ChromaDB."""
        vector = self.embed_path(image_path)
        if vector is None:
            return
        col = _get_collection()
        col.upsert(
            ids=[asset_id],
            embeddings=[vector],
            metadatas=[{"path": image_path}],
        )

    def query(self, image_path: str, n_results: int = 20) -> list[dict]:
        """Find visually similar images by CLIP cosine similarity."""
        vector = self.embed_path(image_path)
        if vector is None:
            return []
        col = _get_collection()
        try:
            count = col.count()
            if count == 0:
                return []
            results = col.query(
                query_embeddings=[vector],
                n_results=min(n_results, count),
                include=["distances", "metadatas"],
            )
            ids = results["ids"][0]
            distances = results["distances"][0]
            metadatas = results["metadatas"][0]
            return [
                {"asset_id": aid, "score": round(1 - dist, 4), "path": meta.get("path", "")}
                for aid, dist, meta in zip(ids, distances, metadatas)
            ]
        except Exception as e:
            logger.error("Image query failed: %s", e)
            return []
