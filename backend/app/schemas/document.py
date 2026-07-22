from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: Optional[int]
    content_hash: str
    supplier_name: Optional[str]
    status: str
    created_at: datetime
    processed_at: Optional[datetime]
    error_message: Optional[str]

    model_config = {"from_attributes": True}


class IngestionJobOut(BaseModel):
    id: str
    document_id: str
    stage: Optional[str]
    status: str
    progress: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ProcessedFileOut(BaseModel):
    id: str
    filename: str
    content_hash: str
    file_size: Optional[int]
    processed_at: datetime
    document_id: Optional[str]
    file_type: Optional[str] = None
    status: Optional[str] = None
    supplier_name: Optional[str] = None

    model_config = {"from_attributes": True}


class FolderIngestRequest(BaseModel):
    folder_path: str
    supplier_name: Optional[str] = None
    recursive: bool = False
