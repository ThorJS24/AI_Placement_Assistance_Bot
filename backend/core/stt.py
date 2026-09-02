"""
Speech-to-text for the Mock Interview module.

Same auto-fallback philosophy as core/llm.py:
  * "auto"  -> use Groq's hosted Whisper (fast, free tier) when a
              GROQ_API_KEY is configured and reachable; otherwise fall
              back to a local faster-whisper model (fully offline).
  * "local" -> always transcribe on-device with faster-whisper.
  * "groq"  -> always use Groq's Whisper endpoint.

The local model is loaded once and cached across calls (it's the slow
part - a few seconds the first time, instant after).
"""
from __future__ import annotations

import io
import logging
from functools import lru_cache

import requests

import config

logger = logging.getLogger(__name__)


class STTUnavailableError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _local_model():
    from faster_whisper import WhisperModel

    logger.info("Loading local Whisper model '%s' (first run downloads it once)...", config.WHISPER_MODEL_SIZE)
    return WhisperModel(config.WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")


def _transcribe_local(wav_bytes: bytes) -> str:
    model = _local_model()
    segments, _info = model.transcribe(io.BytesIO(wav_bytes), language="en", vad_filter=True)
    return " ".join(seg.text.strip() for seg in segments).strip()


def _transcribe_groq(wav_bytes: bytes) -> str:
    files = {"file": ("audio.wav", wav_bytes, "audio/wav")}
    data = {"model": config.GROQ_WHISPER_MODEL, "language": "en"}
    headers = {"Authorization": f"Bearer {config.GROQ_API_KEY}"}
    resp = requests.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        headers=headers,
        files=files,
        data=data,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json().get("text", "").strip()


def transcribe(wav_bytes: bytes) -> str:
    """Convert recorded WAV audio bytes into text, trying engines per STT_BACKEND."""
    if not wav_bytes:
        return ""

    order: list[str]
    if config.STT_BACKEND == "local":
        order = ["local"]
    elif config.STT_BACKEND == "groq":
        order = ["groq"]
    else:
        order = ["groq", "local"] if config.GROQ_API_KEY else ["local"]

    last_error: Exception | None = None
    for engine in order:
        try:
            if engine == "groq" and not config.GROQ_API_KEY:
                continue
            text = _transcribe_groq(wav_bytes) if engine == "groq" else _transcribe_local(wav_bytes)
            return text
        except Exception as exc:  # noqa: BLE001
            logger.warning("STT engine '%s' failed: %s", engine, exc)
            last_error = exc
            continue

    raise STTUnavailableError(
        "Could not transcribe audio with any configured engine.\n"
        "Local: make sure 'faster-whisper' is installed (pip install faster-whisper).\n"
        "Cloud: set GROQ_API_KEY in your .env for Groq Whisper.\n"
        f"Last error: {last_error}"
    )
