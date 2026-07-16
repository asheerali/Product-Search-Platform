"""
Grok API client (xAI) — uses the OpenAI-compatible SDK.
All LLM calls go through this single module so the model can be swapped easily.
"""
import logging
import time
from typing import Any

from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.GROK_API,
            base_url=settings.GROK_BASE_URL,
        )
    return _client


def chat_completion(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    retries: int = 3,
) -> str:
    """Send a chat completion request and return the text response. Retries on transient errors."""
    model = model or settings.GROK_TEXT_MODEL
    client = get_client()

    for attempt in range(retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.warning("Grok API attempt %d/%d failed: %s", attempt + 1, retries, e)
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # exponential back-off
            else:
                raise


def vision_completion(
    image_path: str,
    prompt: str,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 2048,
) -> str:
    """Send an image + text prompt to the Grok vision model."""
    import base64

    model = model or settings.GROK_VISION_MODEL

    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    # Detect mime type
    ext = image_path.rsplit(".", 1)[-1].lower()
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
    mime = mime_map.get(ext, "image/jpeg")

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{image_data}"},
                },
                {"type": "text", "text": prompt},
            ],
        }
    ]

    return chat_completion(messages=messages, model=model, temperature=temperature, max_tokens=max_tokens)
