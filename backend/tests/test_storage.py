"""Tests for core/storage.py - preferences, academic profile, PIN-lock
identity isolation, and bookmarks. Each uses the `tmp_db` fixture (see
conftest.py) so nothing here ever touches the real storage/app.db."""
from __future__ import annotations

from core import storage


def test_preferences_defaults_and_partial_update(tmp_db):
    assert storage.get_student_preferences("Alice", "pin1") == storage.DEFAULT_PREFERENCES

    merged = storage.save_student_preferences("Alice", "pin1", {"dark_mode": "dark", "font_size": "lg"})
    assert merged["dark_mode"] == "dark"
    assert merged["font_size"] == "lg"
    assert merged["color_theme"] == "default"  # untouched field keeps its default

    # A second, disjoint update must not clobber the first update's fields.
    merged2 = storage.save_student_preferences("Alice", "pin1", {"color_theme": "ocean"})
    assert merged2["dark_mode"] == "dark"
    assert merged2["color_theme"] == "ocean"

    assert storage.get_student_preferences("Alice", "pin1") == merged2


def test_preferences_ignore_unknown_keys(tmp_db):
    merged = storage.save_student_preferences("Alice", "pin1", {"bogus_key": "x", "font_size": "sm"})
    assert "bogus_key" not in merged
    assert merged["font_size"] == "sm"


def test_preferences_not_persisted_for_guest(tmp_db):
    result = storage.save_student_preferences("Guest", "", {"dark_mode": "dark"})
    assert result["dark_mode"] == "dark"  # still returned so the caller can apply it locally
    # ...but nothing was actually written server-side for the shared Guest bucket.
    assert storage.get_student_preferences("Guest", "") == storage.DEFAULT_PREFERENCES


def test_academic_profile_roundtrip(tmp_db):
    storage.save_student_profile("Bob", "pin2", stream="CSE", semester="6", subjects=["DBMS", "OS"])
    profile = storage.get_student_profile("Bob", "pin2")
    assert profile["stream"] == "CSE"
    assert profile["semester"] == "6"
    assert profile["subjects"] == ["DBMS", "OS"]
    assert profile["has_pin"] is True


def test_pin_mismatch_isolates_into_a_locked_bucket_not_the_owners_data(tmp_db):
    storage.save_student_profile("Carol", "realpin", stream="ECE")
    wrong_name = storage._resolve_student("Carol", "wrongpin")
    assert wrong_name != "Carol"
    assert wrong_name.startswith("Carol#locked-")
    # The wrong-pin bucket must not see the real owner's saved data.
    assert storage.get_student_profile("Carol", "wrongpin")["stream"] == ""
    assert storage.get_student_profile("Carol", "realpin")["stream"] == "ECE"


def test_bookmarks_add_list_remove_and_idempotent_add(tmp_db):
    storage.add_bookmark("Dana", "pin4", "arr-001")
    storage.add_bookmark("Dana", "pin4", "str-001")
    assert set(storage.list_bookmark_ids("Dana", "pin4")) == {"arr-001", "str-001"}

    storage.remove_bookmark("Dana", "pin4", "arr-001")
    assert storage.list_bookmark_ids("Dana", "pin4") == ["str-001"]

    # Re-adding an already-bookmarked question must not raise a primary-key
    # conflict or duplicate the row.
    storage.add_bookmark("Dana", "pin4", "str-001")
    assert storage.list_bookmark_ids("Dana", "pin4") == ["str-001"]


def test_dashboard_counts_reflect_recorded_activity(tmp_db):
    before = storage.dashboard_counts()
    storage.touch_chat_session("sess-1", "Hello", student_name="Eve")
    after = storage.dashboard_counts()
    assert after["chat_sessions"] == before["chat_sessions"] + 1
