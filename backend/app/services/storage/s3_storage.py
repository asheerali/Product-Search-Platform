"""
S3-backed storage for raw uploaded originals (replaces the local shared folder).
Credentials come from settings if provided, otherwise boto3 falls back to its
default chain (e.g. an IAM role attached to the EC2 instance).
"""
import boto3

from app.core.config import settings

_client = None


def _s3_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_DEFAULT_REGION,
        )
    return _client


def upload_original(local_path: str, filename: str) -> str:
    """Upload a file to S3 under the configured prefix and return its s3:// URI."""
    key = f"{settings.S3_PREFIX}{filename}"
    _s3_client().upload_file(local_path, settings.S3_BUCKET, key)
    return f"s3://{settings.S3_BUCKET}/{key}"


def upload_fileobj(fileobj, filename: str) -> str:
    """Stream a file-like object straight to S3 (no local disk copy needed)."""
    key = f"{settings.S3_PREFIX}{filename}"
    _s3_client().upload_fileobj(fileobj, settings.S3_BUCKET, key)
    return f"s3://{settings.S3_BUCKET}/{key}"


def list_objects() -> list[dict]:
    """List every object under the configured S3 prefix."""
    paginator = _s3_client().get_paginator("list_objects_v2")
    objects = []
    for page in paginator.paginate(Bucket=settings.S3_BUCKET, Prefix=settings.S3_PREFIX):
        for obj in page.get("Contents", []):
            if obj["Key"] == settings.S3_PREFIX:
                continue  # the prefix "folder" placeholder itself, not a real file
            objects.append(obj)
    return objects


def delete_object(key: str):
    _s3_client().delete_object(Bucket=settings.S3_BUCKET, Key=key)


PRODUCT_PHOTOS_PREFIX = "products_photos/"


def upload_product_photo(local_path: str, filename: str) -> str:
    """
    Upload an extracted product image to S3 under products_photos/ and return
    its public URL. That prefix (only) is bucket-policy public-read, so the
    URL can be stored in the DB and used directly as an <img> src.
    """
    key = f"{PRODUCT_PHOTOS_PREFIX}{filename}"
    _s3_client().upload_file(local_path, settings.S3_BUCKET, key)
    return f"https://{settings.S3_BUCKET}.s3.{settings.AWS_DEFAULT_REGION}.amazonaws.com/{key}"
