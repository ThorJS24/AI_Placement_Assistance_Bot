"""Tests for the Live AI Interview module: session creation/auth/ownership
isolation, the modules/live_interview.py state-machine helpers, the
evaluation scoring module, WS auth rejection, and the cancellation-token
interrupt logic. Uses the `client` fixture from conftest.py (throwaway DB)
and FastAPI TestClient's WS support for the auth-rejection cases - no real
browser/microphone needed for any of this."""
from __future__ import annotations

import threading

import pytest

from conftest import login_as
from modules import live_interview as li
from modules import live_interview_evaluation as li_eval


# ---------------------------------------------------------------------------
# Session creation / auth / ownership isolation (REST)
# ---------------------------------------------------------------------------

def test_create_session_requires_auth(client):
    res = client.post("/api/live-interview/sessions", json={"role": "Backend Engineer"})
    assert res.status_code == 401


def test_create_session_returns_ws_url_and_config(client):
    login_as(client, "amit")
    res = client.post("/api/live-interview/sessions", json={
        "role": "Backend Engineer", "interview_type": "technical", "difficulty": "hard",
        "style": "strict", "duration_secs": 300,
    })
    assert res.status_code == 200
    data = res.json()
    assert "session_id" in data
    assert data["ws_url"] == f"/api/live-interview/sessions/{data['session_id']}/ws"
    assert data["config"]["interview_type"] == "technical"
    assert data["config"]["duration_secs"] == 300


def test_create_session_rejects_blank_role(client):
    login_as(client, "amit2")
    res = client.post("/api/live-interview/sessions", json={"role": "   "})
    assert res.status_code == 422


def test_create_session_normalizes_invalid_enum_fields(client):
    login_as(client, "amit3")
    res = client.post("/api/live-interview/sessions", json={"role": "QA Engineer", "interview_type": "nonsense", "style": "nonsense"})
    assert res.status_code == 200
    cfg = res.json()["config"]
    assert cfg["interview_type"] == "behavioral"
    assert cfg["style"] == "neutral"


def test_max_concurrent_sessions_enforced(client, monkeypatch):
    import config as backend_config
    monkeypatch.setattr(backend_config, "LIVE_INTERVIEW_MAX_CONCURRENT_PER_STUDENT", 1)
    login_as(client, "busy_student")
    res1 = client.post("/api/live-interview/sessions", json={"role": "Engineer"})
    assert res1.status_code == 200
    res2 = client.post("/api/live-interview/sessions", json={"role": "Engineer"})
    assert res2.status_code == 409


def test_feature_flag_disabled_returns_503(client, monkeypatch):
    import config as backend_config
    monkeypatch.setattr(backend_config, "LIVE_INTERVIEW_ENABLED", False)
    login_as(client, "flagged_student")
    res = client.post("/api/live-interview/sessions", json={"role": "Engineer"})
    assert res.status_code == 503


def test_get_session_owner_only(client):
    login_as(client, "owner1")
    res = client.post("/api/live-interview/sessions", json={"role": "Engineer"})
    session_id = res.json()["session_id"]

    own = client.get(f"/api/live-interview/sessions/{session_id}")
    assert own.status_code == 200
    assert own.json()["student_name"] == "owner1"

    # Different account must not be able to read it.
    client2 = client
    client2.cookies.clear()
    login_as(client2, "intruder1")
    other = client2.get(f"/api/live-interview/sessions/{session_id}")
    assert other.status_code == 403


def test_get_session_missing_returns_404(client):
    login_as(client, "owner2")
    res = client.get("/api/live-interview/sessions/999999")
    assert res.status_code == 404


def test_history_scoped_per_student(client):
    login_as(client, "hist1")
    client.post("/api/live-interview/sessions", json={"role": "Engineer"})
    mine = client.get("/api/live-interview/history").json()
    assert len(mine) == 1

    client.cookies.clear()
    login_as(client, "hist2")
    theirs = client.get("/api/live-interview/history").json()
    assert theirs == []


# ---------------------------------------------------------------------------
# WebSocket auth rejection
# ---------------------------------------------------------------------------

