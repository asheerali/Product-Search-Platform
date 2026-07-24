"""
Ingestion pipeline — orchestrates parsing → AI normalization → DB persistence → embedding.
Each step is isolated; failures are caught and logged without crashing the whole job.
"""
import logging
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.db.models import Document, IngestionJob, MediaAsset, Product, ProductImage
from app.services.ai.embeddings.image_embedding import ImageEmbeddingService
from app.services.ai.embeddings.text_embedding import TextEmbeddingService
from app.services.ai.llm.product_analyzer import ProductAnalyzer
from app.services.ingestion.email_parser import parse_email
from app.services.ingestion.image_extractor import (
    get_image_metadata,
    save_extracted_image,
)
from app.services.ingestion.pdf_parser import parse_pdf
from app.services.ingestion.pptx_parser import parse_pptx
from app.services.ingestion.xlsx_parser import parse_xlsx
from app.services.storage import s3_storage

logger = logging.getLogger(__name__)

_analyzer = ProductAnalyzer()
_text_embed = TextEmbeddingService()
_image_embed = ImageEmbeddingService()


def _update_job(job_id: str, db: Session, stage: str, status: str, progress: int = 0, error: str | None = None):
    job = db.query(IngestionJob).filter_by(id=job_id).first()
    if job:
        job.stage = stage
        job.status = status
        job.progress = progress
        if error:
            job.error_message = error
        if status == "running" and not job.started_at:
            job.started_at = datetime.utcnow()
        if status in ("done", "error", "cancelled"):
            job.completed_at = datetime.utcnow()
        db.commit()


class PipelineCancelled(Exception):
    """Raised internally when a user cancels an in-progress job."""


def _raise_if_cancelled(job_id: str, db: Session):
    db.expire_all()  # pick up the "cancelled" status committed by the cancel endpoint
    job = db.query(IngestionJob).filter_by(id=job_id).first()
    if job and job.status == "cancelled":
        raise PipelineCancelled()


