"""
Email parser — extracts:
  • headers (subject/from/to/date) + body text from .eml and .msg files
  • image attachments/inline images saved to pics/
.eml is parsed with the stdlib `email` module. .msg (Outlook binary format)
requires the optional `extract-msg` dependency; if it isn't installed this
degrades gracefully to an empty result instead of failing the pipeline.
"""
import logging
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

IMAGE_EXTS = {"jpg", "jpeg", "png", "webp", "gif", "bmp"}


@dataclass
class EmailParseResult:
    document_id: str
    filename: str
    text: str = ""
    tables: list[list[dict]] = field(default_factory=list)
    image_paths: list[str] = field(default_factory=list)

    @property
    def full_text(self) -> str:
        return self.text

    @property
    def all_tables(self) -> list[list[dict]]:
        return self.tables

    @property
    def all_image_paths(self) -> list[str]:
        return self.image_paths


def parse_email(file_path: str, document_id: str, pics_base_dir: str) -> EmailParseResult:
    path = Path(file_path)
    result = EmailParseResult(document_id=document_id, filename=path.name)

    try:
        if path.suffix.lower() == ".msg":
            _parse_msg(file_path, document_id, pics_base_dir, result)
        else:
            _parse_eml(file_path, document_id, pics_base_dir, result)
    except Exception as e:
        logger.error("Email parsing failed for %s: %s", file_path, e)

    return result


def _parse_eml(file_path: str, document_id: str, pics_base_dir: str, result: EmailParseResult):
    import email
    from email import policy

    from app.services.ingestion.image_extractor import save_extracted_image

    with open(file_path, "rb") as f:
        msg = email.message_from_binary_file(f, policy=policy.default)

    header_lines = [
        f"Subject: {msg.get('Subject', '')}",
        f"From: {msg.get('From', '')}",
        f"To: {msg.get('To', '')}",
        f"Date: {msg.get('Date', '')}",
    ]

    body = msg.get_body(preferencelist=("plain", "html"))
    body_text = ""
    if body is not None:
        try:
            body_text = body.get_content()
        except Exception as e:
            logger.warning("Could not read email body for %s: %s", file_path, e)

    result.text = "\n".join(header_lines) + "\n\n" + body_text

    for idx, part in enumerate(msg.iter_attachments()):
        content_type = part.get_content_type()
        if not content_type.startswith("image/"):
            continue
        try:
            data = part.get_content()
        except Exception as e:
            logger.warning("Could not read attachment %d in %s: %s", idx, file_path, e)
            continue
        if not isinstance(data, (bytes, bytearray)):
            continue
        ext = content_type.split("/")[-1]
        saved_path = save_extracted_image(
            image_bytes=bytes(data),
            ext=ext,
            document_id=document_id,
            source_ref=f"attachment_{idx}",
            pics_base_dir=pics_base_dir,
        )
        if saved_path:
            result.image_paths.append(saved_path)


def _parse_msg(file_path: str, document_id: str, pics_base_dir: str, result: EmailParseResult):
    try:
        import extract_msg
    except ImportError:
        logger.error(
            "Cannot parse .msg file %s — the optional 'extract-msg' package is not "
            "installed (pip install extract-msg).",
            file_path,
        )
        return

    from app.services.ingestion.image_extractor import save_extracted_image

    msg = extract_msg.Message(file_path)
    try:
        header_lines = [
            f"Subject: {msg.subject or ''}",
            f"From: {msg.sender or ''}",
            f"To: {msg.to or ''}",
            f"Date: {msg.date or ''}",
        ]
        result.text = "\n".join(header_lines) + "\n\n" + (msg.body or "")

        for idx, att in enumerate(msg.attachments):
            data = getattr(att, "data", None)
            if not data:
                continue
            name = att.longFilename or att.shortFilename or f"attachment_{idx}"
            ext = Path(name).suffix.lstrip(".").lower()
            if ext not in IMAGE_EXTS:
                continue
            saved_path = save_extracted_image(
                image_bytes=data,
                ext=ext,
                document_id=document_id,
                source_ref=f"attachment_{idx}",
                pics_base_dir=pics_base_dir,
            )
            if saved_path:
                result.image_paths.append(saved_path)
    finally:
        msg.close()
