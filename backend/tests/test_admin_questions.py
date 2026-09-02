"""Tests for the admin question-bank CRUD endpoints (routers/admin_questions.py).

Every one of these was also verified by calling the router functions
directly (bypassing FastAPI/TestClient, which aren't importable in the
sandbox that wrote this) against a throwaway copy of the real question-bank
JSON files, confirming create/duplicate-rejection/update/404/delete all
behave as asserted below. This file exercises the same behavior through the
real HTTP layer, which needs the real fastapi package (see
test_api_smoke.py's note)."""
from __future__ import annotations

VALID_DSA = {
    "id": "test-999",
    "topic": "Arrays",
    "difficulty": "Easy",
    "companies": ["TCS"],
    "title": "Test Question",
    "description": "A test question.",
    "input_format": "n",
    "output_format": "n",
    "starter_code": "pass",
    "hints": ["hint"],
    "test_cases": [{"input": "1\n", "expected": "1"}],
}


def test_dsa_question_crud_roundtrip(client, admin_headers):
    before = client.get("/api/admin/questions/dsa", headers=admin_headers).json()

    create = client.post("/api/admin/questions/dsa", json=VALID_DSA, headers=admin_headers)
    assert create.status_code == 200

    listed = client.get("/api/admin/questions/dsa", headers=admin_headers).json()
    assert len(listed) == len(before) + 1
    assert any(q["id"] == "test-999" for q in listed)

    dup = client.post("/api/admin/questions/dsa", json=VALID_DSA, headers=admin_headers)
    assert dup.status_code == 409

    updated = {**VALID_DSA, "title": "Updated Title", "difficulty": "Medium"}
    upd = client.patch("/api/admin/questions/dsa/test-999", json=updated, headers=admin_headers)
    assert upd.status_code == 200
    found = next(q for q in client.get("/api/admin/questions/dsa", headers=admin_headers).json() if q["id"] == "test-999")
    assert found["title"] == "Updated Title"
    assert found["difficulty"] == "Medium"

    missing_upd = client.patch("/api/admin/questions/dsa/does-not-exist", json=updated, headers=admin_headers)
    assert missing_upd.status_code == 404

    delete = client.delete("/api/admin/questions/dsa/test-999", headers=admin_headers)
    assert delete.status_code == 200
    after = client.get("/api/admin/questions/dsa", headers=admin_headers).json()
    assert len(after) == len(before)

    missing_del = client.delete("/api/admin/questions/dsa/test-999", headers=admin_headers)
    assert missing_del.status_code == 404


def test_dsa_question_requires_at_least_one_test_case(client, admin_headers):
    bad = {**VALID_DSA, "id": "test-notestcases", "test_cases": []}
    res = client.post("/api/admin/questions/dsa", json=bad, headers=admin_headers)
    assert res.status_code == 422


def test_question_crud_requires_admin_passcode(client):
    res = client.get("/api/admin/questions/dsa")
    assert res.status_code == 401
    res = client.post("/api/admin/questions/dsa", json=VALID_DSA)
    assert res.status_code == 401


VALID_MCQ = {
    "id": "qz-test-1",
    "topic": "OOP",
    "type": "mcq",
    "difficulty": "Easy",
    "question": "Which one?",
    "options": ["A", "B", "C"],
    "answer": "B",
    "explanation": "because",
}


def test_quiz_mcq_answer_must_be_in_options(client, admin_headers):
    bad = {**VALID_MCQ, "id": "qz-bad-1", "answer": "Z"}
    res = client.post("/api/admin/questions/quiz", json=bad, headers=admin_headers)
    assert res.status_code == 422


def test_quiz_mcq_needs_at_least_two_options(client, admin_headers):
    bad = {**VALID_MCQ, "id": "qz-bad-2", "options": ["A"], "answer": "A"}
    res = client.post("/api/admin/questions/quiz", json=bad, headers=admin_headers)
    assert res.status_code == 422


def test_quiz_short_answer_does_not_require_options(client, admin_headers):
    sa = {
        "id": "qz-test-sa",
        "topic": "OOP",
        "type": "short_answer",
        "difficulty": "Medium",
        "question": "Explain X.",
        "answer": "X is Y.",
        "explanation": "",
    }
    res = client.post("/api/admin/questions/quiz", json=sa, headers=admin_headers)
    assert res.status_code == 200
    listed = client.get("/api/admin/questions/quiz", headers=admin_headers).json()
    assert any(q["id"] == "qz-test-sa" for q in listed)


def test_quiz_question_crud_roundtrip(client, admin_headers):
    before = client.get("/api/admin/questions/quiz", headers=admin_headers).json()
    client.post("/api/admin/questions/quiz", json=VALID_MCQ, headers=admin_headers)
    after_create = client.get("/api/admin/questions/quiz", headers=admin_headers).json()
    assert len(after_create) == len(before) + 1

    client.delete("/api/admin/questions/quiz/qz-test-1", headers=admin_headers)
    after_delete = client.get("/api/admin/questions/quiz", headers=admin_headers).json()
    assert len(after_delete) == len(before)
