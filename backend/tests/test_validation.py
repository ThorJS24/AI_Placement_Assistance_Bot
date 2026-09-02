"""Tests for core/validation.py's shared input-size guardrails."""
from __future__ import annotations

import asyncio

import pytest
from fastapi import HTTPException

from core import validation


def test_cap_text_strips_and_truncates():
    assert validation.cap_text("  hello  ") == "hello"
    assert validation.cap_text(None) == ""
    assert validation.cap_text("") == ""
    assert validation.cap_text("x" * 10, max_chars=5) == "xxxxx"


def test_cap_list_drops_empties_and_truncates():
    assert validation.cap_list(["  a ", "", "b"]) == ["a", "b"]
    assert validation.cap_list(["x" * 500], max_item_chars=10) == ["x" * 10]
    assert validation.cap_list(list(range(100)), max_items=3) == ["0", "1", "2"]
    assert validation.cap_list(None) == []
    assert validation.cap_list([]) == []


class _FakeUpload:
    """Duck-types just the `.read(n)` coroutine enforce_upload_size uses —
    no need to construct a real fastapi.UploadFile for a unit test."""

    def __init__(self, chunks):
        self._chunks = list(chunks)

    async def read(self, n):
        if not self._chunks:
            return b""
        return self._chunks.pop(0)


def test_enforce_upload_size_rejects_over_limit():
    big = _FakeUpload([b"x" * 1024, b"y" * 1024])

    async def run():
        await validation.enforce_upload_size(big, max_bytes=1024)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(run())
    assert exc_info.value.status_code == 413


def test_enforce_upload_size_allows_under_limit():
    small = _FakeUpload([b"hello"])

    async def run():
        return await validation.enforce_upload_size(small, max_bytes=1024)

    assert asyncio.run(run()) == b"hello"
