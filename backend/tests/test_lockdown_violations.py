"""Tests that lockdown-mode proctoring violations submitted to the DSA
contest / quiz / mock-interview "finish" endpoints actually end up stored in
the session's summary, retrievable via storage.list_interview_sessions.
Uses the `client`/`tmp_db` fixtures from conftest.py."""
from __future__ import annotations

from conftest import login_as
from core import storage


def test_contest_finish_stores_violations(client):
    login_as(client, "priya")
    session_id = storage.create_interview_session("technical", "Contest", student_name="priya")

    payload = {
        "session_id": session_id,
        "results": [
            {"question_id": "arr-001", "title": "Two Sum", "topic": "Arrays", "difficulty": "Easy", "passed": True, "code": "..."},
        ],
        "elapsed_secs": 100,
        "duration_secs": 600,
        "violations": [
            {"type": "tab-switch", "label": "Switched tabs", "at": 12.5},
            {"type": "copy-paste", "label": "Pasted text", "at": 45.0},
        ],
    }
    res = client.post("/api/technical/contest/finish", json=payload)
    assert res.status_code == 200

    sessions = storage.list_interview_sessions(kind="technical", student_name="priya")
    finished = next(s for s in sessions if s["id"] == session_id)
    assert finished["summary"]["violations"] == [
        {"type": "tab-switch", "label": "Switched tabs", "at": 12.5},
        {"type": "copy-paste", "label": "Pasted text", "at": 45.0},
    ]


def test_quiz_finish_stores_violations(client):
    login_as(client, "rahul")
    session_id = storage.create_interview_session("technical", "Quiz", student_name="rahul")

    payload = {
        "session_id": session_id,
        "score_pct": 80.0,
        "log": [],
        "violations": [{"type": "fullscreen-exit", "label": "Left fullscreen", "at": 3.0}],
    }
    res = client.post("/api/technical/quiz/finish", json=payload)
    assert res.status_code == 200

    sessions = storage.list_interview_sessions(kind="technical", student_name="rahul")
    finished = next(s for s in sessions if s["id"] == session_id)
    assert finished["summary"]["violations"] == [{"type": "fullscreen-exit", "label": "Left fullscreen", "at": 3.0}]


def test_mock_interview_finish_stores_violations(client, monkeypatch):
    import routers.mock_interview as mock_interview_router

    def fake_generate_final_report(role, level, qna, filler_summary, profile=None, filler_ratio=None):
        return {
            "overall_score": 72,
            "strengths": ["Clear communication"],
            "areas_to_improve": ["More depth in answers"],
            "filler_word_note": "Minimal filler words.",
            "summary": "Solid overall performance.",
        }

    monkeypatch.setattr(mock_interview_router.mi, "generate_final_report", fake_generate_final_report)

    login_as(client, "amit")
    session_id = storage.create_interview_session("mock", "Backend Developer", student_name="amit")

    payload = {
        "session_id": session_id,
        "role": "Backend Developer",
        "level": "Fresher",
        "qna": [{"question": "Tell me about yourself.", "answer": "I am a final-year CS student.", "feedback": ""}],
        "violations": [{"type": "tab-switch", "label": "Switched tabs", "at": 5.0}],
    }
    res = client.post("/api/mock/finish", json=payload)
    assert res.status_code == 200

    sessions = storage.list_interview_sessions(kind="mock", student_name="amit")
    finished = next(s for s in sessions if s["id"] == session_id)
    assert finished["summary"]["violations"] == [{"type": "tab-switch", "label": "Switched tabs", "at": 5.0}]
