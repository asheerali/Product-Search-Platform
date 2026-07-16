from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ProductOut(BaseModel):
    id: str
    document_id: Optional[str]
    title: Optional[str]
    category: Optional[str]
    material: Optional[str]
    style: Optional[str]
    color: Optional[str]
    width_mm: Optional[float]
    depth_mm: Optional[float]
    height_mm: Optional[float]
    price: Optional[float]
    currency: Optional[str]
    supplier_name: Optional[str]
    supplier_sku: Optional[str]
    description: Optional[str]
    raw_attributes: Optional[Dict[str, Any]]
    source_confidence: Optional[float]
    created_at: datetime
    image_urls: List[str] = []

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[ProductOut]


class MediaAssetOut(BaseModel):
    id: str
    document_id: Optional[str]
    source_type: Optional[str]
    source_ref: Optional[str]
    filename: Optional[str]
    width: Optional[int]
    height: Optional[int]
    mime_type: Optional[str]
    local_path: Optional[str]

    model_config = {"from_attributes": True}
