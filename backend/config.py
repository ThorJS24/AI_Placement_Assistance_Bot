"""
Central configuration for the AI Placement Assistance Platform.

All environment-dependent settings are loaded here, once, from `.env`
(see .env.example for every available key). Every other module imports
from this file instead of reading os.environ directly, so the whole
app's configuration surface lives in one place.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Make every HTTPS call in the process (Groq, edge-tts, optional image-gen —
# anything using `requests`/`httpx`/`openai`, all built on the stdlib `ssl`
# module) verify certificates against the OS's native trust store instead of
# the `certifi` bundle those libraries ship by default. This matters a lot
# on a campus/corporate network that does TLS inspection with its own root
# CA: that CA is installed in Windows' trust store (so a browser on the same
# machine works fine) but was never in certifi's bundle, so Python-only
# tools fail with CERTIFICATE_VERIFY_FAILED even though the network is
# otherwise fine. `truststore` (stdlib-adjacent, no config needed) fixes
# this globally by patching `ssl.SSLContext` — must run before anything else
# in the app opens an HTTPS connection, so this file (imported first by
# every other module) is the right place. Safe no-op if truststore isn't
# installed for some reason (falls back to the previous certifi behavior).
try:
    import truststore

    truststore.inject_into_ssl()
except ImportError:  # pragma: no cover - truststore is a normal dependency; only missing in a broken install
    pass

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent           # .../AI_Placement_Assisstance_Bot/backend
PROJECT_ROOT = BASE_DIR.parent                        # .../AI_Placement_Assisstance_Bot
DATA_DIR = BASE_DIR / "data"
STORAGE_DIR = PROJECT_ROOT / "storage"                # shared runtime data (db + generated files)
GENERATED_DIR = STORAGE_DIR / "generated"             # generated resumes / reports / tts audio
DB_PATH = STORAGE_DIR / "app.db"
FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"  # built React app, served as static files

STORAGE_DIR.mkdir(exist_ok=True)
GENERATED_DIR.mkdir(exist_ok=True, parents=True)

load_dotenv(PROJECT_ROOT / ".env")


def _env(key: str, default: str = "") -> str:
    return os.getenv(key, default).strip()


def _env_bool(key: str, default: bool = False) -> bool:
    val = _env(key, str(default)).lower()
    return val in ("1", "true", "yes", "on")


# ---------------------------------------------------------------------------
# App identity
# ---------------------------------------------------------------------------
APP_TITLE = _env("APP_TITLE", "AI Placement Assistance Platform")
COLLEGE_NAME = _env("COLLEGE_NAME", "")  # e.g. "CHRIST (Deemed to be University)" — shown alongside the department
DEPARTMENT_NAME = _env("DEPARTMENT_NAME", "Department of Computer Science and Engineering")

# Passcode for the /admin (TPO/placement-cell) dashboard — a single shared
# passcode, not per-user login, proportionate to a local single-machine
# deployment. Change this in .env before handing the app to the department.
ADMIN_PASSCODE = _env("ADMIN_PASSCODE", "changeme123")

# ---------------------------------------------------------------------------
# LLM engine (chatbot, roadmap, interviews)
# ---------------------------------------------------------------------------
LLM_BACKEND = _env("LLM_BACKEND", "auto").lower()          # auto | ollama | groq
OLLAMA_HOST = _env("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = _env("OLLAMA_MODEL", "llama3.2")
GROQ_API_KEY = _env("GROQ_API_KEY")
GROQ_MODEL = _env("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# ---------------------------------------------------------------------------
# Optional AI-illustrated roadmap image (Roadmap Generator "extra"). The
# default roadmap image (core/roadmap_image.py) is always available and
# fully offline — this is a togglable add-on layered on top, only active
# when a key is configured. See .env.example for the full explanation.
# ---------------------------------------------------------------------------
IMAGE_GEN_API_KEY = _env("IMAGE_GEN_API_KEY")
IMAGE_GEN_BASE_URL = _env("IMAGE_GEN_BASE_URL", "https://api.openai.com/v1")
IMAGE_GEN_MODEL = _env("IMAGE_GEN_MODEL", "gpt-image-1")

# ---------------------------------------------------------------------------
# Speech-to-text (Mock Interview)
# ---------------------------------------------------------------------------
STT_BACKEND = _env("STT_BACKEND", "auto").lower()           # auto | local | groq
WHISPER_MODEL_SIZE = _env("WHISPER_MODEL_SIZE", "small")
GROQ_WHISPER_MODEL = _env("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")

# ---------------------------------------------------------------------------
# Text-to-speech (Mock Interview)
# ---------------------------------------------------------------------------
TTS_BACKEND = _env("TTS_BACKEND", "pyttsx3").lower()         # pyttsx3 | edge
EDGE_TTS_VOICE = _env("EDGE_TTS_VOICE", "en-US-GuyNeural")

# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------
SERVER_HOST = _env("SERVER_HOST", "127.0.0.1")
SERVER_PORT = int(_env("SERVER_PORT", "8000") or "8000")
# Only needed when running the frontend dev server (npm run dev) separately from
# the backend during development. In production the backend serves the built
# frontend itself, so no cross-origin requests happen and CORS isn't exercised.
DEV_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

# ---------------------------------------------------------------------------
# Misc constants used across modules
# ---------------------------------------------------------------------------
REQUEST_TIMEOUT_SECS = 6          # health-check / short calls
LLM_TIMEOUT_SECS = 90             # full generation calls
CODE_EXEC_TIMEOUT_SECS = 5        # sandboxed student code execution
MAX_CHAT_HISTORY_TURNS = 20       # trimmed context window sent to the LLM

# Guardrails for the DSA code runner (core/code_judge.py). It executes
# arbitrary student Python in a subprocess — this isn't a hardened sandbox
# (see code_judge.py's docstring), so these caps exist to stop obviously
# abusive input (huge pastes, runaway automated submissions) rather than to
# fully secure the endpoint.
MAX_CODE_BYTES = 20_000            # ~a few hundred lines of real code
MAX_CODE_LINES = 500
DSA_RUN_RATE_LIMIT = 20            # max /dsa/run calls...
DSA_RUN_RATE_WINDOW_SECS = 60      # ...per this many seconds, per student

# DSA contest mode defaults (Technical Interview > Contest tab)
CONTEST_DEFAULT_QUESTIONS = 3
CONTEST_DEFAULT_MINUTES = 20
CONTEST_MAX_QUESTIONS = 8

# ---------------------------------------------------------------------------
# Rate limits & input caps — every endpoint that calls out to the LLM (cost,
# latency) or accepts free-form/file input (memory, storage) gets a guardrail
# here, mirroring the DSA runner's existing pattern (DSA_RUN_RATE_LIMIT
# above). Proportionate to a trusted shared-PC deployment: generous enough
# that no normal student ever notices them, tight enough that one runaway
# loop or accidental huge paste can't degrade the app for everyone else.
# ---------------------------------------------------------------------------
CHAT_RATE_LIMIT = 20               # chat messages...
CHAT_RATE_WINDOW_SECS = 60         # ...per this many seconds, per student

LLM_ACTION_RATE_LIMIT = 15         # resume build/analyze, roadmap generate, mock
LLM_ACTION_RATE_WINDOW_SECS = 60   # interview turns, dsa review, quiz build/grade...

ADMIN_AUTH_RATE_LIMIT = 20         # admin/settings passcode checks — generous enough that normal
ADMIN_AUTH_RATE_WINDOW_SECS = 60   # dashboard/settings usage never trips it, tight enough to make
                                    # rapid online passcode-guessing scripts impractical (per client IP)

ACCOUNT_AUTH_RATE_LIMIT = 10       # signup/login attempts...
ACCOUNT_AUTH_RATE_WINDOW_SECS = 60 # ...per this many seconds, per connecting IP — slows down
                                    # password-guessing scripts without affecting normal use

MAX_UPLOAD_BYTES = 10 * 1024 * 1024   # resume files / interview audio uploads
MAX_CHAT_MESSAGE_CHARS = 4000
MAX_TEXT_FIELD_CHARS = 1000        # single-line-ish fields (name, role, links...)
MAX_LONG_TEXT_CHARS = 4000         # multi-line fields (notes, job descriptions...)
MAX_LIST_ITEMS = 40                # skills / bullets / certifications list length
MAX_BULLET_CHARS = 400             # one bullet point / skill / certification entry

# ---------------------------------------------------------------------------
# Live AI Interview (WebSocket, voice-first) — routers/live_interview.py.
# No new external realtime provider: this reuses the same LLM/STT/TTS
# backends as the turn-based Mock Interview, just over a persistent
# WebSocket instead of request/response, with client-side VAD for barge-in
# (see @ricky0123/vad-web in the frontend). Everything here is free/local,
# no new secrets required.
# ---------------------------------------------------------------------------
LIVE_INTERVIEW_ENABLED = _env_bool("LIVE_INTERVIEW_ENABLED", True)
LIVE_INTERVIEW_MAX_DURATION_SECS = int(_env("LIVE_INTERVIEW_MAX_DURATION_SECS", "1800") or "1800")   # 30 min hard cap
LIVE_INTERVIEW_IDLE_TIMEOUT_SECS = int(_env("LIVE_INTERVIEW_IDLE_TIMEOUT_SECS", "120") or "120")      # 2 min of no activity
LIVE_INTERVIEW_MAX_CONCURRENT_PER_STUDENT = int(_env("LIVE_INTERVIEW_MAX_CONCURRENT_PER_STUDENT", "1") or "1")

LIVE_INTERVIEW_RATE_LIMIT = 10             # session creation attempts...
LIVE_INTERVIEW_RATE_WINDOW_SECS = 60       # ...per this many seconds, per student
