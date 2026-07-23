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
