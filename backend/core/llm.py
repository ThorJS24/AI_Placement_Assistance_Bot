"""
Unified LLM client for the whole platform.

Design goal: the app must NEVER be dead in the water just because one
engine is unavailable.

  * "auto"   (recommended, default) - try Groq first when a GROQ_API_KEY
             is configured and the internet/Groq is reachable (fast, high
             quality); silently fall back to the local Ollama server
             otherwise. If neither works, raise a clear, actionable error
             that the UI can show to the user.
  * "ollama" - local only, fully offline, never calls the internet.
  * "groq"   - cloud only, never falls back.

Every module in the app (chatbot, resume builder, roadmap generator,
mock interview, technical interview) talks to the LLM exclusively
through `chat()` / `stream_chat()` below, so the fallback logic lives
in exactly one place.
"""
from __future__ import annotations

import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Generator, Iterable

import requests

import config

logger = logging.getLogger(__name__)

Message = dict  # {"role": "system"|"user"|"assistant", "content": str}

# Shared anti-cliché guardrail, referenced by every prompt-writing module
# (resume builder, roadmap generator, mock interview, technical interview).
# Small/local models in particular default to generic corporate-brochure
# voice unless explicitly told not to — this is the single biggest lever for
# making generated content read as specific and earned rather than
# templated AI filler, so it's worth spelling out concretely rather than a
# vague "sound natural" instruction.
ANTI_SLOP_INSTRUCTION = (
    "Write in plain, concrete, specific language. Never use generic AI-brochure voice. "
    "Do NOT use: 'in today's fast-paced/ever-evolving world', 'passionate about', 'results-driven', "
    "'dynamic team player', 'leverage' (say 'use'), 'utilize' (say 'use'), 'synergy', 'cutting-edge', "
    "'game-changer', 'unlock your potential', 'seamless', 'robust solution', 'delve into', "
    "'furthermore'/'moreover' as sentence openers, 'holistic', or any vague corporate buzzword. "
    "Do NOT use em dashes (—) anywhere. Use a period, comma, or parentheses instead. "
    "Every sentence should say something specific and checkable, not a platitude that could apply to anyone. "
    "Never invent or assume facts, examples, or details that were not actually provided in the input "
    "(a name, a project, a specific claim, an answer content) — if there is not enough real information to "
    "say something specific, say less rather than filling the gap with a plausible-sounding but made-up detail."
)


class LLMUnavailableError(RuntimeError):
    """Raised when no configured LLM backend could be reached."""


class LLMJsonError(RuntimeError):
    """Raised when the model's response could not be parsed as JSON, even
    after a cleanup pass and one self-correction retry."""


@dataclass
class EngineStatus:
    name: str
    reachable: bool
    detail: str


# ---------------------------------------------------------------------------
# Health checks (used by the Settings page and by the auto-fallback logic)
# ---------------------------------------------------------------------------
#
# These are UI-facing pings, not the real generation call — they use a short,
# dedicated timeout (STATUS_CHECK_TIMEOUT_SECS) so a down/unreachable engine
# fails fast instead of stalling page loads for the full generation timeout.
# The two checks also run concurrently (not one-after-the-other), and the
# combined result is cached briefly, since the Settings page and the app
# shell both ping this on load — no reason to redo two network round trips
# every single time within the same few seconds.

STATUS_CHECK_TIMEOUT_SECS = 2.5
_STATUS_CACHE_TTL_SECS = 8
_status_cache: dict | None = None
_status_cache_at: float = 0.0


def check_ollama() -> EngineStatus:
    try:
        r = requests.get(f"{config.OLLAMA_HOST}/api/tags", timeout=STATUS_CHECK_TIMEOUT_SECS)
        r.raise_for_status()
        models = [m["name"] for m in r.json().get("models", [])]
        if models and not any(config.OLLAMA_MODEL.split(":")[0] in m for m in models):
            return EngineStatus(
                "Ollama", True,
                f"Server is running but model '{config.OLLAMA_MODEL}' is not pulled yet. "
                f"Run:  ollama pull {config.OLLAMA_MODEL}",
            )
        return EngineStatus("Ollama", True, f"Connected ({len(models)} model(s) available).")
    except Exception as exc:  # noqa: BLE001
        return EngineStatus("Ollama", False, f"Not reachable at {config.OLLAMA_HOST} ({exc}).")


