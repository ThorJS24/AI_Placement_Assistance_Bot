"""Settings & diagnostics endpoints.

Two kinds of settings live here:
  * Deployment-level (ports, DB path, timeouts) — .env / config.py only,
    never exposed for live editing, since changing them genuinely does
    require a restart.
  * Department-level (branding, admin passcode, AI engine preference,
    interview voice) — editable right from the Settings page via the
    endpoints below, stored as overrides (core/runtime_settings.py) and
    effective immediately, no restart needed. Changing these is gated
    behind the admin passcode since they affect every student on this
    shared deployment, not just the person making the change.
"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field

import config
from core import llm, rate_limit, runtime_settings

router = APIRouter()


def _check_passcode(x_admin_passcode: str, request: Request) -> None:
    # Same "admin-auth" rate-limit bucket as routers/admin.py — both are the
    # same passcode, so a brute-force attempt against either endpoint should
    # count against the same per-IP budget.
    rate_limit.enforce("admin-auth", request, config.ADMIN_AUTH_RATE_LIMIT, config.ADMIN_AUTH_RATE_WINDOW_SECS)
    if not x_admin_passcode or x_admin_passcode != runtime_settings.effective_admin_passcode():
        raise HTTPException(status_code=401, detail="Incorrect admin passcode.")


@router.get("/status")
def status():
    """Fast: engine reachability checks run concurrently with a short
    timeout and are cached for a few seconds (see core/llm.py's
    engine_status), so this responds quickly even when Ollama/Groq are
    unreachable, instead of stalling app/page loads."""
    eng = llm.engine_status()
    ollama, groq = eng["ollama"], eng["groq"]
    settings_ = runtime_settings.effective_settings()
    return {
        "app_title": settings_["app_title"],
        "college_name": settings_["college_name"],
        "department_name": settings_["department_name"],
        "llm_backend": settings_["llm_backend"],
        "active_engine": eng["active"],
        "ollama": {"reachable": ollama.reachable, "detail": ollama.detail, "host": config.OLLAMA_HOST, "model": config.OLLAMA_MODEL},
        "groq": {"reachable": groq.reachable, "detail": groq.detail, "model": config.GROQ_MODEL},
        "stt_backend": config.STT_BACKEND,
        "whisper_model_size": config.WHISPER_MODEL_SIZE,
        "tts_backend": config.TTS_BACKEND,
        "edge_tts_voice": settings_["edge_tts_voice"],
    }


@router.get("/voices")
def voices():
    return runtime_settings.AVAILABLE_TTS_VOICES


class TestMessageResponse(BaseModel):
    reply: str


@router.post("/test")
def test_message():
    try:
        reply = llm.chat(
            llm.system_user("You are a helpful assistant.", "Reply with exactly: 'Connection successful.'"),
            max_tokens=20,
        )
        return {"ok": True, "reply": reply}
    except llm.LLMUnavailableError as exc:
        return {"ok": False, "reply": str(exc)}


# ---------------------------------------------------------------------------
# Live-editable settings — all gated behind the admin passcode, since they're
# department-wide, not per-student.
# ---------------------------------------------------------------------------

class BrandingRequest(BaseModel):
    app_title: str = Field("", max_length=config.MAX_TEXT_FIELD_CHARS)
    college_name: str = Field("", max_length=config.MAX_TEXT_FIELD_CHARS)
    department_name: str = Field("", max_length=config.MAX_TEXT_FIELD_CHARS)


@router.patch("/branding")
def update_branding(req: BrandingRequest, request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    if not req.app_title.strip() or not req.department_name.strip():
        raise HTTPException(status_code=422, detail="App name and department name can't be empty.")
    runtime_settings.set_branding(req.app_title, req.college_name, req.department_name)
    return {"ok": True}


class PasscodeRequest(BaseModel):
    current_passcode: str = Field(max_length=config.MAX_TEXT_FIELD_CHARS)
    new_passcode: str = Field(max_length=config.MAX_TEXT_FIELD_CHARS)


@router.patch("/passcode")
def update_passcode(req: PasscodeRequest, request: Request, x_admin_passcode: str = Header(default="")):
    # Require BOTH the header (so only someone already in the admin dashboard
    # can even reach this) and current_passcode in the body (so a change
    # can't be made from a stale/incorrect passcode typed elsewhere).
    _check_passcode(x_admin_passcode, request)
    if req.current_passcode != runtime_settings.effective_admin_passcode():
        raise HTTPException(status_code=401, detail="Current passcode is incorrect.")
    new_pc = req.new_passcode.strip()
    if len(new_pc) < 4:
        raise HTTPException(status_code=422, detail="New passcode must be at least 4 characters.")
    runtime_settings.set_admin_passcode(new_pc)
    return {"ok": True}


class EngineRequest(BaseModel):
    llm_backend: str = Field(max_length=config.MAX_TEXT_FIELD_CHARS)


@router.patch("/engine")
def update_engine(req: EngineRequest, request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    backend = req.llm_backend.strip().lower()
    if backend not in runtime_settings.ALLOWED_LLM_BACKENDS:
        raise HTTPException(status_code=422, detail=f"llm_backend must be one of {runtime_settings.ALLOWED_LLM_BACKENDS}.")
    runtime_settings.set_llm_backend(backend)
    return {"ok": True}


class VoiceRequest(BaseModel):
    edge_tts_voice: str = Field(max_length=config.MAX_TEXT_FIELD_CHARS)


@router.patch("/voice")
def update_voice(req: VoiceRequest, request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    valid_ids = {v["id"] for v in runtime_settings.AVAILABLE_TTS_VOICES}
    if req.edge_tts_voice not in valid_ids:
        raise HTTPException(status_code=422, detail="Unknown voice id.")
    runtime_settings.set_tts_voice(req.edge_tts_voice)
    return {"ok": True}
