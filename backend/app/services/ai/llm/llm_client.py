"""
Generic LLM client supporting multiple providers:
- xAI via OpenAI-compatible API
- OpenAI via OpenAI API
- Anthropic via Anthropic API

Switch provider through env: LLM_PROVIDER=xai|openai|anthropic
"""
import base64
import logging
import time
from typing import Optional

import anthropic
from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)

_openai_client: OpenAI | None = None
_anthropic_client: anthropic.Anthropic | None = None


def _provider() -> str:
    return (settings.LLM_PROVIDER or "xai").strip().lower()


def _openai_like_client() -> OpenAI:
    global _openai_client
    p = _provider()

    if p == "xai":
        api_key = settings.XAI_API_KEY
        base_url = settings.XAI_BASE_URL
    elif p == "openai":
        api_key = settings.OPENAI_API_KEY
        base_url = settings.OPENAI_BASE_URL
    else:
        raise ValueError(f"Provider '{p}' is not OpenAI-compatible")

    if not api_key:
        raise ValueError(f"API key missing for provider '{p}'")

    if _openai_client is None:
        _openai_client = OpenAI(api_key=api_key, base_url=base_url)
    return _openai_client


def _anthropic() -> anthropic.Anthropic:
    global _anthropic_client
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is missing")
    if _anthropic_client is None:
        _anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _anthropic_client


def _text_model() -> str:
    p = _provider()
    if p == "xai":
        return settings.XAI_TEXT_MODEL
    if p == "openai":
        return settings.OPENAI_TEXT_MODEL
    if p == "anthropic":
        return settings.ANTHROPIC_TEXT_MODEL
    raise ValueError(f"Unsupported provider '{p}'")


def _vision_model() -> str:
    p = _provider()
    if p == "xai":
        return settings.XAI_VISION_MODEL
    if p == "openai":
        return settings.OPENAI_VISION_MODEL
    if p == "anthropic":
        return settings.ANTHROPIC_VISION_MODEL
    raise ValueError(f"Unsupported provider '{p}'")


def chat_completion(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    retries: int = 3,
) -> str:
    """Provider-agnostic chat completion."""
    provider = _provider()
    model = model or _text_model()

    for attempt in range(retries):
        try:
            if provider in ("xai", "openai"):
                client = _openai_like_client()
                response = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return response.choices[0].message.content or ""

            if provider == "anthropic":
                client = _anthropic()
                converted = []
                for m in messages:
                    if m.get("role") == "system":
                        continue
                    converted.append({"role": m.get("role", "user"), "content": m.get("content", "")})

                response = client.messages.create(
                    model=model,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    messages=converted,
                )
                text_parts = [b.text for b in response.content if getattr(b, "type", "") == "text"]
                return "\n".join(text_parts).strip()

            raise ValueError(f"Unsupported provider '{provider}'")
        except Exception as e:
            logger.warning("LLM request failed (%s) attempt %d/%d: %s", provider, attempt + 1, retries, e)
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise


def vision_completion(
    image_path: str,
    prompt: str,
    model: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 2048,
) -> str:
    """Provider-agnostic vision completion."""
    provider = _provider()
    model = model or _vision_model()

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    ext = image_path.rsplit(".", 1)[-1].lower()
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
    mime = mime_map.get(ext, "image/jpeg")

    if provider in ("xai", "openai"):
        image_data = base64.b64encode(image_bytes).decode("utf-8")
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_data}"}},
                    {"type": "text", "text": prompt},
                ],
            }
        ]
        return chat_completion(messages=messages, model=model, temperature=temperature, max_tokens=max_tokens)

    if provider == "anthropic":
        client = _anthropic()
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime,
                                "data": base64.b64encode(image_bytes).decode("utf-8"),
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        text_parts = [b.text for b in response.content if getattr(b, "type", "") == "text"]
        return "\n".join(text_parts).strip()

    raise ValueError(f"Unsupported provider '{provider}'")
