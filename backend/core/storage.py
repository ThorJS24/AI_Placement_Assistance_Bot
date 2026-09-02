"""Lightweight local persistence layer, backed by SQLite (stdlib only).

Keeps the platform "durable": every chat, resume, roadmap and interview
session survives across app restarts with zero external database to
install or maintain. The file lives at storage/app.db.

Multi-student note: this app runs without login (see core/llm.py-style
docstrings elsewhere for the same philosophy — zero setup friction for a
department PC). To keep multiple students' histories from mixing together
on a shared machine, every write is tagged with a lightweight `student_name`
(a free-text display name the student picks once in the frontend, sent as
the `X-Student-Name` header — see api/client.js). Students can *optionally*
also set a short PIN (X-Student-Pin) the first time they use a name; if they
do, later requests using that exact name must present the matching PIN or
they get isolated into a separate bucket instead of silently landing on the
real owner's data (see `_resolve_student`). There is still no real identity
guarantee and no password — this is a courtesy separation for a shared lab
PC, not security in the enterprise sense.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
import time
from contextlib import contextmanager
from typing import Any, Iterator

import config

DEFAULT_STUDENT = "Guest"

_SCHEMA = """
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at REAL NOT NULL,
    updated_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT,
    target_role TEXT,
    payload_json TEXT NOT NULL,
    file_path TEXT,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS roadmaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_role TEXT,
    timeframe TEXT,
    payload_json TEXT NOT NULL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS interview_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,              -- 'mock' or 'technical'
    topic TEXT,
    summary_json TEXT,
    score REAL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS interview_qna (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT,
    feedback TEXT,
    is_correct INTEGER,
    created_at REAL NOT NULL,
    FOREIGN KEY(session_id) REFERENCES interview_sessions(id)
);

CREATE TABLE IF NOT EXISTS students (
    name TEXT PRIMARY KEY,
    pin TEXT,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
    student_name TEXT NOT NULL,
    question_id TEXT NOT NULL,
    created_at REAL NOT NULL,
    PRIMARY KEY (student_name, question_id)
);

CREATE TABLE IF NOT EXISTS accounts (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    created_at REAL NOT NULL,
    expires_at REAL NOT NULL
);

-- Live AI Interview: a lightweight structured event log for one session's
-- lifecycle (SESSION_CREATED, MIC_PERMISSION_GRANTED, AI_STARTED_SPEAKING,
-- AI_INTERRUPTED, TRANSCRIPT_FINAL, INTERVIEW_ENDED, EVALUATION_COMPLETED,
-- etc). Deliberately generic (event_type + a JSON metadata blob) instead of
-- dedicated columns per event kind, since the set of interesting events is
-- expected to grow and none of them need to be queried/filtered on beyond
-- "everything for this session, in order" (used for basic observability:
-- turn duration, interruption counts, debugging a weird session).
CREATE TABLE IF NOT EXISTS interview_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    at REAL NOT NULL,
    metadata_json TEXT,
    FOREIGN KEY(session_id) REFERENCES interview_sessions(id)
);
"""

# Columns added after the original schema shipped. Applied idempotently in
# init_db() via _ensure_column() so upgrading in place never breaks an
# existing storage/app.db (no destructive migrations, ever).
_NEW_COLUMNS = [
    ("chat_sessions", "student_name", f"student_name TEXT NOT NULL DEFAULT '{DEFAULT_STUDENT}'"),
    ("chat_messages", "feedback", "feedback TEXT"),  # 'up' | 'down' | NULL
    ("resumes", "student_name", f"student_name TEXT NOT NULL DEFAULT '{DEFAULT_STUDENT}'"),
    ("roadmaps", "student_name", f"student_name TEXT NOT NULL DEFAULT '{DEFAULT_STUDENT}'"),
    ("interview_sessions", "student_name", f"student_name TEXT NOT NULL DEFAULT '{DEFAULT_STUDENT}'"),
    ("interview_qna", "topic", "topic TEXT"),
    ("interview_qna", "difficulty", "difficulty TEXT"),
    ("interview_qna", "round_type", "round_type TEXT"),  # 'dsa' | 'quiz' | 'contest'
    ("students", "stream", "stream TEXT"),                  # e.g. "Computer Science and Engineering"
    ("students", "specialization", "specialization TEXT"),  # e.g. "AI & ML", "Data Science" — optional honours track
    ("students", "semester", "semester TEXT"),               # free text/number — programs vary in length
    ("students", "subjects", "subjects TEXT"),                # JSON list of this semester's subjects
    ("students", "updated_at", "updated_at REAL"),
    ("students", "preferences", "preferences TEXT"),          # JSON blob — see the preferences section below
    # Live AI Interview additive columns on the existing interview_sessions
    # table (kind='live') — session config, server-enforced timing, and
    # which evaluation rubric was used. No parallel/duplicate session table:
    # this reuses the exact same table + finish_interview_session()
    # summary_json/score mechanism the existing mock interview report
    # already relies on (see finish_interview_session below).
    ("interview_sessions", "config_json", "config_json TEXT"),      # role/type/difficulty/style/duration requested at creation
    ("interview_sessions", "expires_at", "expires_at REAL"),        # server-enforced hard deadline (created_at + max duration)
    ("interview_sessions", "last_activity_at", "last_activity_at REAL"),  # bumped on every WS message; drives idle timeout
    ("interview_sessions", "ended_at", "ended_at REAL"),
    ("interview_sessions", "rubric", "rubric TEXT"),                 # which evaluation rubric was applied (technical|hr|behavioral)
    ("interview_qna", "speaker", "speaker TEXT"),          # 'ai' | 'candidate' — live sessions log every turn, not just Q+A pairs
    ("interview_qna", "seq", "seq INTEGER"),               # ordering within a session, independent of the autoincrement id
]

_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_chat_sessions_student ON chat_sessions(student_name, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_resumes_student ON resumes(student_name, id DESC);
CREATE INDEX IF NOT EXISTS idx_roadmaps_student ON roadmaps(student_name, id DESC);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_student_kind ON interview_sessions(student_name, kind, id DESC);
CREATE INDEX IF NOT EXISTS idx_interview_qna_session ON interview_qna(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_qna_topic ON interview_qna(topic);
CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_interview_events_session ON interview_events(session_id, id);
"""


