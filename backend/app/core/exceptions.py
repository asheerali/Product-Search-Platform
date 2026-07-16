from fastapi import HTTPException, status


class DuplicateFileError(Exception):
    """Raised when a file with the same hash already exists in the system."""
    def __init__(self, filename: str, existing_document_id: str):
        self.filename = filename
        self.existing_document_id = existing_document_id
        super().__init__(f"File '{filename}' already processed (doc_id={existing_document_id})")


class UnsupportedFileTypeError(Exception):
    """Raised when the uploaded file type is not supported."""
    def __init__(self, filename: str):
        super().__init__(f"Unsupported file type for '{filename}'. Supported: PDF, PPTX, XLSX, images.")


class IngestionError(Exception):
    """General ingestion pipeline failure."""
    pass


class StorageError(Exception):
    """File storage operation failed."""
    pass


class AIServiceError(Exception):
    """AI/LLM service call failed."""
    pass


def http_not_found(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def http_bad_request(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def http_conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
