from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class TextSearchRequest(BaseModel):
    query: str
    limit: int = 20
    filters: Optional[Dict[str, Any]] = None


class SearchResultItem(BaseModel):
    product_id: str
    title: Optional[str]
    category: Optional[str]
    supplier_name: Optional[str]
    price: Optional[float]
    currency: Optional[str]
    score: float
    image_url: Optional[str]
    description: Optional[str]


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResultItem]
    total: int
