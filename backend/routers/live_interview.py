"""Live AI Interview — a persistent WebSocket per session (real-time,
voice-first) sitting alongside the turn-based Mock Interview module
(routers/mock_interview.py, left completely untouched). See modules/
live_interview.py for the interviewer prompt/state machine and modules/
live_interview_evaluation.py for the post-session scoring pass.

Protocol summary (all WS messages are JSON text frames):

Client -> server:
  {"type": "text_answer", "text": "..."}                       - typed answer (text fallback, or always available)
  {"type": "audio_answer", "audio_base64": "...", "mime": "audio/webm"} - one VAD-segmented utterance, base64-encoded
  {"type": "interrupt", "response_id": <int>}                  - barge-in: cancel the named AI response if it's still active
  {"type": "control", "action": "skip"|"repeat"|"end"}          - explicit control button (mic-free equivalents of saying it out loud)
  {"type": "client_event", "event_type": "MIC_PERMISSION_GRANTED"|..., "metadata": {...}} - client-side event to log

Server -> client:
  {"type": "session_ready", "stage": "opening", "expires_at": <epoch>}
  {"type": "ai_turn_start", "response_id": <int>}
  {"type": "ai_audio_sentence", "response_id": <int>, "text": "...", "audio_url": "..."|null}
  {"type": "ai_turn_end", "response_id": <int>, "stage": "..."}
  {"type": "transcript_final", "speaker": "candidate", "text": "..."}
  {"type": "error", "message": "..."}
  {"type": "session_ending", "reason": "max_duration"|"idle_timeout"|"ended_by_candidate"}
  {"type": "session_closed"}

Cancellation: every AI response gets a fresh integer `response_id` and a
`threading.Event`. Only an interrupt naming the CURRENTLY active
response_id is honored (stale/duplicate interrupts for an already-finished
or already-cancelled response are silently ignored) — this is the same
guard the frontend's `useLiveInterviewSession` state machine relies on to
never show overlapping AI+candidate audio. Exactly one AI response is ever
in flight per session at a time.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
import threading
import time

from fastapi import APIRouter, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import config
from core import auth, llm, rate_limit, storage, stt, tts
from modules import live_interview as li
from modules import live_interview_evaluation as li_eval

logger = logging.getLogger(__name__)
router = APIRouter()

INTERVIEW_TYPES = {"technical", "hr", "behavioral"}
DIFFICULTIES = {"easy", "medium", "hard"}
STYLES = {"friendly", "neutral", "strict"}


def _require_enabled() -> None:
    if not config.LIVE_INTERVIEW_ENABLED:
        raise HTTPException(status_code=503, detail="Live AI Interview is currently disabled.")


class CreateSessionRequest(BaseModel):
    role: str = Field(max_length=config.MAX_TEXT_FIELD_CHARS)
    interview_type: str = Field("behavioral", max_length=40)
    difficulty: str = Field("medium", max_length=20)
    style: str = Field("neutral", max_length=20)
    duration_secs: int = Field(600, ge=60, le=config.LIVE_INTERVIEW_MAX_DURATION_SECS)


@router.post("/sessions")
def create_session(
    req: CreateSessionRequest, request: Request,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    _require_enabled()
    rate_limit.enforce(
        "live-interview-create", request, config.LIVE_INTERVIEW_RATE_LIMIT,
        config.LIVE_INTERVIEW_RATE_WINDOW_SECS, x_student_name,
    )

    interview_type = req.interview_type.strip().lower() or "behavioral"
    if interview_type not in INTERVIEW_TYPES:
        interview_type = "behavioral"
    difficulty = req.difficulty.strip().lower() or "medium"
    if difficulty not in DIFFICULTIES:
        difficulty = "medium"
    style = req.style.strip().lower() or "neutral"
    if style not in STYLES:
        style = "neutral"
    role = req.role.strip()
    if not role:
        raise HTTPException(status_code=422, detail="Role is required.")

    active = storage.count_active_live_sessions(_owner_name(x_student_name, x_student_pin))
    if active >= config.LIVE_INTERVIEW_MAX_CONCURRENT_PER_STUDENT:
        raise HTTPException(
            status_code=409,
            detail="You already have a live interview in progress. Finish or end it before starting another.",
        )

    duration_secs = min(req.duration_secs, config.LIVE_INTERVIEW_MAX_DURATION_SECS)
    session_config = {
        "role": role, "interview_type": interview_type, "difficulty": difficulty,
        "style": style, "duration_secs": duration_secs,
    }
    session_id = storage.create_live_interview_session(
        role, session_config, student_name=x_student_name, pin=x_student_pin,
        max_duration_secs=duration_secs,
    )
    storage.log_event(session_id, "SESSION_CREATED", session_config)
    return {
        "session_id": session_id,
        "ws_url": f"/api/live-interview/sessions/{session_id}/ws",
        "config": session_config,
        "idle_timeout_secs": config.LIVE_INTERVIEW_IDLE_TIMEOUT_SECS,
    }


def _owner_name(x_student_name: str, x_student_pin: str) -> str:
    """Resolves the same identity string storage.py's other functions
    derive internally (name + optional PIN bucket) — needed here only for
    the pre-flight concurrent-session count, which must match exactly what
    create_live_interview_session/count_active_live_sessions will resolve
    to for the actual row."""
    return storage.resolve_student_name(x_student_name, x_student_pin)


@router.get("/history")
def history(x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    return storage.list_interview_sessions(kind="live", student_name=x_student_name, pin=x_student_pin, limit=30)


@router.get("/sessions/{session_id}")
def get_session(
    session_id: int, x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    session = storage.get_interview_session(session_id)
    if session is None or session.get("kind") != "live":
        raise HTTPException(status_code=404, detail="Session not found.")
    if session["student_name"] != x_student_name:
        raise HTTPException(status_code=403, detail="This session belongs to another student.")
    session["turns"] = storage.list_turns(session_id)
    return session


class EndSessionRequest(BaseModel):
    reason: str = Field("ended_by_candidate", max_length=60)


@router.post("/sessions/{session_id}/end")
def end_session(
    req: EndSessionRequest, session_id: int, request: Request,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    """Graceful end triggered from the REST side (e.g. the client's "End
    interview" button after its WS already closed, or as a fallback if the
    WS connection never came up at all). Idempotent: ending an
    already-ended session just re-returns its existing report rather than
    re-running evaluation."""
    rate_limit.enforce(
        "live-interview-end", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name,
    )
    session = storage.get_interview_session(session_id)
    if session is None or session.get("kind") != "live":
        raise HTTPException(status_code=404, detail="Session not found.")
    if session["student_name"] != x_student_name:
        raise HTTPException(status_code=403, detail="This session belongs to another student.")

    if session.get("summary") is not None:
        return session["summary"]

    turns = storage.list_turns(session_id)
    interrupt_count = sum(1 for e in storage.list_events(session_id) if e["event_type"] == "AI_INTERRUPTED")
    session_config = session.get("config") or {}
    try:
        profile = storage.get_student_profile(x_student_name, x_student_pin)
        report = li_eval.generate_evaluation(
            session_config.get("role", session.get("topic", "")),
            session_config.get("interview_type", "behavioral"),
            session_config.get("difficulty", "medium"),
            turns, interrupt_count=interrupt_count, profile=profile,
        )
    except llm.LLMUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except llm.LLMJsonError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    storage.finish_interview_session(session_id, report, report.get("overall_score") or 0)
    storage.end_live_interview_session(session_id)
    storage.log_event(session_id, "EVALUATION_COMPLETED", {"overall_score": report.get("overall_score")})
    return report


def _synthesize(text: str) -> str | None:
    try:
        path = tts.speak(text)
        return f"/api/live-interview/audio/{os.path.basename(path)}"
    except tts.TTSUnavailableError:
        return None


@router.get("/audio/{filename}")
def get_audio(filename: str):
    safe_name = os.path.basename(filename)
    path = config.GENERATED_DIR / safe_name
    if not path.is_file() or path.parent != config.GENERATED_DIR:
        raise HTTPException(status_code=404, detail="Audio not found.")
    media_type = "audio/mpeg" if safe_name.endswith(".mp3") else "audio/wav"
    return FileResponse(path, media_type=media_type)


# ---------------------------------------------------------------------------
# WebSocket duplex endpoint
# ---------------------------------------------------------------------------

class _SessionRuntime:
    """Per-connection mutable state — one instance per open WS, never shared
    across connections or persisted (the durable record is storage.py's
    interview_sessions/interview_qna/interview_events rows, written to
    incrementally as the conversation happens)."""

    def __init__(self, session_id: int, session_config: dict):
        self.session_id = session_id
        self.config = session_config
        self.stage: str | None = None
        self.transcript: list[dict[str, str]] = []  # [{"speaker": "ai"|"candidate", "text": str}]
        self.seq = 0
        self.response_counter = 0
        self.active_response_id: int | None = None
        self.active_stop_event: threading.Event | None = None
        self.busy = False
        self.started_at = time.time()
        self.closed = False

    def next_seq(self) -> int:
        self.seq += 1
        return self.seq

    def next_response_id(self) -> int:
        self.response_counter += 1
        return self.response_counter


async def _run_ai_turn(
    websocket: WebSocket, rt: _SessionRuntime, token_gen, response_id: int, stop_event: threading.Event,
) -> tuple[str, bool]:
    """Consumes a cancellable sentence generator in a worker thread (LLM
    streaming + per-sentence TTS synthesis are both blocking calls) and
    forwards each sentence to the client as soon as it's ready, via an
    asyncio.Queue bridged with call_soon_threadsafe — the same
    "don't block the event loop on sync work, but still stream results
    incrementally" shape as routers/mock_interview.py's StreamingResponse
    generators, adapted for a push-over-WS transport instead of an HTTP
    response body. Returns (full_text, was_interrupted)."""
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()
    SENTINEL = object()
    sentences: list[str] = []

    def worker():
        try:
            for sentence in li.iter_cancellable_sentences(token_gen, stop_event):
                audio_url = _synthesize(sentence) if rt.config.get("voice_mode", True) else None
                loop.call_soon_threadsafe(queue.put_nowait, ("sentence", sentence, audio_url))
        except llm.LLMUnavailableError as exc:
            loop.call_soon_threadsafe(queue.put_nowait, ("error", str(exc), None))
        except Exception as exc:  # noqa: BLE001
            logger.exception("live interview AI turn failed")
            loop.call_soon_threadsafe(queue.put_nowait, ("error", str(exc), None))
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, (SENTINEL, None, None))

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

    while True:
        kind, a, b = await queue.get()
        if kind is SENTINEL:
            break
        if kind == "sentence":
            sentences.append(a)
            await websocket.send_json({"type": "ai_audio_sentence", "response_id": response_id, "text": a, "audio_url": b})
        elif kind == "error":
            await websocket.send_json({"type": "error", "message": a})

    return " ".join(sentences), stop_event.is_set()


async def _speak_turn(websocket: WebSocket, rt: _SessionRuntime, token_gen) -> None:
    if rt.busy:
        return  # guard: never two AI responses in flight for the same session
    rt.busy = True
    response_id = rt.next_response_id()
    stop_event = threading.Event()
    rt.active_response_id = response_id
    rt.active_stop_event = stop_event

    await websocket.send_json({"type": "ai_turn_start", "response_id": response_id})
    storage.log_event(rt.session_id, "AI_STARTED_SPEAKING", {"response_id": response_id})
    full_text, interrupted = await _run_ai_turn(websocket, rt, token_gen, response_id, stop_event)

    if full_text.strip():
        rt.transcript.append({"speaker": "ai", "text": full_text.strip()})
        storage.log_turn(rt.session_id, "ai", full_text.strip(), rt.next_seq())
    if interrupted:
        storage.log_event(rt.session_id, "AI_INTERRUPTED", {"response_id": response_id})

    rt.busy = False
    if rt.active_response_id == response_id:
        rt.active_response_id = None
        rt.active_stop_event = None
    await websocket.send_json({"type": "ai_turn_end", "response_id": response_id, "stage": rt.stage, "interrupted": interrupted})


def _elapsed_and_total(rt: _SessionRuntime) -> tuple[float, float]:
    return time.time() - rt.started_at, float(rt.config.get("duration_secs", config.LIVE_INTERVIEW_MAX_DURATION_SECS))


async def _handle_candidate_text(websocket: WebSocket, rt: _SessionRuntime, text: str, profile: dict | None) -> None:
    text = (text or "").strip()
    if not text:
        return
    rt.transcript.append({"speaker": "candidate", "text": text})
    storage.log_turn(rt.session_id, "candidate", text, rt.next_seq())
    storage.log_event(rt.session_id, "TRANSCRIPT_FINAL", {"speaker": "candidate"})
    storage.touch_session_activity(rt.session_id)
    await websocket.send_json({"type": "transcript_final", "speaker": "candidate", "text": text})

    control = li.detect_control_intent(text)
    elapsed, total = _elapsed_and_total(rt)
    rt.stage = li.next_stage(rt.stage, elapsed, total)
    if control == "end":
        rt.stage = "closing"

    token_gen = li.stream_turn(
        rt.config["role"], rt.config["interview_type"], rt.config["difficulty"], rt.config["style"],
        rt.stage, rt.transcript[:-1], text, profile=profile, control=control,
    )
    await _speak_turn(websocket, rt, token_gen)

    if control == "end":
        await _graceful_close(websocket, rt, "ended_by_candidate")


async def _graceful_close(websocket: WebSocket, rt: _SessionRuntime, reason: str) -> None:
    if rt.closed:
        return
    rt.closed = True
    storage.log_event(rt.session_id, "INTERVIEW_ENDED", {"reason": reason})
    try:
        await websocket.send_json({"type": "session_ending", "reason": reason})
        await websocket.send_json({"type": "session_closed"})
    except Exception:  # noqa: BLE001
        pass
    storage.end_live_interview_session(rt.session_id)
    try:
        await websocket.close(code=1000)
    except Exception:  # noqa: BLE001
        pass


async def _watch_timeouts(websocket: WebSocket, rt: _SessionRuntime, profile: dict | None) -> None:
    """Background task: closes the session with a natural spoken closing
    line once the server-enforced max duration or idle timeout is hit,
    exactly as required — the AI is allowed to say a short goodbye before
    the socket actually closes, rather than being cut off mid-sentence."""
    while not rt.closed:
        await asyncio.sleep(5)
        if rt.closed:
            return
        now = time.time()
        elapsed = now - rt.started_at
        last_activity = storage.get_interview_session(rt.session_id)
        last_activity_at = (last_activity or {}).get("last_activity_at") or rt.started_at
        idle_for = now - last_activity_at

        reason = None
        if elapsed >= rt.config.get("duration_secs", config.LIVE_INTERVIEW_MAX_DURATION_SECS):
            reason = "max_duration"
        elif idle_for >= config.LIVE_INTERVIEW_IDLE_TIMEOUT_SECS:
            reason = "idle_timeout"
        if reason and not rt.busy:
            rt.stage = "closing"
            try:
                token_gen = li.stream_turn(
                    rt.config["role"], rt.config["interview_type"], rt.config["difficulty"], rt.config["style"],
                    "closing", rt.transcript, "", profile=profile, control="end",
                )
                await _speak_turn(websocket, rt, token_gen)
            except Exception:  # noqa: BLE001
                pass
            await _graceful_close(websocket, rt, reason)
            return
        elif reason and rt.busy:
            continue  # try again on the next tick once the current turn finishes


@router.websocket("/sessions/{session_id}/ws")
async def live_interview_ws(websocket: WebSocket, session_id: int):
    # Auth/ownership/state are all checked BEFORE accept() — rejecting the
    # handshake outright (server sends "websocket.close" instead of
    # "websocket.accept" in response to the connection attempt, which the
    # ASGI spec allows) rather than accepting and then immediately closing,
    # so a client (or test) sees the connection attempt itself fail instead
    # of a connection that briefly "succeeds" then closes.
    token = websocket.cookies.get(auth.SESSION_COOKIE)
    username = auth.resolve_session(token)
    if not username:
        await websocket.close(code=4401, reason="Not authenticated.")
        return
    if not config.LIVE_INTERVIEW_ENABLED:
        await websocket.close(code=4403, reason="Live interview is disabled.")
        return

    session = storage.get_interview_session(session_id)
    if session is None or session.get("kind") != "live":
        await websocket.close(code=4404, reason="Session not found.")
        return
    if session["student_name"] != username:
        await websocket.close(code=4403, reason="This session belongs to another student.")
        return
    if session.get("ended_at"):
        await websocket.close(code=4409, reason="Session already ended.")
        return
    now = time.time()
    if session.get("expires_at") and now > session["expires_at"]:
        storage.end_live_interview_session(session_id)
        await websocket.close(code=4408, reason="Session expired.")
        return

    await websocket.accept()
    session_config = dict(session.get("config") or {})
    session_config.setdefault("voice_mode", True)
    rt = _SessionRuntime(session_id, session_config)
    profile = storage.get_student_profile(username, "")

    watcher_task = asyncio.create_task(_watch_timeouts(websocket, rt, profile))
    try:
        await websocket.send_json({
            "type": "session_ready", "stage": "opening",
            "expires_at": session.get("expires_at"),
            "idle_timeout_secs": config.LIVE_INTERVIEW_IDLE_TIMEOUT_SECS,
        })
        rt.stage = "opening"
        opening_gen = li.stream_opening(
            session_config["role"], session_config["interview_type"], session_config["difficulty"],
            session_config["style"], profile=profile,
        )
        await _speak_turn(websocket, rt, opening_gen)

        while not rt.closed:
            try:
                raw = await websocket.receive_json()
            except WebSocketDisconnect:
                break
            except Exception:  # noqa: BLE001
                # Not JSON, or the socket hiccuped — ignore this one frame
                # rather than tearing down the whole session over it.
                continue

            msg_type = raw.get("type")
            storage.touch_session_activity(session_id)

            if msg_type == "interrupt":
                resp_id = raw.get("response_id")
                if rt.active_response_id is not None and resp_id == rt.active_response_id and rt.active_stop_event:
                    rt.active_stop_event.set()

            elif msg_type == "text_answer":
                if rt.busy:
                    continue  # never two AI responses in flight; drop late input from the same turn
                await _handle_candidate_text(websocket, rt, raw.get("text", ""), profile)

            elif msg_type == "audio_answer":
                if rt.busy:
                    continue
                try:
                    audio_bytes = base64.b64decode(raw.get("audio_base64") or "", validate=False)
                except Exception:  # noqa: BLE001
                    await websocket.send_json({"type": "error", "message": "Could not decode audio."})
                    continue
                if not audio_bytes or len(audio_bytes) > config.MAX_UPLOAD_BYTES:
                    await websocket.send_json({"type": "error", "message": "Audio clip is empty or too large."})
                    continue
                if len(audio_bytes) < li.MIN_UTTERANCE_WAV_BYTES:
                    # Below ~0.5s of 16kHz/16-bit mono audio: too short to be
                    # real speech (a VAD misfire on a click/breath/room noise).
                    # Whisper is known to hallucinate plausible-sounding text
                    # ("thank you", "bye", a stray sentence) on clips this
                    # short or near-silent, which would otherwise silently
                    # advance the interview on nothing the candidate said —
                    # drop it before it ever reaches STT.
                    continue
                try:
                    text = await asyncio.to_thread(stt.transcribe, audio_bytes)
                except stt.STTUnavailableError as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                    continue
                if li.looks_like_stt_hallucination(text):
                    continue
                await _handle_candidate_text(websocket, rt, text, profile)

            elif msg_type == "control":
                if rt.busy:
                    continue
                action = raw.get("action")
                if action == "end":
                    await _handle_candidate_text(websocket, rt, "end the interview", profile)
                elif action in ("skip", "repeat"):
                    await _handle_candidate_text(websocket, rt, action, profile)

            elif msg_type == "client_event":
                event_type = str(raw.get("event_type") or "CLIENT_EVENT")[:60]
                storage.log_event(session_id, event_type, raw.get("metadata") or {})

    except WebSocketDisconnect:
        pass
    finally:
        watcher_task.cancel()
        if rt.active_stop_event:
            rt.active_stop_event.set()
        if not rt.closed:
            storage.log_event(session_id, "INTERVIEW_ENDED", {"reason": "disconnected"})
            storage.end_live_interview_session(session_id)
