import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Processed files registry — the primary deduplication gate
# ---------------------------------------------------------------------------
class ProcessedFile(Base):
    """
    One row per unique file (by sha256 hash).
    If a file is re-uploaded with the same hash it is silently skipped.
    If re-uploaded with the same name but a different hash it is treated as
    a new version and a new Document row is created.
    """
    __tablename__ = "processed_files"

    id = Column(String, primary_key=True, default=_uuid)
    filename = Column(String, nullable=False, index=True)
    content_hash = Column(String, nullable=False, unique=True, index=True)
    file_size = Column(Integer)
    processed_at = Column(DateTime, default=datetime.utcnow)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)


# ---------------------------------------------------------------------------
# Documents — one row per source file
# ---------------------------------------------------------------------------
class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=_uuid)
    filename = Column(String, nullable=False)
    original_path = Column(String)            # original path on disk (if folder ingest)
    file_type = Column(String, nullable=False) # pdf | pptx | xlsx | image
    file_size = Column(Integer)
    content_hash = Column(String, unique=True, index=True)
    supplier_name = Column(String)
    status = Column(String, default="pending") # pending | processing | done | error
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)
    error_message = Column(Text)

    # relationships
    jobs = relationship("IngestionJob", back_populates="document", cascade="all, delete-orphan")
    media_assets = relationship("MediaAsset", back_populates="document", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="document")


# ---------------------------------------------------------------------------
# Ingestion jobs — tracks pipeline stage per document
# ---------------------------------------------------------------------------
class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    id = Column(String, primary_key=True, default=_uuid)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    stage = Column(String)               # parse | normalize | embed | done
    status = Column(String, default="pending")  # pending | running | done | error
    progress = Column(Integer, default=0)       # 0-100
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="jobs")


# ---------------------------------------------------------------------------
# Products — canonical product records
# ---------------------------------------------------------------------------
class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=_uuid)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    title = Column(String)
    category = Column(String, index=True)
    material = Column(String)
    style = Column(String)
    color = Column(String)
    width_mm = Column(Float)
    depth_mm = Column(Float)
    height_mm = Column(Float)
    price = Column(Float)
    currency = Column(String, default="USD")
    supplier_name = Column(String, index=True)
    supplier_sku = Column(String, index=True)
    description = Column(Text)
    raw_attributes = Column(JSON)        # supplier-specific flexible fields
    source_confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document = relationship("Document", back_populates="products")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("supplier_name", "supplier_sku", name="uq_supplier_sku"),
    )


# ---------------------------------------------------------------------------
# Media assets — every image extracted from any document
# ---------------------------------------------------------------------------
class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(String, primary_key=True, default=_uuid)
    document_id = Column(String, ForeignKey("documents.id"), nullable=True)
    source_type = Column(String)   # pdf | pptx | xlsx | upload
    source_ref = Column(String)    # e.g. "page_3", "slide_5", "sheet_Catalogue"
    local_path = Column(String)    # absolute path inside pics/
    s3_url = Column(String)        # public URL under s3://.../products_photos/, if uploaded
    filename = Column(String)
    sha256 = Column(String, unique=True, index=True)
    phash = Column(String, index=True)  # perceptual hash for near-duplicate detection
    width = Column(Integer)
    height = Column(Integer)
    mime_type = Column(String)
    is_logo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="media_assets")
    product_images = relationship("ProductImage", back_populates="media_asset")


# ---------------------------------------------------------------------------
# Product images — junction between Product and MediaAsset
# ---------------------------------------------------------------------------
class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(String, primary_key=True, default=_uuid)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    media_asset_id = Column(String, ForeignKey("media_assets.id"), nullable=False)
    role = Column(String, default="hero")  # hero | detail | lifestyle | unknown
    rank = Column(Integer, default=0)

    product = relationship("Product", back_populates="images")
    media_asset = relationship("MediaAsset", back_populates="product_images")


# ---------------------------------------------------------------------------
# Embeddings — stores semantic vectors in PostgreSQL (pgvector)
# ---------------------------------------------------------------------------
class Embedding(Base):
    __tablename__ = "embeddings"

    id = Column(String, primary_key=True, default=_uuid)
    entity_id = Column(String, nullable=False, index=True)
    collection = Column(String, nullable=False, index=True)  # product_text | product_images
    embedding = Column(Vector(), nullable=False)
    meta_data = Column("metadata", JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("entity_id", "collection", name="uq_embedding_entity_collection"),
    )
