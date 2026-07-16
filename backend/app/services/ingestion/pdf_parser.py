"""
PDF parser — extracts:
  • text blocks (page by page)
  • tables (as list of dicts)
  • embedded images (saved to pics/ via image_extractor)
"""
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ParsedPage:
    page_number: int
    text: str
    tables: list[list[dict]] = field(default_factory=list)
    image_paths: list[str] = field(default_factory=list)


@dataclass
class PDFParseResult:
    document_id: str
    filename: str
    pages: list[ParsedPage] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def full_text(self) -> str:
        return "\n\n".join(p.text for p in self.pages if p.text.strip())

    @property
    def all_tables(self) -> list[list[dict]]:
        tables = []
        for p in self.pages:
            tables.extend(p.tables)
        return tables

    @property
    def all_image_paths(self) -> list[str]:
        paths = []
        for p in self.pages:
            paths.extend(p.image_paths)
        return paths


def parse_pdf(file_path: str, document_id: str, pics_base_dir: str) -> PDFParseResult:
    """
    Parse a PDF file and return structured content.
    Images are saved to pics_base_dir/{document_id}/ and paths are stored in result.
    """
    import fitz  # PyMuPDF
    import pdfplumber

    path = Path(file_path)
    result = PDFParseResult(document_id=document_id, filename=path.name)

    # --- Extract text and tables with pdfplumber ---
    try:
        with pdfplumber.open(file_path) as pdf:
            result.metadata = pdf.metadata or {}
            for page_num, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                tables = []
                for raw_table in page.extract_tables() or []:
                    if not raw_table:
                        continue
                    headers = [str(c).strip() if c else f"col_{i}" for i, c in enumerate(raw_table[0])]
                    rows = []
                    for row in raw_table[1:]:
                        row_dict = {headers[i]: (str(v).strip() if v else "") for i, v in enumerate(row)}
                        rows.append(row_dict)
                    if rows:
                        tables.append(rows)
                result.pages.append(ParsedPage(page_number=page_num, text=text, tables=tables))
    except Exception as e:
        logger.error("pdfplumber failed for %s: %s", file_path, e)

    # --- Extract embedded images with PyMuPDF ---
    try:
        from app.services.ingestion.image_extractor import save_extracted_image

        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            for img_index, img in enumerate(page.get_images(full=True)):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                ext = base_image["ext"]
                source_ref = f"page_{page_num + 1}_img_{img_index}"
                saved_path = save_extracted_image(
                    image_bytes=image_bytes,
                    ext=ext,
                    document_id=document_id,
                    source_ref=source_ref,
                    pics_base_dir=pics_base_dir,
                )
                if saved_path and result.pages:
                    # attach to matching page
                    target_page = next(
                        (p for p in result.pages if p.page_number == page_num + 1),
                        result.pages[-1],
                    )
                    target_page.image_paths.append(saved_path)
        doc.close()
    except Exception as e:
        logger.error("PyMuPDF image extraction failed for %s: %s", file_path, e)

    return result