def test_ws_rejects_unauthenticated_connection(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/api/live-interview/sessions/1/ws"):
            pass


def test_ws_rejects_wrong_owner(client):
    login_as(client, "ws_owner")
    session_id = client.post("/api/live-interview/sessions", json={"role": "Engineer"}).json()["session_id"]
    client.cookies.clear()
    login_as(client, "ws_intruder")
    with pytest.raises(Exception):
        with client.websocket_connect(f"/api/live-interview/sessions/{session_id}/ws"):
            pass


def test_ws_rejects_nonexistent_session(client):
    login_as(client, "ws_ghost")
    with pytest.raises(Exception):
        with client.websocket_connect("/api/live-interview/sessions/987654/ws"):
            pass


# ---------------------------------------------------------------------------
# modules/live_interview.py - state machine helpers
# ---------------------------------------------------------------------------

def test_next_stage_progresses_with_elapsed_time():
    stage = None
    stage = li.next_stage(stage, 0, 600)
    assert stage == "opening"
    stage = li.next_stage(stage, 590, 600)
    assert stage == "closing"


def test_next_stage_never_regresses():
    stage = li.next_stage(None, 500, 600)  # near the end
    later_but_earlier_fraction = li.next_stage(stage, 10, 600)  # time doesn't actually go backwards in practice
    assert li.STAGES.index(later_but_earlier_fraction) >= li.STAGES.index(stage)


@pytest.mark.parametrize("text,expected", [
    ("can you repeat the question", "repeat"),
    ("I don't know", "skip"),
    ("skip", "skip"),
    ("I'd like to stop", "end"),
    ("I think the answer is O(n log n)", None),
    ("", None),
])
def test_detect_control_intent(text, expected):
    assert li.detect_control_intent(text) == expected


def test_iter_cancellable_sentences_stops_when_interrupted():
    stop_event = threading.Event()

    def token_gen():
        yield "First sentence. "
        yield "Second sentence. "
        stop_event.set()  # simulates a barge-in arriving mid-stream
        yield "Third sentence. "
        yield "Fourth sentence."

    sentences = list(li.iter_cancellable_sentences(token_gen(), stop_event))
    # Only sentences completed strictly before the interrupt was set should
    # have been yielded - nothing after the barge-in.
    assert sentences == ["First sentence.", "Second sentence."]


def test_iter_cancellable_sentences_yields_everything_when_never_interrupted():
    stop_event = threading.Event()

    def token_gen():
        yield "One. Two. "
        yield "Three"

    sentences = list(li.iter_cancellable_sentences(token_gen(), stop_event))
    assert sentences == ["One.", "Two.", "Three"]


def test_iter_cancellable_sentences_already_set_yields_nothing():
    stop_event = threading.Event()
    stop_event.set()

    def token_gen():
        yield "Should never be consumed."

    assert list(li.iter_cancellable_sentences(token_gen(), stop_event)) == []


# ---------------------------------------------------------------------------
# modules/live_interview_evaluation.py - rubric + scoring
# ---------------------------------------------------------------------------

def test_resolve_rubric_by_interview_type():
    assert li_eval.resolve_rubric("Technical") == "technical"
    assert li_eval.resolve_rubric("HR round") == "hr"
    assert li_eval.resolve_rubric("behavioral") == "behavioral"
    assert li_eval.resolve_rubric("something-else") == li_eval.DEFAULT_RUBRIC


def test_weighted_overall_uses_rubric_weights():
    scores = {"technical": 90, "communication": 40, "confidence": 40, "problem_solving": 90, "role_fit": 40}
    technical_overall = li_eval._weighted_overall(scores, "technical")
    hr_overall = li_eval._weighted_overall(scores, "hr")
    # A candidate strong on technical/problem_solving, weak elsewhere, should
    # score noticeably higher under the technical rubric than the hr rubric.
    assert technical_overall > hr_overall


def test_evaluation_insufficient_data_when_no_candidate_turns():
    report = li_eval.generate_evaluation(
        "Backend Engineer", "technical", "medium",
        transcript=[{"speaker": "ai", "text": "Tell me about yourself."}],
        interrupt_count=0, profile=None,
    )
    assert report["insufficient_data"] is True
    assert report["overall_score"] is None
