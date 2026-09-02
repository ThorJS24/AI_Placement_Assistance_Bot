"""
Text-to-speech for the Mock Interview module.

Two engines, selected by config.TTS_BACKEND:
  * "pyttsx3" (default) - fully offline, uses the OS's built-in voices
    (SAPI5 on Windows). Zero setup, zero cost, works with no internet.
  * "edge"    - Microsoft Edge's free neural TTS service (no API key
    required), much more natural-sounding, but needs internet.

Both return the path to a generated .wav/.mp3 file that the Streamlit
UI plays back with st.audio().
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid

import config
from core import runtime_settings

logger = logging.getLogger(__name__)


class TTSUnavailableError(RuntimeError):
    pass


def _speak_pyttsx3(text: str) -> str:
    import pyttsx3

    out_path = config.GENERATED_DIR / f"tts_{uuid.uuid4().hex}.wav"
    engine = pyttsx3.init()
    engine.setProperty("rate", 175)
    engine.save_to_file(text, str(out_path))
    engine.runAndWait()
    engine.stop()
    return str(out_path)


def _speak_edge(text: str) -> str:
    import edge_tts

    out_path = config.GENERATED_DIR / f"tts_{uuid.uuid4().hex}.mp3"

    async def _run():
        communicate = edge_tts.Communicate(text, runtime_settings.effective_tts_voice())
        await communicate.save(str(out_path))

    asyncio.run(_run())
    return str(out_path)


def speak(text: str) -> str:
    """Synthesize `text` to an audio file and return its filesystem path."""
    if not text or not text.strip():
        raise TTSUnavailableError("No text provided to speak.")

    engines = [config.TTS_BACKEND] + [e for e in ("pyttsx3", "edge") if e != config.TTS_BACKEND]
    last_error: Exception | None = None
    for engine in engines:
        try:
            fn = _speak_edge if engine == "edge" else _speak_pyttsx3
            return fn(text)
        except Exception as exc:  # noqa: BLE001
            logger.warning("TTS engine '%s' failed: %s", engine, exc)
            last_error = exc
            continue

    raise TTSUnavailableError(
        "Could not synthesize speech with any configured engine.\n"
        "Offline: make sure 'pyttsx3' is installed and OS voices are available.\n"
        "Online: make sure 'edge-tts' is installed and you have internet access.\n"
        f"Last error: {last_error}"
    )


def cleanup_old_audio(max_age_secs: int = 3600) -> None:
    """Housekeeping: remove generated TTS files older than max_age_secs."""
    now = time.time()
    for f in config.GENERATED_DIR.glob("tts_*"):
        try:
            if now - f.stat().st_mtime > max_age_secs:
                f.unlink(missing_ok=True)
        except OSError:
            pass
