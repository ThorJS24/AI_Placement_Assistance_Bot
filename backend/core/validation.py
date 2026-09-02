"""
Shared input-size guardrails for free-form fields across the API.

Philosophy: silently truncate rather than hard-reject wherever the field is
just "too enthusiastic" (a student pasting an extra-long job description or
a few too many skills shouldn't get a scary 422) - but always cap it, since
every one of these fields either flows into an LLM prompt (cost/latency) or
gets stored in SQLite forever (core/storage.py). File uploads are the
exception: those get a hard reject, since reading an oversized file into
memory is the actual risk, not just a slightly-too-long string.
"""
from __future__ import annotations

import config
from fastapi import HTTPException, UploadFile


def cap_text(value: str | None, max_chars: int = config.MAX_TEXT_FIELD_CHARS) -> str:
    if not value:
        return ""
    return value.strip()[:max_chars]


def cap_list(
    items: list[str] | None,
    max_items: int = config.MAX_LIST_ITEMS,
    max_item_chars: int = config.MAX_BULLET_CHARS,
) -> list[str]:
    if not items:
        return []
    return [str(item).strip()[:max_item_chars] for item in items[:max_items] if str(item).strip()]


async def enforce_upload_size(file: UploadFile, max_bytes: int = config.MAX_UPLOAD_BYTES) -> bytes:
    """Reads the upload while enforcing a hard byte cap, so an oversized
    file (accidental or deliberate) never gets fully buffered into memory
    before being rejected. Returns the file's bytes if under the cap."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File is too large - the limit is {max_bytes // (1024 * 1024)}MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)