@contextmanager
def _conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    existing = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db() -> None:
    with _conn() as conn:
        # WAL mode lets reads proceed concurrently with a write (instead of
        # the default rollback-journal mode's exclusive write lock) and is
        # more crash-resilient — standard hardening for a local single-file
        # SQLite app with multiple students' requests landing concurrently.
        # synchronous=NORMAL is the recommended pairing with WAL: still
        # durable against app/OS crashes, just not against a full power-loss
        # mid-write on rare/unusual filesystems, a fine trade for a local
        # department PC. Both are persisted in the db file itself, so this
        # only needs to run once per process, not once per connection.
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.executescript(_SCHEMA)
        for table, column, ddl in _NEW_COLUMNS:
            _ensure_column(conn, table, column, ddl)
        conn.executescript(_INDEXES)


def _norm_student(student_name: str | None) -> str:
    name = (student_name or "").strip()[:60]
    return name or DEFAULT_STUDENT


def _resolve_student(student_name: str | None, pin: str | None = None) -> str:
    """Normalizes the display name and, if that name has an optional PIN
    registered, enforces it.

    This is a lightweight convenience lock, not real authentication — no
    login, a short plaintext PIN, one shared department PC. Its only job is
    to stop one student silently landing on another student's saved history
    just because they typed the same common first name.

    A name used without ever setting a PIN stays fully open (identical to
    the original zero-friction behaviour). The FIRST request that supplies a
    PIN for a given name registers it. A later request with the right name
    but the wrong (or missing) PIN is never merged into the real owner's
    data — it's isolated into its own deterministic bucket instead, so a
    name collision fails safe rather than leaking history.
    """
    name = _norm_student(student_name)
    if name == DEFAULT_STUDENT:
        return name
    clean_pin = (pin or "").strip()[:8]
    with _conn() as conn:
        row = conn.execute("SELECT pin FROM students WHERE name = ?", (name,)).fetchone()
        if row is None:
            if clean_pin:
                conn.execute(
                    "INSERT INTO students (name, pin, created_at) VALUES (?, ?, ?)",
                    (name, clean_pin, time.time()),
                )
            return name
        stored_pin = row["pin"] or ""
        if not stored_pin or stored_pin == clean_pin:
            return name
    bucket = hashlib.sha1(clean_pin.encode()).hexdigest()[:6]
    return f"{name}#locked-{bucket}"


# ---------------------------------------------------------------------------
# Student academic profile — department/college identity is a single
# app-wide setting (config.COLLEGE_NAME / DEPARTMENT_NAME, set once in
# .env), but stream, specialization, semester and current subjects vary per
# student and change over time, so they live here per name/PIN identity.
# Used to personalize the chatbot's system prompt and to pre-fill the
# Roadmap Generator; also surfaced read-only on the admin dashboard.
# ---------------------------------------------------------------------------

def _empty_profile() -> dict[str, Any]:
    return {"stream": "", "specialization": "", "semester": "", "subjects": [], "has_pin": False}


def save_student_profile(
    student_name: str | None, pin: str | None = None,
    stream: str | None = None, specialization: str | None = None,
    semester: str | None = None, subjects: list[str] | None = None,
) -> str:
    """Upserts the profile row for this identity. Always creates a `students`
    row if one doesn't exist yet (unlike the old pin-only lazy-insert), so a
    student who never sets a PIN can still save their academic profile."""
    name = _resolve_student(student_name, pin)
    if name == DEFAULT_STUDENT:
        return name
    clean_subjects = json.dumps([s.strip()[:60] for s in (subjects or []) if s.strip()][:30])
    now = time.time()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO students (name, pin, stream, specialization, semester, subjects, created_at, updated_at) "
            "VALUES (?, (SELECT pin FROM students WHERE name = ?), ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(name) DO UPDATE SET "
            "stream = excluded.stream, specialization = excluded.specialization, "
            "semester = excluded.semester, subjects = excluded.subjects, updated_at = excluded.updated_at",
            (name, name, stream, specialization, semester, clean_subjects, now, now),
        )
    return name