def run_pipeline(document_id: str, file_path: str, job_id: str):
    """
    Full ingestion pipeline for a single document.
    Runs synchronously — called from a background thread.
    """
    db = SessionLocal()
    try:
        doc = db.query(Document).filter_by(id=document_id).first()
        if not doc:
            logger.error("Document %s not found", document_id)
            return

        doc.status = "processing"
        db.commit()

        # ------------------------------------------------------------------ #
        # STAGE 1: Parse the file
        # ------------------------------------------------------------------ #
        _update_job(job_id, db, stage="parse", status="running", progress=10)
        logger.info("Parsing %s (%s)", doc.filename, doc.file_type)

        raw_text = ""
        all_tables: list[list[dict]] = []
        all_image_paths: list[str] = []
        pptx_result = None  # kept around so Stage 3/4 can process slide-by-slide

        pics_base = settings.PICS_DIR

        if doc.file_type == "pdf":
            result = parse_pdf(file_path, document_id, pics_base)
            raw_text = result.full_text
            all_tables = result.all_tables
            all_image_paths = result.all_image_paths

        elif doc.file_type == "pptx":
            pptx_result = parse_pptx(file_path, document_id, pics_base)
            raw_text = pptx_result.full_text
            all_tables = pptx_result.all_tables
            all_image_paths = pptx_result.all_image_paths

        elif doc.file_type == "xlsx":
            result = parse_xlsx(file_path, document_id, pics_base)
            all_tables = [result.all_rows]
            all_image_paths = result.all_image_paths
            raw_text = _rows_to_text(result.all_rows)

        elif doc.file_type in ("eml", "msg"):
            result = parse_email(file_path, document_id, pics_base)
            raw_text = result.full_text
            all_tables = result.all_tables
            all_image_paths = result.all_image_paths

        elif doc.file_type == "image":
            # Direct image upload — save to pics and skip text parsing
            with open(file_path, "rb") as f:
                image_bytes = f.read()
            saved = save_extracted_image(
                image_bytes=image_bytes,
                ext=Path(file_path).suffix.lstrip("."),
                document_id=document_id,
                source_ref="direct_upload",
                pics_base_dir=pics_base,
            )
            if saved:
                all_image_paths = [saved]

        _update_job(job_id, db, stage="parse", status="running", progress=30)
        _raise_if_cancelled(job_id, db)

        # ------------------------------------------------------------------ #
        # STAGE 2: Save media assets
        # ------------------------------------------------------------------ #
        saved_assets: list[MediaAsset] = []
        assets_by_hash: dict[str, MediaAsset] = {}
        assets_by_path: dict[str, MediaAsset] = {}  # lets Stage 3/4 look up a slide's own images
        for img_path in all_image_paths:
            meta = get_image_metadata(img_path)
            sha256 = meta.get("sha256")
            if not sha256:
                continue
            # A single document (e.g. a PPTX with a repeated logo/background
            # across slides) can yield the same image more than once — dedupe
            # within this batch too, not just against already-committed rows,
            # since autoflush=False means pending inserts here aren't visible
            # to the query below until commit.
            if sha256 in assets_by_hash:
                asset = assets_by_hash[sha256]
                saved_assets.append(asset)
                assets_by_path[img_path] = asset
                continue
            existing_asset = db.query(MediaAsset).filter_by(sha256=sha256).first()
            if existing_asset:
                assets_by_hash[sha256] = existing_asset
                saved_assets.append(existing_asset)
                assets_by_path[img_path] = existing_asset
                continue
            s3_url = None
            try:
                # Keyed by content hash (not the local filename) so the same
                # image reused across documents maps to one stable S3 object.
                s3_filename = f"{sha256[:16]}{Path(img_path).suffix}"
                s3_url = s3_storage.upload_product_photo(img_path, s3_filename)
            except Exception as e:
                logger.warning("Product photo S3 upload failed for %s: %s", img_path, e)

            asset = MediaAsset(
                document_id=document_id,
                source_type=doc.file_type,
                source_ref=Path(img_path).stem,
                local_path=img_path,
                s3_url=s3_url,
                filename=Path(img_path).name,
                sha256=sha256,
                phash=meta.get("phash"),
                width=meta.get("width"),
                height=meta.get("height"),
                mime_type=meta.get("mime_type"),
            )
            db.add(asset)
            assets_by_hash[sha256] = asset
            saved_assets.append(asset)
            assets_by_path[img_path] = asset
        db.commit()

        _update_job(job_id, db, stage="normalize", status="running", progress=50)
        _raise_if_cancelled(job_id, db)

        # ------------------------------------------------------------------ #
        # STAGE 3+4: AI product extraction + persist
        # ------------------------------------------------------------------ #
        _update_job(job_id, db, stage="persist", status="running", progress=70)
        _raise_if_cancelled(job_id, db)

        created_products: list[Product] = []
        products_data: list[dict] = []  # accumulated only for the final count in the log line

        if pptx_result is not None:
            # PPTX is processed slide-by-slide: one base product per slide
            # (possibly several size/config variants). Scoping extraction and
            # hero-image selection to each slide's own text/images — instead
            # of flattening the whole deck into one call — is what actually
            # fixes every product getting the same (often wrong) photo.
            for slide in pptx_result.slides:
                slide_text = f"Slide {slide.slide_number}: {slide.title}\n{slide.text}"
                slide_products: list[dict] = []

                if slide_text.strip():
                    try:
                        slide_products = _analyzer.extract_from_slide(
                            text=slide_text,
                            tables=slide.tables,
                            supplier_name=doc.supplier_name or "",
                        )
                    except Exception as e:
                        logger.warning("Slide %d text extraction failed: %s", slide.slide_number, e)

                slide_assets = [assets_by_path[p] for p in slide.image_paths if p in assets_by_path]

                # Same picture-only-slide fallback as below, scoped to this slide.
                if not slide_products and slide_assets:
                    for asset in slide_assets:
                        try:
                            slide_products.extend(
                                _analyzer.extract_from_image(asset.local_path, supplier_name=doc.supplier_name or "")
                            )
                        except Exception as e:
                            logger.warning(
                                "Slide %d image extraction failed for asset %s: %s", slide.slide_number, asset.id, e
                            )

                if not slide_products:
                    continue

                # Largest image on THIS slide — a decent proxy for "the actual
                # product photo" vs. a small logo/watermark on the same slide.
                slide_hero = (
                    max(slide_assets, key=lambda a: (a.width or 0) * (a.height or 0))
                    if slide_assets
                    else None
                )

                products_data.extend(slide_products)
                for pdata in slide_products:
                    created_products.append(_persist_product(pdata, document_id, doc, slide_hero, db))

        else:
            if raw_text.strip():
                try:
                    products_data = _analyzer.extract_from_text(
                        text=raw_text,
                        tables=all_tables,
                        supplier_name=doc.supplier_name or "",
                    )
                except Exception as e:
                    logger.warning("Text product extraction failed: %s", e)

            if doc.file_type == "image" and all_image_paths:
                try:
                    products_data.extend(
                        _analyzer.extract_from_image(all_image_paths[0], supplier_name=doc.supplier_name or "")
                    )
                except Exception as e:
                    logger.warning("Image product extraction failed: %s", e)

            # Fallback: PDFs/XLSX/emails can carry the actual product data as
            # a picture (e.g. a screenshotted spec sheet) rather than native
            # text/tables — in that case text extraction legitimately finds
            # nothing. Run vision analysis on the extracted images before
            # giving up, same as a direct image upload would get.
            if doc.file_type != "image" and not products_data and saved_assets:
                for asset in saved_assets:
                    try:
                        products_data.extend(
                            _analyzer.extract_from_image(asset.local_path, supplier_name=doc.supplier_name or "")
                        )
                    except Exception as e:
                        logger.warning("Fallback image product extraction failed for asset %s: %s", asset.id, e)

            hero_asset = (
                max(saved_assets, key=lambda a: (a.width or 0) * (a.height or 0))
                if saved_assets
                else None
            )
            for pdata in products_data:
                created_products.append(_persist_product(pdata, document_id, doc, hero_asset, db))

        db.commit()

        # ------------------------------------------------------------------ #
        # STAGE 5: Generate and store embeddings
        # ------------------------------------------------------------------ #
        _update_job(job_id, db, stage="embed", status="running", progress=85)
        _raise_if_cancelled(job_id, db)

        for p in created_products:
            try:
                text_for_embed = " ".join(filter(None, [p.title, p.category, p.material, p.style, p.description]))
                if text_for_embed.strip():
                    _text_embed.upsert(entity_id=p.id, text=text_for_embed)
            except Exception as e:
                logger.warning("Text embedding failed for product %s: %s", p.id, e)

        for asset in saved_assets:
            try:
                _image_embed.upsert(asset_id=asset.id, image_path=asset.local_path)
            except Exception as e:
                logger.warning("Image embedding failed for asset %s: %s", asset.id, e)

        # ------------------------------------------------------------------ #
        # DONE
        # ------------------------------------------------------------------ #
        doc.status = "done"
        doc.processed_at = datetime.utcnow()
        db.commit()
        _update_job(job_id, db, stage="done", status="done", progress=100)
        logger.info("Pipeline complete for document %s — %d products", document_id, len(created_products))

    except PipelineCancelled:
        logger.info("Pipeline cancelled for document %s", document_id)
        try:
            doc = db.query(Document).filter_by(id=document_id).first()
            if doc:
                doc.status = "cancelled"
                db.commit()
        except Exception:
            pass
    except Exception as e:
        logger.exception("Pipeline failed for document %s: %s", document_id, e)
        try:
            # A failed commit (e.g. the IntegrityError above) leaves the
            # session unusable until rolled back — without this, the query
            # below raises PendingRollbackError, which the bare except
            # swallows, silently leaving the job stuck at "running" forever.
            db.rollback()
            doc = db.query(Document).filter_by(id=document_id).first()
            if doc:
                doc.status = "error"
                doc.error_message = str(e)
                db.commit()
            _update_job(job_id, db, stage="error", status="error", error=str(e))
        except Exception:
            pass
    finally:
        db.close()