def check_groq() -> EngineStatus:
    if not config.GROQ_API_KEY:
        return EngineStatus("Groq", False, "No GROQ_API_KEY configured.")
    try:
        r = requests.get(
            f"{config.GROQ_BASE_URL}/models",
            headers={"Authorization": f"Bearer {config.GROQ_API_KEY}"},
            timeout=STATUS_CHECK_TIMEOUT_SECS,
        )
        if r.status_code == 401:
            return EngineStatus("Groq", False, "API key rejected (401). Check GROQ_API_KEY.")
        r.raise_for_status()
        return EngineStatus("Groq", True, "Connected.")
    except Exception as exc:  # noqa: BLE001
        return EngineStatus("Groq", False, f"Not reachable ({exc}).")


def _pick_engine(backend: str, ollama: EngineStatus, groq: EngineStatus) -> str:
    if backend == "ollama":
        return "ollama"
    if backend == "groq":
        return "groq"
    return "groq" if groq.reachable else ("ollama" if ollama.reachable else "none")


def engine_status(force: bool = False) -> dict:
    """Run both health checks concurrently and return a cached, combined
    result: {"ollama": EngineStatus, "groq": EngineStatus, "active": str}.
    This is the one function the /settings/status endpoint should call —
    it replaces 3 sequential network round trips (check_ollama, check_groq,
    then check_groq again inside the old active_engine) with at most 2
    concurrent ones, reused for a few seconds across repeated calls."""
    global _status_cache, _status_cache_at
    now = time.time()
    if not force and _status_cache is not None and (now - _status_cache_at) < _STATUS_CACHE_TTL_SECS:
        return _status_cache

    from core import runtime_settings

    backend = runtime_settings.effective_llm_backend()
    with ThreadPoolExecutor(max_workers=2) as pool:
        ollama_future = pool.submit(check_ollama)
        groq_future = pool.submit(check_groq)
        ollama = ollama_future.result()
        groq = groq_future.result()

    result = {"ollama": ollama, "groq": groq, "active": _pick_engine(backend, ollama, groq)}
    _status_cache = result
    _status_cache_at = now
    return result


def active_engine() -> str:
    """Return which engine `chat()` will actually use right now."""
    return engine_status()["active"]


# ---------------------------------------------------------------------------
# Ollama backend
# ---------------------------------------------------------------------------

