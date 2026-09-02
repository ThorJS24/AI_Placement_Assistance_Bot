"""Optional AI-illustrated roadmap image - a togglable extra layered on top
of the always-available, fully offline infographic (see core/roadmap_image.py).

Only active when config.IMAGE_GEN_API_KEY is set (see .env.example); the
default roadmap image experience never depends on this, and this module is
never imported unless a student explicitly asks for the AI-illustrated
option (see routers/roadmap.py). Uses an OpenAI-compatible images endpoint
via the `openai` package, already a dependency for the Groq chat backend
(core/llm.py) - no new dependency for this feature.
"""
from __future__ import annotations

import base64
import uuid

import config


class ImageGenUnavailableError(RuntimeError):
    """Raised when no image-gen API key is configured, or the call fails."""


def is_configured() -> bool:
    return bool(config.IMAGE_GEN_API_KEY)


def _client():
    from openai import OpenAI  # local import: keeps `openai` optional when this feature is unused

    return OpenAI(api_key=config.IMAGE_GEN_API_KEY, base_url=config.IMAGE_GEN_BASE_URL)


def build_ai_illustration(target_role: str, overview: str) -> str:
    """Generates a single decorative illustration (not a data infographic -
    that's what the offline Pillow image is for) themed around the
    student's target role, and saves it to config.GENERATED_DIR. Returns the
    file path."""
    if not is_configured():
        raise ImageGenUnavailableError(
            "AI-illustrated roadmap images aren't configured on this deployment - set IMAGE_GEN_API_KEY in .env "
            "to enable this optional extra. The regular downloadable roadmap image works without it."
        )

    prompt = (
        f"A clean, modern, professional illustration representing a career journey toward becoming a "
        f"{target_role or 'software professional'}. Context: {overview or 'a structured learning roadmap'}. "
        "Style: flat design, minimal, optimistic, suitable for an academic career-guidance document. "
        "No readable text or words in the image."
    )

    try:
        client = _client()
        result = client.images.generate(model=config.IMAGE_GEN_MODEL, prompt=prompt, size="1024x1024", n=1)
        item = result.data[0]
        if getattr(item, "b64_json", None):
            image_bytes = base64.b64decode(item.b64_json)
        elif getattr(item, "url", None):
            import requests

            resp = requests.get(item.url, timeout=config.REQUEST_TIMEOUT_SECS * 3)
            resp.raise_for_status()
            image_bytes = resp.content
        else:
            raise ImageGenUnavailableError("The image-gen API returned no image data.")
    except ImageGenUnavailableError:
        raise
    except Exception as exc:  # noqa: BLE001 - surface any provider/network failure uniformly
        raise ImageGenUnavailableError(f"AI image generation failed: {exc}") from exc

    out_path = config.GENERATED_DIR / f"roadmap_ai_{uuid.uuid4().hex}.png"
    out_path.write_bytes(image_bytes)
    return str(out_path)