def get_student_profile(student_name: str | None, pin: str | None = None) -> dict[str, Any]:
    name = _resolve_student(student_name, pin)
    if name == DEFAULT_STUDENT:
        return _empty_profile()
    with _conn() as conn:
        row = conn.execute(
            "SELECT stream, specialization, semester, subjects, pin FROM students WHERE name = ?", (name,)
        ).fetchone()
    if row is None:
        return _empty_profile()
    try:
        subjects = json.loads(row["subjects"]) if row["subjects"] else []
    except (TypeError, ValueError):
        subjects = []
    return {
        "stream": row["stream"] or "",
        "specialization": row["specialization"] or "",
        "semester": row["semester"] or "",
        "subjects": subjects,
        "has_pin": bool(row["pin"]),
    }


# ---------------------------------------------------------------------------
# Per-student UI preferences — color theme, dark/light, font size, density,
# sidebar layout. Applied instantly client-side via localStorage (see
# frontend/src/lib/preferences.js) so there's never a wait for a network
# round-trip; persisted here as well so the same look follows a student to
# another device/browser once they've set a name (and optionally a PIN),
# mirroring the academic profile above. Stored as one JSON blob rather than
# dedicated columns since it's purely cosmetic, client-owned state — no
# server-side logic ever reads individual fields.
# ---------------------------------------------------------------------------

DEFAULT_PREFERENCES: dict[str, Any] = {
    "color_theme": "default",
    "dark_mode": "light",
    "font_size": "md",
    "density": "comfortable",
    "sidebar_collapsed": False,
}


def get_student_preferences(student_name: str | None, pin: str | None = None) -> dict[str, Any]:
    name = _resolve_student(student_name, pin)
    if name == DEFAULT_STUDENT:
        return dict(DEFAULT_PREFERENCES)
    with _conn() as conn:
        row = conn.execute("SELECT preferences FROM students WHERE name = ?", (name,)).fetchone()
    if row is None or not row["preferences"]:
        return dict(DEFAULT_PREFERENCES)
    try:
        saved = json.loads(row["preferences"])
        if not isinstance(saved, dict):
            saved = {}
    except (TypeError, ValueError):
        saved = {}
    return {**DEFAULT_PREFERENCES, **saved}


def save_student_preferences(student_name: str | None, pin: str | None, updates: dict[str, Any]) -> dict[str, Any]:
    """Partial update — only keys present (and non-None) in `updates` are
    changed; everything else the student previously saved is left as-is.
    Guests (no name set yet) aren't persisted server-side, same as the
    academic profile above — the frontend still applies the choice
    instantly via localStorage regardless."""
    name = _resolve_student(student_name, pin)
    clean_updates = {k: v for k, v in updates.items() if v is not None and k in DEFAULT_PREFERENCES}
    if name == DEFAULT_STUDENT:
        return {**DEFAULT_PREFERENCES, **clean_updates}
    current = get_student_preferences(student_name, pin)
    merged = {**current, **clean_updates}
    now = time.time()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO students (name, pin, preferences, created_at, updated_at) "
            "VALUES (?, (SELECT pin FROM students WHERE name = ?), ?, ?, ?) "
            "ON CONFLICT(name) DO UPDATE SET preferences = excluded.preferences, updated_at = excluded.updated_at",
            (name, name, json.dumps(merged), now, now),
        )
    return merged


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

def save_chat_message(session_id: str, role: str, content: str) -> int:
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
            (session_id, role, content, time.time()),
        )
        return cur.lastrowid


def load_chat_history(session_id: str, limit: int = 200) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, role, content, created_at, feedback FROM chat_messages "
            "WHERE session_id = ? ORDER BY id ASC LIMIT ?",
            (session_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def set_chat_message_feedback(message_id: int, feedback: str | None) -> None:
    clean = feedback if feedback in ("up", "down") else None
    with _conn() as conn:
        conn.execute("UPDATE chat_messages SET feedback = ? WHERE id = ?", (clean, message_id))


def _make_chat_title(message: str) -> str:
    text = " ".join(message.split())
    if not text:
        return "New chat"
    return (text[:48] + "…") if len(text) > 48 else text


def touch_chat_session(
    session_id: str, first_message: str | None = None, student_name: str | None = None, pin: str | None = None
) -> None:
    """Creates the session row on first use (with a title derived from the
    first message, like ChatGPT does) or just bumps updated_at on repeat use."""
    now = time.time()
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        row = conn.execute("SELECT id FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
        if row is None:
            title = _make_chat_title(first_message) if first_message else "New chat"
            conn.execute(
                "INSERT INTO chat_sessions (id, title, created_at, updated_at, student_name) VALUES (?, ?, ?, ?, ?)",
                (session_id, title, now, now, student),
            )
        else:
            conn.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, session_id))


