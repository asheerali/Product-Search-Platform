"""
Lightweight vector store backed by SQLite + numpy.
No C++ compilation required.  Suitable for up to ~1M vectors.
For larger scale, swap this module for ChromaDB or Qdrant.

Schema:
  CREATE TABLE vector_store (
      id TEXT PRIMARY KEY,
      collection TEXT NOT NULL,
      embedding BLOB NOT NULL,   -- numpy float32 array serialised with np.save
      metadata TEXT              -- JSON string
  )
"""
import json
import logging
import sqlite3
from pathlib import Path
from typing import Optional

import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)

_DB_PATH = str(Path(settings.CHROMA_DB_PATH) / "vectors.db")


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(_DB_PATH, check_same_thread=False)
    c.execute("""
        CREATE TABLE IF NOT EXISTS vector_store (
            id         TEXT NOT NULL,
            collection TEXT NOT NULL,
            embedding  BLOB NOT NULL,
            metadata   TEXT,
            PRIMARY KEY (id, collection)
        )
    """)
    c.execute("CREATE INDEX IF NOT EXISTS idx_vs_collection ON vector_store(collection)")
    c.commit()
    return c


def _serialize(vector: list[float]) -> bytes:
    arr = np.array(vector, dtype=np.float32)
    import io
    buf = io.BytesIO()
    np.save(buf, arr)
    return buf.getvalue()


def _deserialize(blob: bytes) -> np.ndarray:
    import io
    return np.load(io.BytesIO(blob))


def upsert(collection: str, entity_id: str, vector: list[float], metadata: Optional[dict] = None):
    """Insert or replace an embedding."""
    blob = _serialize(vector)
    meta_str = json.dumps(metadata) if metadata else None
    with _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO vector_store (id, collection, embedding, metadata) VALUES (?, ?, ?, ?)",
            (entity_id, collection, blob, meta_str),
        )


def query(collection: str, query_vector: list[float], n_results: int = 20) -> list[dict]:
    """Return top-N items by cosine similarity (highest first)."""
    qvec = np.array(query_vector, dtype=np.float32)
    qnorm = np.linalg.norm(qvec)
    if qnorm == 0:
        return []

    with _conn() as c:
        rows = c.execute(
            "SELECT id, embedding, metadata FROM vector_store WHERE collection = ?",
            (collection,),
        ).fetchall()

    if not rows:
        return []

    ids, blobs, metas = zip(*rows)
    # Stack all embeddings into a matrix
    matrix = np.stack([_deserialize(b) for b in blobs])  # (N, D)
    # Cosine similarity
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1e-9, norms)
    matrix_normed = matrix / norms
    qvec_normed = qvec / qnorm
    scores = matrix_normed @ qvec_normed  # (N,)

    # Top-N
    top_indices = np.argsort(scores)[::-1][:n_results]
    return [
        {
            "entity_id": ids[i],
            "score": float(scores[i]),
            "metadata": json.loads(metas[i]) if metas[i] else {},
        }
        for i in top_indices
    ]


def count(collection: str) -> int:
    with _conn() as c:
        row = c.execute(
            "SELECT COUNT(*) FROM vector_store WHERE collection = ?", (collection,)
        ).fetchone()
    return row[0] if row else 0
