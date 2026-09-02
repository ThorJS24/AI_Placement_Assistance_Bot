"""Tests for core/auth.py - real account signup/login with hashed
passwords and server-side session tokens. Uses the `tmp_db` fixture (see
conftest.py) so nothing here ever touches the real storage/app.db."""
from __future__ import annotations

import pytest

from core import auth


def test_hash_password_round_trips():
    digest, salt = auth.hash_password("correct-horse")
    assert auth.verify_password("correct-horse", digest, salt) is True
    assert auth.verify_password("wrong-password", digest, salt) is False


def test_validate_username_accepts_valid_names():
    assert auth.validate_username("priya.k") == "priya.k"
    assert auth.validate_username("  bob_99  ") == "bob_99"
    assert auth.validate_username("a-b-c") == "a-b-c"


@pytest.mark.parametrize(
    "bad_username",
    [
        "ab",  # too short
        "a" * 31,  # too long
        "has a space",
        "has$symbol",
        "",
    ],
)
def test_validate_username_rejects_invalid_names(bad_username):
    with pytest.raises(auth.AuthError):
        auth.validate_username(bad_username)


def test_validate_password_rejects_short_passwords():
    with pytest.raises(auth.AuthError):
        auth.validate_password("short1")  # 7 chars


def test_validate_password_accepts_eight_chars():
    assert auth.validate_password("12345678") == "12345678"


def test_signup_then_login_round_trip(tmp_db):
    token = auth.signup("alice", "hunter22pw")
    assert token

    username = auth.resolve_session(token)
    assert username == "alice"

    login_token = auth.login("alice", "hunter22pw")
    assert login_token
    assert auth.resolve_session(login_token) == "alice"


def test_signup_duplicate_username_fails(tmp_db):
    auth.signup("bob", "hunter22pw")
    with pytest.raises(auth.AuthError):
        auth.signup("bob", "anotherpassword")


def test_login_wrong_password_raises(tmp_db):
    auth.signup("carol", "hunter22pw")
    with pytest.raises(auth.AuthError):
        auth.login("carol", "wrongpassword")


def test_login_unknown_username_raises(tmp_db):
    with pytest.raises(auth.AuthError):
        auth.login("nobody", "whatever123")


def test_resolve_session_bogus_or_missing_token(tmp_db):
    assert auth.resolve_session(None) is None
    assert auth.resolve_session("not-a-real-token") is None


def test_logout_invalidates_session(tmp_db):
    token = auth.signup("dave", "hunter22pw")
    assert auth.resolve_session(token) == "dave"
    auth.logout(token)
    assert auth.resolve_session(token) is None
