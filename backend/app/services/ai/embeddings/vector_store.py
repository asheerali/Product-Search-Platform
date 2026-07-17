"""
PostgreSQL + pgvector-backed vector store.
Stores embeddings in the embeddings table with cosine similarity search.
"""
import json
from typing import Optional

from sqlalchemy import text

from app.core.database import SessionLocal


def upsert(collection: str, entity_id: str, vector: list[float], metadata: Optional[dict] = None):
    db = SessionLocal()
    try:
        db.execute(
            text(
                """
                INSERT INTO embeddings (entity_id, collection, embedding, metadata)
                VALUES (:entity_id, :collection, CAST(:embedding AS vector), CAST(:metadata AS jsonb))
                ON CONFLICT (entity_id, collection)
                DO UPDATE SET embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata
                """
            ),
            {
                "entity_id": entity_id,
                "collection": collection,
                "embedding": str(vector),
                "metadata": "{}" if metadata is None else json.dumps(metadata),
            },
        )
        db.commit()
    finally:
        db.close()


def query(collection: str, query_vector: list[float], n_results: int = 20) -> list[dict]:
    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT
                    entity_id,
                    metadata,
                    1 - (embedding <=> CAST(:query_vector AS vector)) AS score
                FROM embeddings
                WHERE collection = :collection
                ORDER BY embedding <=> CAST(:query_vector AS vector)
                LIMIT :limit
                """
            ),
            {
                "collection": collection,
                "query_vector": str(query_vector),
                "limit": n_results,
            },
        ).fetchall()

        out = []
        for row in rows:
            if isinstance(row.metadata, dict):
                metadata = row.metadata
            elif isinstance(row.metadata, str):
                try:
                    metadata = json.loads(row.metadata)
                except json.JSONDecodeError:
                    metadata = {}
            else:
                metadata = {}
            out.append({"entity_id": row.entity_id, "score": float(row.score), "metadata": metadata})
        return out
    finally:
        db.close()


def count(collection: str) -> int:
    db = SessionLocal()
    try:
        row = db.execute(
            text("SELECT COUNT(*) AS c FROM embeddings WHERE collection = :collection"),
            {"collection": collection},
        ).fetchone()
        return int(row.c if row else 0)
    finally:
        db.close()
