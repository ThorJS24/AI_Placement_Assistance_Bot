"""Shared pytest fixtures for the backend test suite.

`tmp_db` points storage at a fresh, throwaway SQLite file for the duration
of a test — tests never touch the real storage/app.db and never leak state
between each other. `client` builds a FastAPI TestClient on top of that; the
lifespan handler (see main.py) calls storage.init_db() on startup, which
creates the schema in the temp file rather than the real one, and the
question-bank JSON fixtures (see the question_bank fixture below) point at
throwaway copies so admin CRUD tests never touch the shipped question banks
in backend/data/.

Run with (from backend/, after `pip install -r requirements.txt -r
requirements-dev.txt`):
    pytest
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """core/rate_limit.py's `_hits` store is deliberately process-global and
    never reset in production (see that module's docstring) -- but that
    means it also persists *across test files* within a single pytest run,
    since every test hits the TestClient from the same fixed "testclient"
    IP. Enough admin-auth/account-auth calls across test_admin_questions.py,
    test_analytics.py, test_api_smoke.py, etc. within the same 60s window
    would otherwise start tripping 429s that have nothing to do with what
    each individual test is actually checking. Clearing it before each test
    keeps tests isolated from each other without changing the production
    behavior at all (test_rate_limit.py exercises the module directly with
    its own uuid-namespaced keys, so it doesn't need or want this reset)."""
    from core import rate_limit

    rate_limit._hits.clear()
    yield


@pytest.fixture
def tmp_db(monkeypatch):
    path = tempfile.mktemp(suffix=".db")
    monkeypatch.setattr(config, "DB_PATH", path)
    from core import storage

    storage.init_db()
    yield path
    if os.path.exists(path):
        os.remove(path)


@pytest.fixture
def question_bank(monkeypatch, tmp_path):
    """Copies the real DSA/quiz question banks into a throwaway temp
    directory and points config.DATA_DIR at it, so admin CRUD tests can
    freely create/edit/delete without ever touching the shipped files."""
    tmp_data_dir = tmp_path / "data"
    shutil.copytree(config.DATA_DIR, tmp_data_dir)
    monkeypatch.setattr(config, "DATA_DIR", tmp_data_dir)
    yield tmp_data_dir


@pytest.fixture
def client(tmp_db, question_bank):
    from fastapi.testclient import TestClient

    import main

    with TestClient(main.app) as c:
        yield c


def login_as(client, username: str, password: str = "testpass123") -> str:
    """Signs up (or logs in, if the account already exists in this test's
    tmp_db) as `username` on the given TestClient and returns the verified
    username. The session cookie set by /api/auth/signup or /api/auth/login
    is stored on the TestClient's cookie jar, so every subsequent request
    made with the same `client` is authenticated as this user — every
    non-exempt route now requires this (see main.py's
    enforce_session_identity middleware), replacing the old "just send an
    X-Student-Name header" model."""
    res = client.post("/api/auth/signup", json={"username": username, "password": password})
    if res.status_code != 200:
        res = client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["username"]


@pytest.fixture
def admin_headers():
    """The admin passcode is whatever's effective at request time (DB
    override, falling back to config.ADMIN_PASSCODE from .env) — see
    core/runtime_settings.py. Tests never change it, so config.ADMIN_PASSCODE
    (the .env-driven fallback) is always the effective one against a fresh
    tmp_db with no app_settings override row."""
    return {"X-Admin-Passcode": config.ADMIN_PASSCODE}
