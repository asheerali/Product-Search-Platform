"""
Text embedding service using sentence-transformers (all-MiniLM-L6-v2).
Stores vectors in ChromaDB collection 'product_text'.
Model is loaded lazily on first use.
"""
import logging
from functools import lru_cache

from app.core.config import settings

logger = logging.getLogger(__name__)
COLLECTION_NAME = "product_text"
MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _load_model():
    from sentence_transformers import SentenceTransformer
    logger.info("Loading text embedding model: %s", MODEL_NAME)
    return SentenceTransformer(MODEL_NAME)


@lru_cache(maxsize=1)
def _get_collection():
    import chromadb
    client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


class TextEmbeddingService:
    def embed(self, text: str) -> list[float]:
        model = _load_model()
        vector = model.encode(text, normalize_embeddings=True)
        return vector.tolist()

    def upsert(self, entity_id: str, text: str):
        """Generate embedding and store/update it in ChromaDB."""
        vector = self.embed(text)
        col = _get_collection()
        col.upsert(
            ids=[entity_id],
            embeddings=[vector],
            documents=[text[:500]],  # store first 500 chars as metadata
        )

    def query(self, text: str, n_results: int = 20) -> list[dict]:
        """Return top-N similar product IDs with distance scores."""
        vector = self.embed(text)
        col = _get_collection()
        try:
            results = col.query(
                query_embeddings=[vector],
                n_results=min(n_results, col.count() or 1),
                include=["distances", "documents"],
            )
            ids = results["ids"][0]
            distances = results["distances"][0]
            return [
                {"entity_id": eid, "score": round(1 - dist, 4)}
                for eid, dist in zip(ids, distances)
            ]
        except Exception as e:
            logger.error("Text query failed: %s", e)
            return []
