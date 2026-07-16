"""
Ingestion worker — runs the pipeline in a thread pool so FastAPI is not blocked.
Uses asyncio.to_thread to offload CPU/IO-heavy work off the event loop.
"""
import asyncio
import logging

from app.services.ingestion.pipeline import run_pipeline

logger = logging.getLogger(__name__)


def enqueue_document(document_id: str, file_path: str, job_id: str):
    """
    Entry point called via FastAPI BackgroundTasks.
    Runs the full ingestion pipeline synchronously in the background thread.
    FastAPI's BackgroundTasks executes this in a threadpool by default.
    """
    logger.info("Worker: starting ingestion for doc %s", document_id)
    try:
        run_pipeline(document_id=document_id, file_path=file_path, job_id=job_id)
    except Exception as e:
        logger.exception("Worker: unhandled error for doc %s: %s", document_id, e)
