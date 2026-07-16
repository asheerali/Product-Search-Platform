import hashlib
from pathlib import Path


def compute_file_hash(file_path: str, chunk_size: int = 8192) -> str:
    """Compute SHA-256 hash of a file by reading it in chunks (memory-safe for large files)."""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(chunk_size):
            sha256.update(chunk)
    return sha256.hexdigest()


def compute_bytes_hash(data: bytes) -> str:
    """Compute SHA-256 hash of raw bytes (for extracted images)."""
    return hashlib.sha256(data).hexdigest()


def compute_perceptual_hash(image_path: str) -> str | None:
    """
    Compute a perceptual hash (average hash) for an image.
    Near-duplicate images will have very similar hashes.
    Returns None if the image cannot be processed.
    """
    try:
        import struct

        from PIL import Image

        img = Image.open(image_path).convert("L").resize((8, 8), Image.LANCZOS)
        pixels = list(img.getdata())
        avg = sum(pixels) / len(pixels)
        bits = "".join("1" if p >= avg else "0" for p in pixels)
        # Pack bits into hex string
        hex_val = "%016x" % int(bits, 2)
        return hex_val
    except Exception:
        return None