def _persist_product(
    pdata: dict, document_id: str, doc: Document, hero_asset: MediaAsset | None, db: Session
) -> Product:
    """Create (or reuse, by supplier SKU) a Product row and link hero_asset as its photo."""
    if pdata.get("supplier_sku") and doc.supplier_name:
        exists = db.query(Product).filter_by(
            supplier_name=doc.supplier_name,
            supplier_sku=pdata["supplier_sku"],
        ).first()
        if exists:
            return exists

    p = Product(
        document_id=document_id,
        title=pdata.get("title"),
        category=pdata.get("category"),
        material=pdata.get("material"),
        style=pdata.get("style"),
        color=pdata.get("color"),
        width_mm=_to_float(pdata.get("width_mm")),
        depth_mm=_to_float(pdata.get("depth_mm")),
        height_mm=_to_float(pdata.get("height_mm")),
        price=_to_float(pdata.get("price")),
        currency=pdata.get("currency", "USD"),
        supplier_name=doc.supplier_name or pdata.get("supplier_name"),
        supplier_sku=pdata.get("supplier_sku"),
        description=pdata.get("description"),
        raw_attributes=pdata.get("raw_attributes", {}),
        source_confidence=pdata.get("confidence", 1.0),
    )
    db.add(p)
    db.flush()

    if hero_asset:
        pi = ProductImage(product_id=p.id, media_asset_id=hero_asset.id, role="hero", rank=0)
        db.add(pi)

    return p


def _rows_to_text(rows: list[dict]) -> str:
    """Convert flat row dicts to readable text for LLM extraction."""
    parts = []
    for row in rows:
        parts.append(" | ".join(f"{k}: {v}" for k, v in row.items() if v))
    return "\n".join(parts)


def _to_float(value) -> float | None:
    try:
        return float(value) if value not in (None, "", "null") else None
    except (TypeError, ValueError):
        return None
