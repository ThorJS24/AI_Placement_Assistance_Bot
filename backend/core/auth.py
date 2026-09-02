"""Real account login: hashed passwords + server-side session tokens.

Replaces the old "type any name, optionally a PIN" courtesy-separation
(core/storage.py's _resolve_student docstring has the history) with actual
authentication - a username is now a real, password-protected identity, and
every request's identity is verified server-side from a session cookie
(see main.py's session-enforcing middleware) rather than trusted from a
client-supplied header.

Deliberately stdlib-only (hashlib PBKDF2-HMAC-SHA256 + secrets), matching
this project's "no new dependency for something the standard library
already does well" pattern elsewhere (see core/code_judge.py, etc.) -
PBKDF2 with a high iteration count is a perfectly reasonable password hash
for this app's threat model (a local department tool, not a
internet-facing service handling millions of accounts where argon2/bcrypt's
extra memory-hardness would matter more).
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import time

from core import storage

SESSION_COOKIE = "session_token"
SESSION_TTL_SECS = 30 * 24 * 60 * 60  # 30 days - a shared department PC session shouldn't need re-login daily

_PBKDF2_ITERATIONS = 200_000
_USERNAME_RE = re.compile(r"^[a-zA-Z0-9._-]{3,30}$")


class AuthError(ValueError):
    """Raised for any user-facing auth failure (bad credentials, taken
    username, invalid format) - routers/auth.py turns these into 400/401s
    with the message as-is, since every message here is already written to
    be shown directly to the student."""


def validate_username(username: str) -> str:
    clean = (username or "").strip()
    if not _USERNAME_RE.match(clean):
        raise AuthError("Username must be 3-30 characters: letters, numbers, dots, underscores, or hyphens only.")
    return clean


def validate_password(password: str) -> str:
    if len(password or "") < 8:
        raise AuthError("Password must be at least 8 characters.")
    if len(password) > 200:
        raise AuthError("Password is too long.")
    return password


def hash_password(password: str) -> tuple[str, str]:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), _PBKDF2_ITERATIONS)
    return digest.hex(), salt


def verify_password(password: str, password_hash: str, salt: str) -> bool:
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), _PBKDF2_ITERATIONS)
    return hmac.compare_digest(digest.hex(), password_hash)


def signup(username: str, password: str) -> str:
    """Creates the account and an initial session. Returns the session token."""
    clean_username = validate_username(username)
    validate_password(password)
    password_hash, salt = hash_password(password)
    if not storage.create_account(clean_username, password_hash, salt):
        raise AuthError("That username is already taken - try logging in instead, or pick another one.")
    return create_session_for(clean_username)


def login(username: str, password: str) -> str:
    """Verifies credentials and returns a new session token."""
    clean_username = validate_username(username)
    account = storage.get_account(clean_username)
    # Constant-shape failure path (still run a hash) so a wrong-username
    # response isn't measurably faster than a wrong-password one.
    if account is None:
        hash_password(password)  # burn the same PBKDF2 cost as a real check
        raise AuthError("Incorrect username or password.")
    if not verify_password(password, account["password_hash"], account["salt"]):
        raise AuthError("Incorrect username or password.")
    return create_session_for(clean_username)


def create_session_for(username: str) -> str:
    token = secrets.token_urlsafe(32)
    storage.create_session(token, username, time.time() + SESSION_TTL_SECS)
    return token


def resolve_session(token: str | None) -> str | None:
    if not token:
        return None
    return storage.get_session_username(token)


def logout(token: str | None) -> None:
    if token:
        storage.delete_session(token)
