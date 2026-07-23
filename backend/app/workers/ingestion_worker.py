"""
Ingestion worker — runs the pipeline in a thread pool so FastAPI is not blocked.
Uses asyncio.to_thread to offload CPU/IO-heavy work off the event loop.
"""
import asyncio
import logging
import os

from app.services.ingestion.pipeline import run_pipeline

logger = logging.getLogger(__name__)


def enqueue_document(document_id: str, file_path: str, job_id: str, cleanup_after: bool = False):
    """
    Entry point called via FastAPI BackgroundTasks.
    Runs the full ingestion pipeline synchronously in the background thread.
    FastAPI's BackgroundTasks executes this in a threadpool by default.

    cleanup_after: delete file_path once the pipeline is done reading it. Used
    when file_path is a local temp copy whose durable original already lives
    in S3 (see ingest.py) — the temp copy has no further purpose either way.
    """
    logger.info("Worker: starting ingestion for doc %s", document_id)
    try:
        run_pipeline(document_id=document_id, file_path=file_path, job_id=job_id)
    except Exception as e:
        logger.exception("Worker: unhandled error for doc %s: %s", document_id, e)
    finally:
        if cleanup_after:
            try:
                os.unlink(file_path)
            except FileNotFoundError:
                pass
