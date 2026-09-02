"""Tests for core/rate_limit.py's in-memory sliding-window limiter.

The limiter's `_hits` store is process-global and persists across tests
(there's no reset hook, by design - it's meant to live for the app's whole
process lifetime), so every test uses a unique key/scope via uuid4 rather
than relying on any shared state being clean.
"""
from __future__ import annotations

import time
import uuid

import pytest
from fastapi import HTTPException

from core import rate_limit


class _FakeClient:
    def __init__(self, host):
        self.host = host


class _FakeRequest:
    """rate_limit only ever reads request.client.host - a tiny stand-in
    avoids constructing a real ASGI scope for a plain unit test."""

    def __init__(self, host="1.2.3.4"):
        self.client = _FakeClient(host)


def test_allow_within_and_over_window():
    key = f"test-{uuid.uuid4()}"
    for _ in range(3):
        assert rate_limit.allow(key, 3, 60) is True
    assert rate_limit.allow(key, 3, 60) is False


def test_allow_resets_after_window_expires():
    key = f"test-{uuid.uuid4()}"
    assert rate_limit.allow(key, 1, 0.05) is True
    assert rate_limit.allow(key, 1, 0.05) is False
    time.sleep(0.1)
    assert rate_limit.allow(key, 1, 0.05) is True


def test_client_key_prefers_student_name_over_ip():
    req = _FakeRequest("9.9.9.9")
    assert rate_limit.client_key(req, "Priya") == "Priya"
    assert rate_limit.client_key(req, None) == "9.9.9.9"
    assert rate_limit.client_key(req, "   ") == "9.9.9.9"  # whitespace-only falls back to IP


def test_enforce_raises_429_over_limit_with_clear_message():
    req = _FakeRequest(f"host-{uuid.uuid4()}")
    scope = f"scope-{uuid.uuid4()}"
    for _ in range(2):
        rate_limit.enforce(scope, req, 2, 60)  # first 2 calls succeed
    with pytest.raises(HTTPException) as exc_info:
        rate_limit.enforce(scope, req, 2, 60)
    assert exc_info.value.status_code == 429
    assert "2 per 60s" in exc_info.value.detail


def test_enforce_scopes_are_independent():
    """A burst against one endpoint's scope shouldn't eat another
    endpoint's quota, even for the same caller."""
    req = _FakeRequest(f"host-{uuid.uuid4()}")
    scope_a, scope_b = f"a-{uuid.uuid4()}", f"b-{uuid.uuid4()}"
    rate_limit.enforce(scope_a, req, 1, 60)
    with pytest.raises(HTTPException):
        rate_limit.enforce(scope_a, req, 1, 60)
    rate_limit.enforce(scope_b, req, 1, 60)  # different scope, still allowed
