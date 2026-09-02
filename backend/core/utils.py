"""Small shared helpers used across multiple pages/modules."""
from __future__ import annotations

import re
import uuid

FILLER_WORDS = {
    "um", "uh", "umm", "uhh", "like", "actually", "basically", "literally",
    "you know", "sort of", "kind of", "i mean", "so yeah", "right",
}


def new_session_id() -> str:
    return uuid.uuid4().hex[:12]


def count_filler_words(text: str) -> dict[str, int]:
    """Rough filler-word counter used to give mock-interview candidates
    feedback on verbal habits. Not linguistically perfect, but gives a
    useful, consistent signal for self-practice."""
    lowered = f" {text.lower()} "
    counts: dict[str, int] = {}
    for filler in FILLER_WORDS:
        pattern = r"\b" + re.escape(filler) + r"\b"
        n = len(re.findall(pattern, lowered))
        if n:
            counts[filler] = n
    return counts


def word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text or ""))


def truncate(text: str, max_chars: int = 4000) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n...[truncated]"


# Stage-direction asides ("(pausing for a moment)", "(smiles)", "(clears
# throat)") that small/local LLMs sometimes emit despite being told to
# return only what they'd say out loud — harmless in written chat, but
# actively wrong once spoken by TTS and shown in a live transcript (see
# modules/live_interview.py's stream_turn/stream_opening, the only callers
# that need this). Deliberately narrow: only strips parentheticals whose
# content matches a known stage-direction vocabulary, so a legitimate
# technical aside like "(e.g. AWS)" is left alone.
_STAGE_DIRECTION_CUES = re.compile(
    r"\((?:[^()]{0,60}\b(?:pausing|pause|paus(?:es|ed)|laughs?|chuckles?|smiles?|nods?|sighs?|"
    r"clears? throat|waits?|thinks?|silence|beat)\b[^()]{0,60})\)",
    re.IGNORECASE,
)


def strip_stage_directions(text: str) -> str:
    cleaned = _STAGE_DIRECTION_CUES.sub("", text or "")
    cleaned = _ROLE_LABEL_PREFIX.sub("", cleaned)
    return re.sub(r"[ \t]{2,}", " ", cleaned).strip()


# Small/local models sometimes slip back into a written-dialogue-script
# format ("Interviewer: ...", "Candidate: ...", "AI: ...") despite being
# told to return only the spoken words — strip a leaking role label
# wherever it starts a sentence/line, not just at the very front of the
# whole response (see modules/live_interview.py's stream_turn).
_ROLE_LABEL_PREFIX = re.compile(
    r"(?:^|(?<=[.!?]\s))(?:interviewer|candidate|ai|you|assistant)\s*:\s*",
    re.IGNORECASE,
)


_SENTENCE_END_RE = re.compile(r"[.!?](?:\s+|$)")


class IncrementalSentenceSplitter:
    """Feed it text pieces as they stream in from an LLM; it yields each
    completed sentence as soon as the piece that finishes it arrives, rather
    than waiting for the whole response — used by the mock interview's
    live-mode streaming endpoint so TTS can start synthesizing (and the
    student can start hearing) the first sentence of a question while the
    rest of it is still being generated.

    Not linguistically perfect (a decimal like "3.5" or an abbreviation like
    "e.g." will split early) — acceptable here since the only consequence is
    an extra short TTS clip boundary, not a correctness issue, and interview
    question text rarely contains either.
    """

    def __init__(self) -> None:
        self._buffer = ""

    def feed(self, piece: str) -> list[str]:
        """Returns zero or more newly-completed sentences."""
        self._buffer += piece
        sentences: list[str] = []
        while True:
            match = _SENTENCE_END_RE.search(self._buffer)
            if not match:
                break
            end = match.end()
            sentence = self._buffer[:end].strip()
            self._buffer = self._buffer[end:]
            if sentence:
                sentences.append(sentence)
        return sentences

    def flush(self) -> str | None:
        """Call once the source stream is exhausted — returns any trailing
        partial sentence that never got a closing punctuation mark, or None."""
        remainder = self._buffer.strip()
        self._buffer = ""
        return remainder or None
