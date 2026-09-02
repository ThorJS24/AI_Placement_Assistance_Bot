"""
Minimal in-memory rate limiter.

This is a single-process, in-memory sliding window — sufficient for a local
department app run as one uvicorn process (see run.bat). It is intentionally
simple: no external dependency, no persistence. If this app is ever deployed
behind multiple worker processes, swap this for a shared store (e.g. Redis)
since counters would otherwise be per-process and the limit would be
effectively multiplied by the worker count.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_lock = threading.Lock()
_hits: dict[str, deque] = defaultdict(deque)


def allow(key: str, max_calls: int, window_secs: float) -> bool:
    """Returns True (and records a hit) if `key` has made fewer than
    `max_calls` within the trailing `window_secs`. Returns False (recording
    nothing) if the caller should be rejected as rate-limited."""
    now = time.time()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window_secs:
            q.popleft()
        if len(q) >= max_calls:
            return False
        q.append(now)
        return True


def client_key(request: Request, student_name: str | None = None) -> str:
    """Best available identity for rate-limiting purposes: the student name
    tag if one was sent, otherwise the connecting IP. Not a security
    boundary (a name is trivially spoofable) — just enough to stop one
    runaway client from being counted against a shared "unknown" bucket."""
    if student_name and student_name.strip():
        return student_name.strip()
    return request.client.host if request.client else "unknown"


def enforce(scope: str, request: Request, max_calls: int, window_secs: float, student_name: str | None = None) -> None:
    """Raise HTTP 429 if this caller has exceeded `max_calls` within
    `window_secs` for the given `scope` (a short string namespacing this
    endpoint's counter from every other endpoint's, e.g. "chat" or
    "resume-build", so a burst on one feature doesn't eat another's quota)."""
    key = f"{scope}:{client_key(request, student_name)}"
    if not allow(key, max_calls, window_secs):
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests — please wait a moment and try again (limit: {max_calls} per {int(window_secs)}s).",
        )