def list_chat_sessions(student_name: str | None = None, pin: str | None = None, limit: int = 200) -> list[dict]:
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        rows = conn.execute(
            "SELECT s.id, s.title, s.created_at, s.updated_at, "
            "(SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) AS message_count "
            "FROM chat_sessions s WHERE s.student_name = ? ORDER BY s.updated_at DESC LIMIT ?",
            (student, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def rename_chat_session(
    session_id: str, title: str, student_name: str | None = None, pin: str | None = None
) -> None:
    clean = title.strip()[:80] or "New chat"
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        row = conn.execute("SELECT student_name FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
        if row is None:
            conn.execute(
                "INSERT INTO chat_sessions (id, title, created_at, updated_at, student_name) VALUES (?, ?, ?, ?, ?)",
                (session_id, clean, time.time(), time.time(), student),
            )
        elif row["student_name"] == student:
            conn.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (clean, session_id))


def delete_chat_session(session_id: str, student_name: str | None = None, pin: str | None = None) -> None:
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        row = conn.execute("SELECT student_name FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
        if row is None or row["student_name"] != student:
            return
        conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))


# ---------------------------------------------------------------------------
# Resumes
# ---------------------------------------------------------------------------

def save_resume(
    full_name: str, target_role: str, payload: dict, file_path: str | None,
    student_name: str | None = None, pin: str | None = None,
) -> int:
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO resumes (full_name, target_role, payload_json, file_path, created_at, student_name) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (full_name, target_role, json.dumps(payload), file_path, time.time(), student),
        )
        return cur.lastrowid


def list_resumes(student_name: str | None = None, pin: str | None = None, limit: int = 50) -> list[dict]:
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, full_name, target_role, file_path, created_at FROM resumes "
            "WHERE student_name = ? ORDER BY id DESC LIMIT ?",
            (student, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def get_resume(resume_id: int, student_name: str | None = None, pin: str | None = None) -> dict | None:
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        row = conn.execute(
            "SELECT id, full_name, target_role, payload_json, file_path, created_at FROM resumes "
            "WHERE id = ? AND student_name = ?",
            (resume_id, student),
        ).fetchone()
    if row is None:
        return None
    data = dict(row)
    data["payload"] = json.loads(data.pop("payload_json"))
    return data


def delete_resume(resume_id: int, student_name: str | None = None, pin: str | None = None) -> None:
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        conn.execute("DELETE FROM resumes WHERE id = ? AND student_name = ?", (resume_id, student))


# ---------------------------------------------------------------------------
# Roadmaps
# ---------------------------------------------------------------------------

def save_roadmap(
    target_role: str, timeframe: str, payload: dict,
    student_name: str | None = None, pin: str | None = None,
) -> int:
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO roadmaps (target_role, timeframe, payload_json, created_at, student_name) VALUES (?, ?, ?, ?, ?)",
            (target_role, timeframe, json.dumps(payload), time.time(), student),
        )
        return cur.lastrowid


def list_roadmaps(student_name: str | None = None, pin: str | None = None, limit: int = 50) -> list[dict]:
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, target_role, timeframe, created_at FROM roadmaps "
            "WHERE student_name = ? ORDER BY id DESC LIMIT ?",
            (student, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def get_roadmap(roadmap_id: int, student_name: str | None = None, pin: str | None = None) -> dict | None:
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        row = conn.execute(
            "SELECT id, target_role, timeframe, payload_json, created_at FROM roadmaps WHERE id = ? AND student_name = ?",
            (roadmap_id, student),
        ).fetchone()
    if row is None:
        return None
    data = dict(row)
    data["payload"] = json.loads(data.pop("payload_json"))
    return data


# ---------------------------------------------------------------------------
# Interviews (mock speech + technical, including DSA contest mode)
# ---------------------------------------------------------------------------

def create_interview_session(
    kind: str, topic: str, student_name: str | None = None, pin: str | None = None
) -> int:
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO interview_sessions (kind, topic, created_at, student_name) VALUES (?, ?, ?, ?)",
            (kind, topic, time.time(), student),
        )
        return cur.lastrowid


def finish_interview_session(session_id: int, summary: dict, score: float) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE interview_sessions SET summary_json = ?, score = ? WHERE id = ?",
            (json.dumps(summary), score, session_id),
        )


def log_qna(
    session_id: int,
    question: str,
    answer: str,
    feedback: str,
    is_correct: bool | None,
    topic: str | None = None,
    difficulty: str | None = None,
    round_type: str | None = None,
) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO interview_qna (session_id, question, answer, feedback, is_correct, created_at, topic, difficulty, round_type) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                session_id, question, answer, feedback,
                None if is_correct is None else int(is_correct),
                time.time(), topic, difficulty, round_type,
            ),
        )


def resolve_student_name(student_name: str | None, pin: str | None = None) -> str:
    """Public wrapper around _resolve_student — used where a caller needs
    the resolved identity string itself (e.g. a pre-flight concurrency
    check) rather than performing a write scoped to it."""
    return _resolve_student(student_name, pin)


def create_live_interview_session(
    topic: str, config: dict, student_name: str | None = None, pin: str | None = None,
    max_duration_secs: int = 1800,
) -> int:
    """Like create_interview_session, but kind='live' and additionally
    records the requested config (role/type/difficulty/style/duration) and a
    server-enforced expiry timestamp — the WS endpoint is the sole enforcer
    of both; nothing client-sent about duration/config is ever trusted for
    the final evaluation."""
    student = _resolve_student(student_name, pin)
    now = time.time()
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO interview_sessions (kind, topic, created_at, student_name, config_json, expires_at, last_activity_at) "
            "VALUES ('live', ?, ?, ?, ?, ?, ?)",
            (topic, now, student, json.dumps(config), now + max_duration_secs, now),
        )
        return cur.lastrowid


