"""Mock Interview (speech-to-speech) endpoints."""
from __future__ import annotations

import asyncio
import json
import os
import threading
from typing import Literal

from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

import config
from core import llm, rate_limit, report_pdf, storage, stt, tts, utils, validation
from modules import mock_interview as mi

router = APIRouter()


def _event(data: dict) -> str:
    """One line-delimited JSON event for the live-mode streaming endpoints
    below — the frontend reads the plain-text stream and JSON.parses each
    line (see api/client.js's apiPostStream + MockInterview.jsx's live-mode
    consumer)."""
    return json.dumps(data) + "\n"


def _watch_disconnect(request: Request, stop_event: threading.Event) -> None:
    """Same pattern as routers/chat.py's stream_chat: a small concurrent
    asyncio task that flips a threading.Event the sync generator checks
    between chunks, so closing the tab / hitting "stop" stops LLM/TTS work
    promptly instead of running to completion in the background."""
    async def watch():
        while not stop_event.is_set():
            if await request.is_disconnected():
                stop_event.set()
                return
            await asyncio.sleep(0.5)

    asyncio.create_task(watch())


class StartRequest(BaseModel):
    role: str = Field(max_length=config.MAX_TEXT_FIELD_CHARS)
    level: str = Field("Fresher / Final-year student", max_length=config.MAX_TEXT_FIELD_CHARS)
    num_questions: int = 5
    voice_mode: bool = True


