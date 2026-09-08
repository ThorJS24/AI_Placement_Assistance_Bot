"""Business logic for the AI Placement Chatbot module (pages/1_💬_AI_Chatbot.py)."""
from __future__ import annotations

from typing import Generator

import config
from core import llm, rag, runtime_settings


def _system_prompt() -> str:
    # Built fresh per call so runtime setting changes take effect immediately.
    return f"""You are the AI Placement Mentor for {runtime_settings.effective_department_name()}. \
You help students prepare for campus placements with natural, human-like advice: resume guidance, interview strategy, \
DSA concepts, company tips, and career advice.

CONVERSATIONAL SPEECH & TONE GUIDELINES:
- Speak like a friendly, experienced senior mentor chatting over coffee — warm, encouraging, and natural.
- Avoid robotic or academic textbook jargon. Write as if you are speaking directly to the student in natural spoken English.
- Keep responses clean, focused, and conversational. Use short, relatable paragraphs.
- If department FAQ context is provided below, prioritize it for department policies or deadlines.
- If you don't know a specific department detail, state it naturally ("Check with your placement cell coordinator for exact dates") rather than guessing.
- Never fabricate company names, stats, or policies."""


def _profile_block(profile: dict | None) -> str:
    if not profile:
        return ""
    parts = []
    if profile.get("stream"):
        parts.append(f"Stream/branch: {profile['stream']}")
    if profile.get("specialization"):
        parts.append(f"Specialization/honours: {profile['specialization']}")
    if profile.get("semester"):
        parts.append(f"Current semester: {profile['semester']}")
    if profile.get("subjects"):
        parts.append(f"Subjects this semester: {', '.join(profile['subjects'])}")
    if not parts:
        return ""
    return "This student's profile (use to tailor advice - don't just repeat it back verbatim):\n" + "\n".join(
        f"- {p}" for p in parts
    )


def answer_stream(history: list[dict], user_message: str, profile: dict | None = None) -> Generator[str, None, None]:
    """Stream a chatbot reply given prior turns + the new user message."""
    context_block = rag.build_context_block(user_message)
    system = _system_prompt()
    profile_block = _profile_block(profile)
    if profile_block:
        system = f"{system}\n\n{profile_block}"
    if context_block:
        system = f"{system}\n\n{context_block}"

    messages = [{"role": "system", "content": system}]
    # keep only the most recent turns to bound context size
    trimmed = history[-(config.MAX_CHAT_HISTORY_TURNS * 2):]
    messages.extend({"role": h["role"], "content": h["content"]} for h in trimmed)
    messages.append({"role": "user", "content": user_message})

    yield from llm.stream_chat(messages, temperature=0.6, max_tokens=900)


SUGGESTED_PROMPTS = [
    "How do I answer 'Tell me about yourself' in an interview?",
    "Review the structure of my resume - what sections should I include?",
    "What DSA topics should I prioritize with 2 months left before placements?",
    "Explain the STAR method for behavioral interview questions.",
]