def get_interview_session(session_id: int) -> dict | None:
    """Raw fetch by id, no student scoping — callers (the WS endpoint, the
    owner-only GET endpoint) are responsible for checking student_name
    themselves against the authenticated identity."""
    with _conn() as conn:
        row = conn.execute("SELECT * FROM interview_sessions WHERE id = ?", (session_id,)).fetchone()
    if row is None:
        return None
    d = dict(row)
    for key in ("summary_json", "config_json"):
        if d.get(key):
            try:
                d[key.replace("_json", "")] = json.loads(d[key])
            except (TypeError, ValueError):
                d[key.replace("_json", "")] = None
        else:
            d[key.replace("_json", "")] = None
    return d


def touch_session_activity(session_id: int) -> None:
    with _conn() as conn:
        conn.execute("UPDATE interview_sessions SET last_activity_at = ? WHERE id = ?", (time.time(), session_id))


def end_live_interview_session(session_id: int) -> None:
    with _conn() as conn:
        conn.execute("UPDATE interview_sessions SET ended_at = ? WHERE id = ?", (time.time(), session_id))


def count_active_live_sessions(student_name: str) -> int:
    """A live session counts as 'active' until it has an ended_at OR its
    server-enforced expiry has passed — used to enforce
    config.LIVE_INTERVIEW_MAX_CONCURRENT_PER_STUDENT at session-creation
    time."""
    now = time.time()
    with _conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) c FROM interview_sessions "
            "WHERE kind = 'live' AND student_name = ? AND ended_at IS NULL AND (expires_at IS NULL OR expires_at > ?)",
            (student_name, now),
        ).fetchone()
    return row["c"]


def log_event(session_id: int, event_type: str, metadata: dict | None = None) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO interview_events (session_id, event_type, at, metadata_json) VALUES (?, ?, ?, ?)",
            (session_id, event_type, time.time(), json.dumps(metadata) if metadata else None),
        )


def list_events(session_id: int) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT event_type, at, metadata_json FROM interview_events WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        try:
            d["metadata"] = json.loads(d.pop("metadata_json")) if d.get("metadata_json") else None
        except (TypeError, ValueError):
            d["metadata"] = None
            d.pop("metadata_json", None)
        out.append(d)
    return out


def log_turn(session_id: int, speaker: str, text: str, seq: int) -> None:
    """Per-message speaker+content+seq log for the live interview transcript
    — reuses the existing interview_qna table (question column holds the
    text, speaker/seq are the additive columns above) rather than a
    duplicate parallel table, since the shape (one row per utterance, tied
    to a session) already fits."""
    with _conn() as conn:
        conn.execute(
            "INSERT INTO interview_qna (session_id, question, answer, feedback, is_correct, created_at, speaker, seq) "
            "VALUES (?, ?, '', '', NULL, ?, ?, ?)",
            (session_id, text, time.time(), speaker, seq),
        )