@router.post("/start")
def start(
    req: StartRequest, request: Request,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    rate_limit.enforce("mock-start", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    try:
        profile = storage.get_student_profile(x_student_name, x_student_pin)
        question = mi.generate_first_question(req.role, req.level, profile)
    except llm.LLMUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    session_id = storage.create_interview_session("mock", req.role, student_name=x_student_name, pin=x_student_pin)
    audio_url = None
    if req.voice_mode:
        audio_url = _synthesize(question)

    return {"session_id": session_id, "question": question, "audio_url": audio_url}


@router.post("/start/stream")
async def start_stream(
    req: StartRequest, request: Request,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    """Live-mode variant of /start: streams the opening question sentence by
    sentence (each with its own already-synthesized audio clip, when
    voice_mode is on) instead of waiting for the whole question and a single
    audio file — see MockInterview.jsx's live-mode audio queue player."""
    rate_limit.enforce("mock-start", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    profile = storage.get_student_profile(x_student_name, x_student_pin)
    session_id = storage.create_interview_session("mock", req.role, student_name=x_student_name, pin=x_student_pin)

    stop_event = threading.Event()
    _watch_disconnect(request, stop_event)

    def generate():
        # Sent first, before any sentence/audio events: the session already
        # exists (created above) and the frontend needs this id to submit an
        # answer, which can happen very fast if the student barges in on the
        # very first sentence — sending it last (bundled into the final
        # "done" event, as an earlier version of this endpoint did) created a
        # real race where a fast barge-in + answer could fire /next/stream
        # with session_id still null, since React hadn't yet applied the
        # state update from "done" (which arrives only once ALL sentences,
        # not just the first, have finished generating).
        yield _event({"type": "session", "session_id": session_id})
        splitter = utils.IncrementalSentenceSplitter()
        full_text = ""
        try:
            for piece in mi.stream_first_question(req.role, req.level, profile):
                if stop_event.is_set():
                    return
                full_text += piece
                for sentence in splitter.feed(piece):
                    audio_url = _synthesize(sentence) if req.voice_mode else None
                    yield _event({"type": "sentence", "text": sentence, "audio_url": audio_url})
            remainder = splitter.flush()
            if remainder:
                audio_url = _synthesize(remainder) if req.voice_mode else None
                yield _event({"type": "sentence", "text": remainder, "audio_url": audio_url})
        except llm.LLMUnavailableError as exc:
            yield _event({"type": "error", "message": str(exc)})
            return
        finally:
            stop_event.set()
        yield _event({"type": "done", "session_id": session_id, "question": full_text.strip()})

    return StreamingResponse(generate(), media_type="text/plain")


@router.post("/transcribe")
async def transcribe(request: Request, audio: UploadFile = File(...), x_student_name: str = Header(default="Guest")):
    rate_limit.enforce("mock-transcribe", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    try:
        audio_bytes = await validation.enforce_upload_size(audio)
        text = stt.transcribe(audio_bytes)
        return {"transcript": text}
    except stt.STTUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


class Turn(BaseModel):
    question: str = Field(max_length=config.MAX_LONG_TEXT_CHARS)
    answer: str = Field(max_length=config.MAX_LONG_TEXT_CHARS)
    feedback: str = Field("", max_length=config.MAX_LONG_TEXT_CHARS)


class NextRequest(BaseModel):
    session_id: int
    role: str = Field(max_length=config.MAX_TEXT_FIELD_CHARS)
    level: str = Field("", max_length=config.MAX_TEXT_FIELD_CHARS)
    qna_so_far: list[Turn] = Field(default_factory=list, max_length=50)
    last_answer: str = Field(max_length=config.MAX_LONG_TEXT_CHARS)
    voice_mode: bool = True


@router.post("/next")
def next_turn(
    req: NextRequest, request: Request,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    rate_limit.enforce("mock-next", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    qna_so_far = [t.model_dump() for t in req.qna_so_far]
    prior_question = qna_so_far[-1]["question"] if qna_so_far else ""
    storage.log_qna(req.session_id, prior_question, req.last_answer, "", None)

    try:
        profile = storage.get_student_profile(x_student_name, x_student_pin)
        turn = mi.generate_next_turn(req.role, req.level, qna_so_far, req.last_answer, profile)
    except llm.LLMUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except llm.LLMJsonError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    audio_url = None
    if req.voice_mode and turn.get("next_question"):
        audio_url = _synthesize(turn["next_question"])

    return {
        "feedback": turn.get("feedback", ""),
        "next_question": turn.get("next_question", ""),
        "audio_url": audio_url,
    }


@router.post("/next/stream")
async def next_turn_stream(
    req: NextRequest, request: Request,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    """Live-mode variant of /next: streams feedback text as soon as it's
    generated, then the next question sentence by sentence with each
    sentence's audio synthesized as it completes — the biggest single
    contributor to feeling "live" rather than turn-based, since the student
    starts hearing the next question well before the model has finished
    writing all of it."""
    rate_limit.enforce("mock-next", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    qna_so_far = [t.model_dump() for t in req.qna_so_far]
    prior_question = qna_so_far[-1]["question"] if qna_so_far else ""
    storage.log_qna(req.session_id, prior_question, req.last_answer, "", None)
    profile = storage.get_student_profile(x_student_name, x_student_pin)

    stop_event = threading.Event()
    _watch_disconnect(request, stop_event)

    feedback_marker = mi.NEXT_TURN_STREAM_MARKER_FEEDBACK
    question_marker = mi.NEXT_TURN_STREAM_MARKER_QUESTION

    def _safe_split(buf: str, marker: str) -> tuple[str | None, str]:
        """If `marker` appears in `buf`, returns (text_before_marker, text_after_marker).
        Otherwise returns (None, buf) but — critically — never with more of
        `buf` "confirmed safe" than `len(buf) - (len(marker) - 1)` characters,
        so a marker split across two streamed token pieces (e.g. one piece
        ends in "QUEST", the next starts with "ION:") still gets held back
        long enough to be recognized once the second piece arrives, instead
        of the first fragment being flushed out as plain text before the
        marker can ever be matched as a whole."""
        if marker in buf:
            before, after = buf.split(marker, 1)
            return before, after
        return None, buf

    def generate():
        pending = ""       # unprocessed text waiting for a mode transition marker
        mode = "before_feedback"
        feedback_text = ""
        question_text = ""
        splitter = utils.IncrementalSentenceSplitter()
        try:
            for piece in mi.stream_next_turn(req.role, req.level, qna_so_far, req.last_answer, profile):
                if stop_event.is_set():
                    return
                pending += piece

                if mode == "before_feedback":
                    before, pending = _safe_split(pending, feedback_marker)
                    if before is not None:
                        mode = "feedback"
                    else:
                        continue  # nothing yet, and nothing safe to flush pre-marker

                if mode == "feedback":
                    before, after = _safe_split(pending, question_marker)
                    if before is not None:
                        feedback_text += before
                        pending = after
                        mode = "question"
                        yield _event({"type": "feedback", "text": feedback_text.strip()})
                    else:
                        # Hold back a tail long enough to still catch the
                        # marker if it's split across the next piece.
                        safe_len = max(0, len(pending) - (len(question_marker) - 1))
                        feedback_text += pending[:safe_len]
                        pending = pending[safe_len:]

                if mode == "question":
                    question_text += pending
                    for sentence in splitter.feed(pending):
                        audio_url = _synthesize(sentence) if req.voice_mode else None
                        yield _event({"type": "sentence", "text": sentence, "audio_url": audio_url})
                    pending = ""

            remainder = splitter.flush()
            if remainder and mode == "question":
                audio_url = _synthesize(remainder) if req.voice_mode else None
                yield _event({"type": "sentence", "text": remainder, "audio_url": audio_url})
        except llm.LLMUnavailableError as exc:
            yield _event({"type": "error", "message": str(exc)})
            return
        except llm.LLMJsonError as exc:
            yield _event({"type": "error", "message": str(exc)})
            return
        finally:
            stop_event.set()
        yield _event({"type": "done", "feedback": feedback_text.strip(), "next_question": question_text.strip()})

    return StreamingResponse(generate(), media_type="text/plain")


class Violation(BaseModel):
    type: str = Field(max_length=60)
    label: str = Field("", max_length=120)
    at: float = 0


class FinishRequest(BaseModel):
    session_id: int
    role: str = Field(max_length=config.MAX_TEXT_FIELD_CHARS)
    level: str = Field("", max_length=config.MAX_TEXT_FIELD_CHARS)
    qna: list[Turn] = Field(max_length=50)
    violations: list[Violation] = Field(default_factory=list, max_length=100)


@router.post("/finish")
def finish(
    req: FinishRequest, request: Request,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    rate_limit.enforce("mock-finish", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    all_text = " ".join(t.answer for t in req.qna)
    filler_counts = utils.count_filler_words(all_text)
    filler_summary = ", ".join(f"{k} x{v}" for k, v in filler_counts.items()) or "none detected"
    total_words = utils.word_count(all_text)
    filler_ratio = (sum(filler_counts.values()) / total_words) if total_words else 0.0

    try:
        profile = storage.get_student_profile(x_student_name, x_student_pin)
        report = mi.generate_final_report(
            req.role, req.level, [t.model_dump() for t in req.qna], filler_summary,
            profile=profile, filler_ratio=filler_ratio,
        )
    except llm.LLMUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except llm.LLMJsonError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    report["violations"] = [v.model_dump() for v in req.violations]
    storage.finish_interview_session(req.session_id, report, report.get("overall_score", 0))
    report["filler_summary"] = filler_summary
    return report


@router.get("/history")
def history(x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    """This student's past mock interview attempts, most recent first — each
    entry includes the score and stored report so the frontend can render a
    trend view without re-running the interview."""
    return storage.list_interview_sessions(kind="mock", student_name=x_student_name, pin=x_student_pin, limit=30)


class ReportPdfRequest(BaseModel):
    report: dict
    role: str
    qna: list[Turn] = []


@router.post("/report/pdf")
def report_pdf_export(req: ReportPdfRequest):
    path = report_pdf.build_interview_report_pdf(req.report, req.role, [t.model_dump() for t in req.qna])
    return {"download_pdf": f"/api/mock/report/download/{os.path.basename(path)}"}


@router.get("/report/download/{filename}")
def download_report_pdf(filename: str):
    safe_name = os.path.basename(filename)
    path = config.GENERATED_DIR / safe_name
    if not path.is_file() or path.parent != config.GENERATED_DIR:
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(path, filename=safe_name)


@router.get("/audio/{filename}")
def get_audio(filename: str):
    safe_name = os.path.basename(filename)
    path = config.GENERATED_DIR / safe_name
    if not path.is_file() or path.parent != config.GENERATED_DIR:
        raise HTTPException(status_code=404, detail="Audio not found.")
    media_type = "audio/mpeg" if safe_name.endswith(".mp3") else "audio/wav"
    return FileResponse(path, media_type=media_type)


def _synthesize(text: str) -> str | None:
    try:
        path = tts.speak(text)
        return f"/api/mock/audio/{os.path.basename(path)}"
    except tts.TTSUnavailableError:
        return None
