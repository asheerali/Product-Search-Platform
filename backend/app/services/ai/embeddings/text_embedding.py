"""
Text embedding service using sentence-transformers (all-MiniLM-L6-v2).
Stores vectors in PostgreSQL using pgvector.
Model is loaded lazily on first use.
"""
import logging
from functools import lru_cache

from app.services.ai.embeddings import vector_store as vs

logger = logging.getLogger(__name__)
COLLECTION_NAME = "product_text"
MODEL_NAME = "all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def _load_model():
    from sentence_transformers import SentenceTransformer
    logger.info("Loading text embedding model: %s", MODEL_NAME)
    return SentenceTransformer(MODEL_NAME)


class TextEmbeddingService:
    def embed(self, text: str) -> list[float]:
        model = _load_model()
        vector = model.encode(text, normalize_embeddings=True)
        return vector.tolist()

    def upsert(self, entity_id: str, text: str):
        """Generate embedding and store/update it in the vector store."""
        vector = self.embed(text)
        vs.upsert(COLLECTION_NAME, entity_id, vector, metadata={"text": text[:200]})

    def query(self, text: str, n_results: int = 20) -> list[dict]:
        """Return top-N similar product IDs with cosine similarity scores."""
        vector = self.embed(text)
        try:
            return vs.query(COLLECTION_NAME, vector, n_results=n_results)
        except Exception as e:
            logger.error("Text query failed: %s", e)
            return []