def _ollama_stream(messages: list[Message], temperature: float, max_tokens: int) -> Generator[str, None, None]:
    payload = {
        "model": config.OLLAMA_MODEL,
        "messages": messages,
        "stream": True,
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    with requests.post(
        f"{config.OLLAMA_HOST}/api/chat", json=payload, stream=True, timeout=config.LLM_TIMEOUT_SECS
    ) as resp:
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line:
                continue
            chunk = json.loads(line)
            piece = chunk.get("message", {}).get("content", "")
            if piece:
                yield piece
            if chunk.get("done"):
                break


# ---------------------------------------------------------------------------
# Groq backend (OpenAI-compatible)
# ---------------------------------------------------------------------------

def _groq_client():
    from openai import OpenAI  # local import: keeps `openai` optional for ollama-only setups

    return OpenAI(api_key=config.GROQ_API_KEY, base_url=config.GROQ_BASE_URL)


def _groq_stream(messages: list[Message], temperature: float, max_tokens: int) -> Generator[str, None, None]:
    client = _groq_client()
    stream = client.chat.completions.create(
        model=config.GROQ_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True,
    )
    for event in stream:
        delta = event.choices[0].delta.content if event.choices else None
        if delta:
            yield delta


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def stream_chat(
    messages: list[Message],
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> Generator[str, None, None]:
    """Yield response text chunks, honouring the effective LLM backend setting and the auto-fallback rule."""
    from core import runtime_settings

    backend = runtime_settings.effective_llm_backend()
    order: list[str]
    if backend == "ollama":
        order = ["ollama"]
    elif backend == "groq":
        order = ["groq"]
    else:
        order = ["groq", "ollama"] if config.GROQ_API_KEY else ["ollama", "groq"]

    last_error: Exception | None = None
    for engine in order:
        try:
            if engine == "groq" and not config.GROQ_API_KEY:
                continue
            gen = _groq_stream if engine == "groq" else _ollama_stream
            yielded_anything = False
            for piece in gen(messages, temperature, max_tokens):
                yielded_anything = True
                yield piece
            if yielded_anything:
                return
            raise RuntimeError("engine returned an empty response")
        except Exception as exc:  # noqa: BLE001
            logger.warning("LLM engine '%s' failed: %s", engine, exc)
            last_error = exc
            continue

    raise LLMUnavailableError(
        "No AI engine is reachable right now.\n\n"
        "Fix one of the following:\n"
        "  1. Local: install Ollama (https://ollama.com), run `ollama serve`, and "
        f"`ollama pull {config.OLLAMA_MODEL}`.\n"
        "  2. Cloud: get a free key at https://console.groq.com/keys and set "
        "GROQ_API_KEY in your .env file.\n\n"
        f"Last error: {last_error}"
    )


def chat(messages: list[Message], temperature: float = 0.7, max_tokens: int = 1024) -> str:
    """Non-streaming convenience wrapper — collects the full response as one string."""
    return "".join(stream_chat(messages, temperature=temperature, max_tokens=max_tokens))


def system_user(system_prompt: str, user_prompt: str) -> list[Message]:
    """Small helper: build a minimal 2-turn message list."""
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


_SMART_QUOTES = {
    "‘": "'", "’": "'", "“": '"', "”": '"',
}


def _extract_json_block(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    for smart, straight in _SMART_QUOTES.items():
        text = text.replace(smart, straight)
    start_candidates = [i for i in (text.find("{"), text.find("[")) if i != -1]
    end_candidates = [i for i in (text.rfind("}"), text.rfind("]")) if i != -1]
    if start_candidates and end_candidates:
        start, end = min(start_candidates), max(end_candidates)
        text = text[start : end + 1]
    return text.strip()


def _try_parse_json(text: str) -> dict | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Common small-model slip: a trailing comma right before a closing bracket.
    repaired = re.sub(r",(\s*[}\]])", r"\1", text)
    if repaired != text:
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass
    return None


def chat_json(messages: list[Message], temperature: float = 0.3, max_tokens: int = 1536) -> dict:
    """
    Ask the model for strict JSON and parse it defensively.

    Small/local models routinely wrap JSON in markdown fences, add stray
    text, use smart quotes, or leave a trailing comma — this cleans up and
    repairs those cases. If it still won't parse, the model gets one chance
    to fix its own broken output before we give up with a clear error.
    """
    raw = chat(messages, temperature=temperature, max_tokens=max_tokens)
    parsed = _try_parse_json(_extract_json_block(raw))
    if parsed is not None:
        return parsed

    logger.warning("chat_json: first response was not valid JSON, retrying with a self-correction turn.")
    fix_messages = messages + [
        {"role": "assistant", "content": raw},
        {
            "role": "user",
            "content": (
                "That was not valid JSON and could not be parsed. Return ONLY the corrected "
                "JSON object — no markdown fences, no extra commentary, and make sure every "
                "quote inside a string value is properly escaped."
            ),
        },
    ]
    retry_raw = chat(fix_messages, temperature=0.1, max_tokens=max_tokens)
    parsed = _try_parse_json(_extract_json_block(retry_raw))
    if parsed is not None:
        return parsed

    raise LLMJsonError(
        "The AI engine's reply couldn't be understood (invalid JSON), even after asking it to "
        "correct itself. This is more common with smaller local models — try again, or switch "
        "to Groq in Settings for more reliable structured output."
    )
