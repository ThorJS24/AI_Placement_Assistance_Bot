"""Router-level smoke tests via FastAPI's TestClient — a handful of key
endpoints exercised end-to-end (routing, auth, persistence) rather than
every endpoint exhaustively. Uses the `client`/`admin_headers` fixtures
from conftest.py, which point the whole app at a throwaway DB and a
throwaway copy of the question-bank JSON files.

Note: this file needs the real `fastapi` package installed (already in
requirements.txt) — it could not be executed in the sandbox that produced
it, since that environment's package index blocks fastapi/pytest installs.
The rest of this suite (test_code_judge.py, test_storage.py,
test_validation.py, test_rate_limit.py) doesn't have that dependency and
was directly run and confirmed passing before delivery."""
from __future__ import annotations

from conftest import login_as


def test_health_check(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_preferences_default_then_patch_then_get_reflects_it(client):
    login_as(client, "priya")

    res = client.get("/api/preferences")
    assert res.status_code == 200
    assert res.json()["color_theme"] == "default"

    res = client.patch("/api/preferences", json={"color_theme": "forest", "dark_mode": "dark"})
    assert res.status_code == 200
    assert res.json()["color_theme"] == "forest"
    assert res.json()["dark_mode"] == "dark"

    res = client.get("/api/preferences")
    assert res.json()["color_theme"] == "forest"


def test_preferences_rejects_invalid_theme_value(client):
    login_as(client, "priya")
    res = client.patch("/api/preferences", json={"color_theme": "not-a-real-theme"})
    assert res.status_code == 422  # Pydantic Literal validation


def test_admin_endpoints_require_correct_passcode(client, admin_headers):
    res = client.post("/api/admin/login")  # no passcode header at all
    assert res.status_code == 401

    res = client.post("/api/admin/login", headers={"X-Admin-Passcode": "definitely-wrong"})
    assert res.status_code == 401

    res = client.post("/api/admin/login", headers=admin_headers)
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_admin_overview_returns_department_shape(client, admin_headers):
    res = client.get("/api/admin/overview", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "department_name" in data
    assert "counts" in data
    assert "students" in data
    assert "leaderboard" in data


def test_dsa_topics_and_bookmarks_roundtrip(client):
    login_as(client, "rahul")

    topics = client.get("/api/technical/dsa/topics").json()
    assert "Arrays" in topics  # from the shipped question bank

    empty = client.get("/api/technical/bookmarks").json()
    assert empty == []

    add = client.post("/api/technical/bookmarks/arr-001")
    assert add.status_code == 200

    listed = client.get("/api/technical/bookmarks").json()
    assert any(q["id"] == "arr-001" for q in listed)

    remove = client.delete("/api/technical/bookmarks/arr-001")
    assert remove.status_code == 200
    assert client.get("/api/technical/bookmarks").json() == []
