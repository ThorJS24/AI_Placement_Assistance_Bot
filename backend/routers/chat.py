"""AI Placement Chatbot endpoints."""
from __future__ import annotations

import asyncio
import threading
from typing import Literal

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import config
from core import llm, rate_limit, storage, validation
from modules import chatbot

router = APIRouter()


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=config.MAX_CHAT_MESSAGE_CHARS)


class ChatRequest(BaseModel):
    session_id: str
    message: str = Field(max_length=config.MAX_CHAT_MESSAGE_CHARS)
    # Generous - the frontend sends the whole conversation each turn and
    # modules/chatbot.py already trims to the last MAX_CHAT_HISTORY_TURNS*2
    # turns before building the prompt. This cap only guards against a
    # clearly-abusive payload, not real usage (even a very long single
    # session won't approach 400 turns).
    history: list[ChatTurn] = Field(default_factory=list, max_length=400)


class RenameSessionRequest(BaseModel):
    title: str


class FeedbackRequest(BaseModel):
    feedback: Literal["up", "down", None] = None


@router.post("/stream")
async def stream_chat(
    req: ChatRequest, request: Request,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    """Streams the assistant's reply as plain text chunks (fetch-based streaming,
    not a strict SSE parser - the frontend just reads and appends each chunk).

    The actual token loop stays a *synchronous* generator on purpose: Starlette
    runs sync generators in a thread pool automatically, so one slow LLM call
    never blocks the event loop for other students' requests. Disconnect
    detection (stopping early if the student hits "stop generating" or closes
    the tab) instead runs as a small concurrent asyncio task that flips a
    threading.Event the generator checks between chunks - this way we get real
    early-exit without giving up the thread-pooled streaming.
    """
    rate_limit.enforce("chat", request, config.CHAT_RATE_LIMIT, config.CHAT_RATE_WINDOW_SECS, x_student_name)

    storage.touch_chat_session(req.session_id, first_message=req.message, student_name=x_student_name, pin=x_student_pin)
    storage.save_chat_message(req.session_id, "user", req.message)
    history = [{"role": t.role, "content": t.content} for t in req.history]
    profile = storage.get_student_profile(x_student_name, x_student_pin)

    stop_event = threading.Event()

    async def watch_disconnect():
        while not stop_event.is_set():
            if await request.is_disconnected():
                stop_event.set()
                return
            await asyncio.sleep(0.5)

    asyncio.create_task(watch_disconnect())

    def generate():
        full_text = ""
        try:
            for piece in chatbot.answer_stream(history, req.message, profile=profile):
                if stop_event.is_set():
                    break
                full_text += piece
                yield piece
        except llm.LLMUnavailableError as exc:
            full_text = f"⚠️ {exc}"
            yield full_text
        finally:
            stop_event.set()  # also lets watch_disconnect() above exit promptly
            if full_text:
                storage.save_chat_message(req.session_id, "assistant", full_text)

    return StreamingResponse(generate(), media_type="text/plain")


@router.get("/history/{session_id}")
def get_history(session_id: str):
    return storage.load_chat_history(session_id)


@router.patch("/message/{message_id}/feedback")
def set_message_feedback(message_id: int, req: FeedbackRequest):
    storage.set_chat_message_feedback(message_id, req.feedback)
    return {"ok": True}


@router.get("/suggestions")
def get_suggestions():
    return chatbot.SUGGESTED_PROMPTS


@router.get("/sessions")
def list_sessions(x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    """This student's chat conversations, most recently active first - powers
    the ChatGPT-style history list in the sidebar."""
    return storage.list_chat_sessions(student_name=x_student_name, pin=x_student_pin)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    storage.delete_chat_session(session_id, student_name=x_student_name, pin=x_student_pin)
    return {"ok": True}


@router.patch("/sessions/{session_id}")
def rename_session(
    session_id: str, req: RenameSessionRequest,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    title = req.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty.")
    storage.rename_chat_session(session_id, title, student_name=x_student_name, pin=x_student_pin)
    return {"ok": True}
