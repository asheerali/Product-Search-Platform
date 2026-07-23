import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ---- LLM provider config (generic) ----
    LLM_PROVIDER: str = "xai"  # xai | openai | anthropic

    # xAI
    XAI_API_KEY: str | None = None
    XAI_BASE_URL: str = "https://api.x.ai/v1"
    XAI_TEXT_MODEL: str = "grok-3-latest"
    XAI_VISION_MODEL: str = "grok-2-vision-latest"

    # OpenAI
    OPENAI_API_KEY: str | None = None
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_TEXT_MODEL: str = "gpt-4o-mini"
    OPENAI_VISION_MODEL: str = "gpt-4o-mini"

    # Anthropic
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_TEXT_MODEL: str = "claude-3-5-sonnet-latest"
    ANTHROPIC_VISION_MODEL: str = "claude-3-5-sonnet-latest"

    # Legacy xAI alias keys for backward compatibility
    GROK_API: str | None = None
    GROK_BASE_URL: str | None = None
    GROK_TEXT_MODEL: str | None = None
    GROK_VISION_MODEL: str | None = None

    # ---- Database (PostgreSQL + pgvector) ----
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/product_search"

    # ---- File storage ----
    PICS_DIR: str = str(Path(__file__).resolve().parents[3] / "pics")
    UPLOAD_TEMP_DIR: str = "./tmp_uploads"
    # Stand-in for S3 in this demo: uploaded originals land here so every
    # source file (PDF/PPTX/XLSX/image/email) lives in one consolidated place.
    SHARED_STORAGE_DIR: str = str(Path(__file__).resolve().parents[3] / "shared")

    # ---- CORS ----
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # ---- S3 storage (raw uploaded originals) ----
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    AWS_DEFAULT_REGION: str | None = None
    S3_BUCKET: str | None = None
    S3_PREFIX: str = ""

    class Config:
        env_file = str(Path(__file__).resolve().parents[3] / ".env")
        extra = "ignore"


settings = Settings()

# Backward compatibility for old .env keys
if not settings.XAI_API_KEY and settings.GROK_API:
    settings.XAI_API_KEY = settings.GROK_API
if settings.GROK_BASE_URL:
    settings.XAI_BASE_URL = settings.GROK_BASE_URL
if settings.GROK_TEXT_MODEL:
    settings.XAI_TEXT_MODEL = settings.GROK_TEXT_MODEL
if settings.GROK_VISION_MODEL:
    settings.XAI_VISION_MODEL = settings.GROK_VISION_MODEL

Path(settings.PICS_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.UPLOAD_TEMP_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.SHARED_STORAGE_DIR).mkdir(parents=True, exist_ok=True)
