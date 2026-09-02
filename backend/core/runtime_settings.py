"""
Effective app-wide settings: DB override (set from the Settings UI) if one
exists, otherwise the .env/config.py default. This is what lets branding,
the AI engine preference, the admin passcode, and the interview voice be
changed live from the Settings page — no file editing, no restart.

Every other module should read settings through here (not straight from
`config`) if that setting is one a department admin might reasonably want
to change at runtime. Purely deployment-level things (ports, DB path,
timeouts) stay in config.py/.env only.
"""
from __future__ import annotations

import config
from core import storage

# Keys stored in the app_settings table, and the config.py attribute each
# one falls back to when no override has been saved yet.
_KEYS = {
    "app_title": "APP_TITLE",
    "college_name": "COLLEGE_NAME",
    "department_name": "DEPARTMENT_NAME",
    "admin_passcode": "ADMIN_PASSCODE",
    "llm_backend": "LLM_BACKEND",
    "edge_tts_voice": "EDGE_TTS_VOICE",
}

ALLOWED_LLM_BACKENDS = ("auto", "ollama", "groq")

# A small curated set of Edge TTS voices, biased toward Indian-English
# campus placement use, rather than exposing the full (huge, mostly
# irrelevant) edge-tts voice catalogue as free text.
AVAILABLE_TTS_VOICES = [
    {"id": "en-US-GuyNeural", "label": "Guy (US, male)"},
    {"id": "en-US-JennyNeural", "label": "Jenny (US, female)"},
    {"id": "en-US-AriaNeural", "label": "Aria (US, female)"},
    {"id": "en-GB-RyanNeural", "label": "Ryan (UK, male)"},
    {"id": "en-GB-SoniaNeural", "label": "Sonia (UK, female)"},
    {"id": "en-IN-PrabhatNeural", "label": "Prabhat (India, male)"},
    {"id": "en-IN-NeerjaNeural", "label": "Neerja (India, female)"},
]


def _get(key: str) -> str:
    try:
        override = storage.get_app_setting(key)
    except Exception:
        # Defensive: this can be called before storage.init_db() has created
        # the app_settings table (e.g. FastAPI's app title is resolved at
        # import time, before the lifespan startup hook runs). Falling back
        # to the .env default here is always safe.
        override = None
    if override is not None and override != "":
        return override
    return getattr(config, _KEYS[key])


def effective_settings() -> dict[str, str]:
    """One query for every overridable setting — used by /settings/status
    so the page doesn't do N separate round trips."""
    try:
        overrides = storage.get_app_settings(list(_KEYS.keys()))
    except Exception:
        overrides = {}
    return {
        key: (overrides.get(key) or getattr(config, attr))
        for key, attr in _KEYS.items()
    }


def effective_app_title() -> str:
    return _get("app_title")


def effective_college_name() -> str:
    return _get("college_name")


def effective_department_name() -> str:
    return _get("department_name")


def effective_admin_passcode() -> str:
    return _get("admin_passcode")


def effective_llm_backend() -> str:
    value = _get("llm_backend").lower()
    return value if value in ALLOWED_LLM_BACKENDS else "auto"


def effective_tts_voice() -> str:
    return _get("edge_tts_voice")


def set_branding(app_title: str | None, college_name: str | None, department_name: str | None) -> None:
    if app_title is not None:
        storage.set_app_setting("app_title", app_title.strip()[:120])
    if college_name is not None:
        storage.set_app_setting("college_name", college_name.strip()[:200])
    if department_name is not None:
        storage.set_app_setting("department_name", department_name.strip()[:200])


def set_admin_passcode(new_passcode: str) -> None:
    storage.set_app_setting("admin_passcode", new_passcode.strip()[:40])


def set_llm_backend(backend: str) -> None:
    storage.set_app_setting("llm_backend", backend.strip().lower())


def set_tts_voice(voice_id: str) -> None:
    storage.set_app_setting("edge_tts_voice", voice_id.strip())
