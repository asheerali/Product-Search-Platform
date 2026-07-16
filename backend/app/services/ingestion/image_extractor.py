"""
Image extractor — handles saving raw image bytes to the pics/ directory.
Each document gets its own subfolder: pics/{document_id}/
Images are deduplicated by sha256 hash before saving.
"""
import logging
from pathlib import Path

from app.services.ingestion.deduplication import (
    compute_bytes_hash,
    compute_perceptual_hash,
)

logger = logging.getLogger(__name__)

MIN_IMAGE_SIZE = 5 * 1024  # skip images smaller than 5 KB (likely logos/icons)


def save_extracted_image(
    image_bytes: bytes,
    ext: str,
    document_id: str,
    source_ref: str,
    pics_base_dir: str,
) -> str | None:
    """
    Save image bytes to pics/{document_id}/{sha256[:12]}.{ext}.
    Returns the absolute saved path, or None if the image was too small or errored.
    """
    if len(image_bytes) < MIN_IMAGE_SIZE:
        return None

    sha256 = compute_bytes_hash(image_bytes)
    ext = ext.lstrip(".").lower() or "jpg"
    filename = f"{sha256[:16]}.{ext}"

    out_dir = Path(pics_base_dir) / document_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / filename

    if out_path.exists():
        # Already saved (same content hash, possibly different source_ref)
        return str(out_path)

    try:
        import io

        from PIL import Image

        # Validate it's a real image and convert if needed
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()  # raises if corrupt

        # Re-open after verify (PIL verify closes the file)
        img = Image.open(io.BytesIO(image_bytes))

        # Convert CMYK / palette to RGB for compatibility
        if img.mode not in ("RGB", "RGBA", "L"):
            img = img.convert("RGB")

        img.save(str(out_path))
        logger.info("Saved extracted image: %s", out_path)
        return str(out_path)
    except Exception as e:
        logger.warning("Could not save image (%s) from %s: %s", filename, source_ref, e)
        return None


def get_image_metadata(image_path: str) -> dict:
    """Return width, height, mime_type, sha256 and phash for a saved image."""
    import mimetypes

    from PIL import Image

    result: dict = {
        "width": None,
        "height": None,
        "mime_type": None,
        "sha256": None,
        "phash": None,
    }
    try:
        with open(image_path, "rb") as f:
            data = f.read()
        result["sha256"] = compute_bytes_hash(data)
        result["phash"] = compute_perceptual_hash(image_path)
        mime, _ = mimetypes.guess_type(image_path)
        result["mime_type"] = mime or "image/jpeg"

        img = Image.open(image_path)
        result["width"], result["height"] = img.size
    except Exception as e:
        logger.warning("Could not read metadata for %s: %s", image_path, e)

    return result
