"""Tests for the admin trend/analytics functions in core/storage.py
(activity_trend, solve_rate_trend, readiness_distribution) and their
routes. Rows are seeded with explicit past timestamps (not time.time())
so day-bucketing can be checked precisely — this exact scenario was run
standalone against the real storage.py before this file was written."""
from __future__ import annotations

import datetime

from core import storage


def _ts_days_ago(n: int) -> float:
    dt = datetime.datetime.combine(datetime.date.today() - datetime.timedelta(days=n), datetime.time(12, 0))
    return dt.timestamp()


def _seed(tmp_db):
    today = datetime.date.today()
    with storage._conn() as conn:
        conn.execute(
            "INSERT INTO chat_sessions (id, title, created_at, updated_at, student_name) VALUES (?,?,?,?,?)",
            ("s1", "t1", _ts_days_ago(0), _ts_days_ago(0), "Alice"),
        )
        conn.execute(
            "INSERT INTO chat_sessions (id, title, created_at, updated_at, student_name) VALUES (?,?,?,?,?)",
            ("s2", "t2", _ts_days_ago(0), _ts_days_ago(0), "Bob"),
        )
        conn.execute(
            "INSERT INTO resumes (full_name, target_role, payload_json, file_path, created_at, student_name) "
            "VALUES (?,?,?,?,?,?)",
            ("Alice", "SWE", "{}", "", _ts_days_ago(3), "Alice"),
        )
        sess_id = conn.execute(
            "INSERT INTO interview_sessions (kind, topic, summary_json, score, created_at, student_name) "
            "VALUES (?,?,?,?,?,?)",
            ("technical", "DSA", "{}", None, _ts_days_ago(0), "Alice"),
        ).lastrowid
        conn.execute(
            "INSERT INTO interview_qna (session_id, question, answer, feedback, is_correct, created_at, topic, "
            "difficulty, round_type) VALUES (?,?,?,?,?,?,?,?,?)",
            (sess_id, "Q1", "A1", "", 1, _ts_days_ago(0), "Arrays", "Easy", "dsa"),
        )
        conn.execute(
            "INSERT INTO interview_qna (session_id, question, answer, feedback, is_correct, created_at, topic, "
            "difficulty, round_type) VALUES (?,?,?,?,?,?,?,?,?)",
            (sess_id, "Q2", "A2", "", 0, _ts_days_ago(2), "Strings", "Easy", "dsa"),
        )
    return today


def test_activity_trend_buckets_by_day_correctly(tmp_db):
    today = _seed(tmp_db)
    trend = storage.activity_trend(days=7)
    assert len(trend) == 7
    assert trend[-1]["date"] == today.isoformat()
    assert trend[-1]["chat_sessions"] == 2
    assert trend[-1]["technical_interviews"] == 1
    assert trend[-4]["resumes"] == 1  # 3 days ago
    assert trend[0]["chat_sessions"] == 0  # oldest day in the window, no activity


def test_activity_trend_clamps_days_argument(tmp_db):
    assert len(storage.activity_trend(days=0)) == 1  # clamped to minimum 1
    assert len(storage.activity_trend(days=9999)) == 90  # clamped to maximum 90


def test_solve_rate_trend_distinguishes_zero_percent_from_no_data(tmp_db):
    _seed(tmp_db)
    trend = storage.solve_rate_trend(days=7)
    today_bucket = trend[-1]
    assert today_bucket["total"] == 1 and today_bucket["correct"] == 1 and today_bucket["solve_rate"] == 100
    two_days_ago = trend[-3]
    assert two_days_ago["total"] == 1 and two_days_ago["correct"] == 0 and two_days_ago["solve_rate"] == 0
    no_data_day = trend[0]
    assert no_data_day["total"] == 0
    assert no_data_day["solve_rate"] is None  # None, not 0 -- "no attempts" is not "0% solved"


def test_readiness_distribution_sums_to_known_student_count(tmp_db):
    _seed(tmp_db)
    dist = storage.readiness_distribution()
    assert set(dist.keys()) == {"green", "amber", "red"}
    with storage._conn() as conn:
        known = len(storage._list_known_students(conn))
    assert sum(dist.values()) == known


def test_analytics_routes_require_admin_passcode(client):
    assert client.get("/api/admin/trends/activity").status_code == 401
    assert client.get("/api/admin/trends/solve-rate").status_code == 401
    assert client.get("/api/admin/trends/readiness").status_code == 401


def test_analytics_routes_return_expected_shape(client, admin_headers):
    activity = client.get("/api/admin/trends/activity?days=5", headers=admin_headers)
    assert activity.status_code == 200
    assert len(activity.json()) == 5

    solve_rate = client.get("/api/admin/trends/solve-rate?days=5", headers=admin_headers)
    assert solve_rate.status_code == 200
    assert len(solve_rate.json()) == 5

    readiness = client.get("/api/admin/trends/readiness", headers=admin_headers)
    assert readiness.status_code == 200
    assert set(readiness.json().keys()) == {"green", "amber", "red"}