def list_turns(session_id: int) -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT speaker, question AS text, created_at, seq FROM interview_qna "
            "WHERE session_id = ? AND speaker IS NOT NULL ORDER BY seq ASC, id ASC",
            (session_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def list_interview_sessions(
    kind: str | None = None, student_name: str | None = None, pin: str | None = None, limit: int = 50
) -> list[dict]:
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        if kind:
            rows = conn.execute(
                "SELECT * FROM interview_sessions WHERE kind = ? AND student_name = ? ORDER BY id DESC LIMIT ?",
                (kind, student, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM interview_sessions WHERE student_name = ? ORDER BY id DESC LIMIT ?",
                (student, limit),
            ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        if d.get("summary_json"):
            try:
                d["summary"] = json.loads(d["summary_json"])
            except (TypeError, ValueError):
                d["summary"] = None
        else:
            d["summary"] = None
        del d["summary_json"]
        out.append(d)
    return out


def technical_stats(student_name: str | None = None, pin: str | None = None) -> dict[str, Any]:
    """Aggregate solve-rate stats for the Technical Interview personal
    dashboard: overall, broken down by topic and by difficulty, plus a
    recent timeline for a simple trend view. Only counts qna rows that
    have a recorded correctness value (is_correct IS NOT NULL)."""
    student = _resolve_student(student_name, pin)
    with _conn() as conn:
        rows = conn.execute(
            "SELECT q.topic, q.difficulty, q.round_type, q.is_correct, q.created_at "
            "FROM interview_qna q "
            "JOIN interview_sessions s ON s.id = q.session_id "
            "WHERE s.student_name = ? AND s.kind = 'technical' AND q.is_correct IS NOT NULL "
            "ORDER BY q.id ASC",
            (student,),
        ).fetchall()

    def _bucket() -> dict[str, int]:
        return {"total": 0, "correct": 0}

    by_topic: dict[str, dict[str, int]] = {}
    by_difficulty: dict[str, dict[str, int]] = {}
    by_round: dict[str, dict[str, int]] = {}
    overall = _bucket()
    recent: list[dict[str, Any]] = []

    for r in rows:
        overall["total"] += 1
        overall["correct"] += r["is_correct"]

        topic = r["topic"] or "Uncategorized"
        by_topic.setdefault(topic, _bucket())
        by_topic[topic]["total"] += 1
        by_topic[topic]["correct"] += r["is_correct"]

        diff = r["difficulty"] or "Unspecified"
        by_difficulty.setdefault(diff, _bucket())
        by_difficulty[diff]["total"] += 1
        by_difficulty[diff]["correct"] += r["is_correct"]

        rt = r["round_type"] or "other"
        by_round.setdefault(rt, _bucket())
        by_round[rt]["total"] += 1
        by_round[rt]["correct"] += r["is_correct"]

        recent.append({
            "topic": topic, "difficulty": diff, "round_type": rt,
            "correct": bool(r["is_correct"]), "created_at": r["created_at"],
        })

    def _with_rate(buckets: dict[str, dict[str, int]]) -> list[dict[str, Any]]:
        out = []
        for name, b in sorted(buckets.items(), key=lambda kv: -kv[1]["total"]):
            rate = round(100 * b["correct"] / b["total"]) if b["total"] else 0
            out.append({"name": name, "total": b["total"], "correct": b["correct"], "solve_rate": rate})
        return out

    overall_rate = round(100 * overall["correct"] / overall["total"]) if overall["total"] else 0

    return {
        "overall": {"total": overall["total"], "correct": overall["correct"], "solve_rate": overall_rate},
        "by_topic": _with_rate(by_topic),
        "by_difficulty": _with_rate(by_difficulty),
        "by_round_type": _with_rate(by_round),
        "recent": recent[-30:],
    }


def leaderboard(limit: int = 10) -> list[dict[str, Any]]:
    """Department-wide DSA leaderboard (solved count + accuracy), ranked by
    solves then accuracy. Intentionally unscoped, like dashboard_counts — a
    whole-department motivator, not a personal record. Excludes Guest, since
    that bucket usually mixes many different people on a shared PC."""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT s.student_name AS name, COUNT(*) AS attempts, SUM(q.is_correct) AS solved "
            "FROM interview_qna q JOIN interview_sessions s ON s.id = q.session_id "
            "WHERE s.kind = 'technical' AND q.round_type IN ('dsa', 'contest') "
            "AND q.is_correct IS NOT NULL AND s.student_name != ? "
            "GROUP BY s.student_name HAVING solved > 0 "
            "ORDER BY solved DESC, (1.0 * solved / attempts) DESC LIMIT ?",
            (DEFAULT_STUDENT, limit),
        ).fetchall()
    out = []
    for r in rows:
        accuracy = round(100 * r["solved"] / r["attempts"]) if r["attempts"] else 0
        out.append({"name": r["name"], "solved": r["solved"], "attempts": r["attempts"], "accuracy": accuracy})
    return out


# ---------------------------------------------------------------------------
# Dashboard (department-wide) + admin/TPO overview
# ---------------------------------------------------------------------------

def dashboard_counts() -> dict[str, int]:
    """Department-wide totals across all students (intentionally NOT scoped
    to one student_name) — this is the "whole department" vanity metric
    shown on the Home page. Personal history lives inside each module."""
    with _conn() as conn:
        chats = conn.execute("SELECT COUNT(*) c FROM chat_sessions").fetchone()["c"]
        resumes = conn.execute("SELECT COUNT(*) c FROM resumes").fetchone()["c"]
        roadmaps = conn.execute("SELECT COUNT(*) c FROM roadmaps").fetchone()["c"]
        mocks = conn.execute("SELECT COUNT(*) c FROM interview_sessions WHERE kind='mock'").fetchone()["c"]
        tech = conn.execute("SELECT COUNT(*) c FROM interview_sessions WHERE kind='technical'").fetchone()["c"]
    return {
        "chat_sessions": chats,
        "resumes_built": resumes,
        "roadmaps_generated": roadmaps,
        "mock_interviews": mocks,
        "technical_interviews": tech,
    }


def _list_known_students(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        "SELECT DISTINCT student_name AS name FROM ("
        "  SELECT student_name FROM chat_sessions "
        "  UNION SELECT student_name FROM resumes "
        "  UNION SELECT student_name FROM roadmaps "
        "  UNION SELECT student_name FROM interview_sessions"
        ") WHERE name != ?",
        (DEFAULT_STUDENT,),
    ).fetchall()
    return sorted(r["name"] for r in rows)


def admin_overview() -> list[dict[str, Any]]:
    """Per-student readiness snapshot for the TPO/admin dashboard.

    Readiness is a simple, fully transparent heuristic (not a hidden score):
      green  - has at least one saved resume AND technical (DSA/quiz) solve
               rate >= 60% AND at least one mock interview scored >= 60
      amber  - some real activity on the platform, but short of the green bar
      red    - no meaningful activity recorded yet
    This intentionally queries the raw student_name values in storage
    (bypassing the PIN lock) — the admin view is already gated by a separate
    admin passcode and needs to see everyone, including PIN-mismatched
    buckets, to get an accurate department picture.
    """
    with _conn() as conn:
        names = _list_known_students(conn)
        out = []
        for name in names:
            resumes_count = conn.execute(
                "SELECT COUNT(*) c FROM resumes WHERE student_name=?", (name,)
            ).fetchone()["c"]
            roadmaps_count = conn.execute(
                "SELECT COUNT(*) c FROM roadmaps WHERE student_name=?", (name,)
            ).fetchone()["c"]
            mock_rows = conn.execute(
                "SELECT score FROM interview_sessions WHERE student_name=? AND kind='mock' AND score IS NOT NULL",
                (name,),
            ).fetchall()
            mock_count = len(mock_rows)
            mock_avg = round(sum(r["score"] for r in mock_rows) / mock_count, 1) if mock_count else None

            tech_rows = conn.execute(
                "SELECT q.is_correct FROM interview_qna q JOIN interview_sessions s ON s.id = q.session_id "
                "WHERE s.student_name=? AND s.kind='technical' AND q.is_correct IS NOT NULL",
                (name,),
            ).fetchall()
            tech_total = len(tech_rows)
            tech_correct = sum(r["is_correct"] for r in tech_rows)
            tech_rate = round(100 * tech_correct / tech_total) if tech_total else 0

            last_active_values = []
            for table, col in (("chat_sessions", "updated_at"), ("resumes", "created_at"),
                                ("roadmaps", "created_at"), ("interview_sessions", "created_at")):
                m = conn.execute(
                    f"SELECT MAX({col}) m FROM {table} WHERE student_name=?", (name,)
                ).fetchone()["m"]
                if m:
                    last_active_values.append(m)
            last_active = max(last_active_values) if last_active_values else None

            summary_rows = conn.execute(
                "SELECT summary_json FROM interview_sessions WHERE student_name=? AND summary_json IS NOT NULL",
                (name,),
            ).fetchall()
            violations_count = 0
            for srow in summary_rows:
                try:
                    summary = json.loads(srow["summary_json"])
                    violations_count += len(summary.get("violations") or [])
                except (TypeError, ValueError, AttributeError):
                    continue

            has_activity = bool(resumes_count or roadmaps_count or tech_total or mock_count)
            is_green = resumes_count >= 1 and tech_rate >= 60 and (mock_avg is not None and mock_avg >= 60)
            readiness = "green" if is_green else ("amber" if has_activity else "red")

            profile_row = conn.execute(
                "SELECT stream, specialization, semester FROM students WHERE name = ?", (name,)
            ).fetchone()

            out.append({
                "name": name,
                "last_active": last_active,
                "resumes_count": resumes_count,
                "roadmaps_count": roadmaps_count,
                "technical": {"total": tech_total, "correct": tech_correct, "solve_rate": tech_rate},
                "mock": {"count": mock_count, "avg_score": mock_avg},
                "readiness": readiness,
                "violations_count": violations_count,
                "stream": (profile_row["stream"] if profile_row else "") or "",
                "specialization": (profile_row["specialization"] if profile_row else "") or "",
                "semester": (profile_row["semester"] if profile_row else "") or "",
            })
    out.sort(key=lambda r: (r["last_active"] or 0), reverse=True)
    return out


def _trailing_day_list(days: int) -> list[str]:
    """ISO date strings for the last `days` days including today, oldest
    first — the shared x-axis for every trend endpoint below. Days with no
    recorded activity still appear (with zero counts), so a chart never
    silently skips a quiet day."""
    import datetime as _dt

    today = _dt.date.today()
    return [(today - _dt.timedelta(days=i)).isoformat() for i in range(days - 1, -1, -1)]


def activity_trend(days: int = 14) -> list[dict[str, Any]]:
    """Daily counts of new activity per module for the admin dashboard's
    trend chart — same five counters as dashboard_counts(), but bucketed by
    day instead of all-time totals."""
    days = max(1, min(days, 90))
    day_list = _trailing_day_list(days)
    since_modifier = f"-{days - 1} days"

    def _daily(conn: sqlite3.Connection, table: str, extra_where: str = "") -> dict[str, int]:
        rows = conn.execute(
            f"SELECT date(created_at, 'unixepoch') AS d, COUNT(*) AS c FROM {table} "
            f"WHERE date(created_at, 'unixepoch') >= date('now', ?) {extra_where} GROUP BY d",
            (since_modifier,),
        ).fetchall()
        return {r["d"]: r["c"] for r in rows}

    with _conn() as conn:
        chats = _daily(conn, "chat_sessions")
        resumes = _daily(conn, "resumes")
        roadmaps = _daily(conn, "roadmaps")
        mocks = _daily(conn, "interview_sessions", "AND kind = 'mock'")
        tech = _daily(conn, "interview_sessions", "AND kind = 'technical'")

    return [
        {
            "date": d,
            "chat_sessions": chats.get(d, 0),
            "resumes": resumes.get(d, 0),
            "roadmaps": roadmaps.get(d, 0),
            "mock_interviews": mocks.get(d, 0),
            "technical_interviews": tech.get(d, 0),
        }
        for d in day_list
    ]


def solve_rate_trend(days: int = 14) -> list[dict[str, Any]]:
    """Daily technical-interview solve rate (DSA + quiz + contest combined)
    over the last `days` days — lets the TPO see whether the cohort is
    trending up or down, not just where it stands today. `solve_rate` is
    None (not 0) on a day with zero graded attempts, so the frontend chart
    can distinguish "no data" from "0% solved"."""
    days = max(1, min(days, 90))
    day_list = _trailing_day_list(days)
    since_modifier = f"-{days - 1} days"

    with _conn() as conn:
        rows = conn.execute(
            "SELECT date(q.created_at, 'unixepoch') AS d, COUNT(*) AS total, SUM(q.is_correct) AS correct "
            "FROM interview_qna q JOIN interview_sessions s ON s.id = q.session_id "
            "WHERE s.kind = 'technical' AND q.is_correct IS NOT NULL "
            "AND date(q.created_at, 'unixepoch') >= date('now', ?) "
            "GROUP BY d",
            (since_modifier,),
        ).fetchall()

    by_day = {r["d"]: (r["total"], r["correct"] or 0) for r in rows}
    out = []
    for d in day_list:
        total, correct = by_day.get(d, (0, 0))
        rate = round(100 * correct / total) if total else None
        out.append({"date": d, "total": total, "correct": correct, "solve_rate": rate})
    return out


def readiness_distribution() -> dict[str, int]:
    """Counts of students in each readiness bucket (green/amber/red) — a
    quick department-wide summary, derived from the same heuristic
    admin_overview() already computes per student."""
    counts = {"green": 0, "amber": 0, "red": 0}
    for s in admin_overview():
        counts[s["readiness"]] = counts.get(s["readiness"], 0) + 1
    return counts


# ---------------------------------------------------------------------------
# App-wide runtime settings (branding, admin passcode, AI engine preference,
# TTS voice) — a simple key/value override store so these can be changed
# from the Settings UI and take effect immediately, without hand-editing
# .env and restarting the process. Anything NOT overridden here still falls
# back to its .env/config.py default (see core/runtime_settings.py), so a
# fresh install with no overrides behaves exactly as before.
# ---------------------------------------------------------------------------

def get_app_setting(key: str) -> str | None:
    with _conn() as conn:
        row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row is not None else None


def get_app_settings(keys: list[str]) -> dict[str, str]:
    """Bulk read — one query instead of N, used by the Settings status endpoint."""
    if not keys:
        return {}
    placeholders = ",".join("?" for _ in keys)
    with _conn() as conn:
        rows = conn.execute(
            f"SELECT key, value FROM app_settings WHERE key IN ({placeholders})", keys
        ).fetchall()
    return {r["key"]: r["value"] for r in rows}


def set_app_setting(key: str, value: str) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            (key, value, time.time()),
        )


# ---------------------------------------------------------------------------
# DSA question bookmarks — "come back to this one later", scoped per student
# like everything else in this file (resolved through the same PIN-aware
# identity as resumes/roadmaps/interviews).
# ---------------------------------------------------------------------------

def add_bookmark(student_name: str | None, pin: str | None, question_id: str) -> None:
    name = _resolve_student(student_name, pin)
    with _conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO bookmarks (student_name, question_id, created_at) VALUES (?, ?, ?)",
            (name, question_id, time.time()),
        )


