import os
from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ---- Grok / xAI ----
    GROK_API: str
    GROK_TEXT_MODEL: str = "grok-3-latest"
    GROK_VISION_MODEL: str = "grok-2-vision-latest"
    GROK_BASE_URL: str = "https://api.x.ai/v1"

    # ---- Database ----
    DATABASE_URL: str = "sqlite:///./product_search.db"

    # ---- Vector store ----
    CHROMA_DB_PATH: str = "./chroma_db"

    # ---- File storage ----
    # Absolute or relative path to the pics folder (extracted images land here)
    PICS_DIR: str = str(Path(__file__).resolve().parents[3] / "pics")
    # Temp dir for uploaded files during processing
    UPLOAD_TEMP_DIR: str = "./tmp_uploads"

    # ---- CORS ----
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    class Config:
        env_file = str(Path(__file__).resolve().parents[3] / ".env")
        extra = "ignore"


settings = Settings()

# Make sure key directories exist at import time
Path(settings.PICS_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.UPLOAD_TEMP_DIR).mkdir(parents=True, exist_ok=True)
Path(settings.CHROMA_DB_PATH).mkdir(parents=True, exist_ok=True)