def remove_bookmark(student_name: str | None, pin: str | None, question_id: str) -> None:
    name = _resolve_student(student_name, pin)
    with _conn() as conn:
        conn.execute(
            "DELETE FROM bookmarks WHERE student_name = ? AND question_id = ?", (name, question_id)
        )


def list_bookmark_ids(student_name: str | None, pin: str | None) -> list[str]:
    name = _resolve_student(student_name, pin)
    with _conn() as conn:
        rows = conn.execute(
            "SELECT question_id FROM bookmarks WHERE student_name = ? ORDER BY created_at DESC", (name,)
        ).fetchall()
    return [r["question_id"] for r in rows]


# ---------------------------------------------------------------------------
# Accounts + sessions — real login (see core/auth.py for password hashing
# and token generation; this file only owns persistence, matching every
# other section here). A logged-in account's `username` IS the
# `student_name` used everywhere else in this file — no migration needed,
# every existing history table keeps working completely unchanged, and the
# old PIN "courtesy lock" (_resolve_student above) simply stops mattering
# once a real password gates who can claim that name in the first place.
# ---------------------------------------------------------------------------

def create_account(username: str, password_hash: str, salt: str) -> bool:
    """Returns False (no-op) if the username is already taken."""
    with _conn() as conn:
        try:
            conn.execute(
                "INSERT INTO accounts (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)",
                (username, password_hash, salt, time.time()),
            )
        except sqlite3.IntegrityError:
            return False
    return True


def get_account(username: str) -> dict[str, Any] | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT username, password_hash, salt FROM accounts WHERE username = ?", (username,)
        ).fetchone()
    return dict(row) if row else None


def create_session(token: str, username: str, expires_at: float) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO sessions (token, username, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, username, time.time(), expires_at),
        )


def get_session_username(token: str) -> str | None:
    """Returns the session's username if the token exists and hasn't
    expired; opportunistically deletes it if it has (no separate cleanup
    job needed for an app this size)."""
    with _conn() as conn:
        row = conn.execute("SELECT username, expires_at FROM sessions WHERE token = ?", (token,)).fetchone()
        if row is None:
            return None
        if row["expires_at"] < time.time():
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            return None
        return row["username"]


def delete_session(token: str) -> None:
    with _conn() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
