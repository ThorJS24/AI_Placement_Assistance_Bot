"""Tests for core/roadmap_image.py's build_roadmap_image — renders a
Roadmap Generator result into a downloadable PNG infographic. Doesn't need
any fixtures from conftest.py (pure function, no DB/app involved); just
checks the PNG it writes to config.GENERATED_DIR is a real, openable image
and that the layout math doesn't blow up on edge-case inputs."""
from __future__ import annotations

import os

from core.roadmap_image import build_roadmap_image

SAMPLE_ROADMAP = {
    "target_role": "Backend Developer",
    "timeframe": "12 weeks",
    "overview": "A focused plan to get you interview-ready for backend roles, covering DSA, "
    "system design fundamentals, and a couple of portfolio-worthy projects.",
    "phases": [
        {
            "name": "Foundations",
            "goal": "Build a solid base in data structures and Python fundamentals.",
            "topics": ["Arrays & Strings", "Linked Lists", "Recursion basics"],
            "resources": ["NeetCode 150", "CS50"],
            "milestone": "Solve 30 easy DSA problems",
        },
        {
            "name": "Core Backend Skills",
            "goal": "Learn to build and ship a real REST API.",
            "topics": ["REST API design", "SQL & databases", "Authentication"],
            "resources": ["FastAPI docs"],
            "milestone": "Ship a small CRUD API with auth",
        },
    ],
    "weekly_checklist_tip": "Review what you learned every Sunday and re-solve one problem from scratch.",
}


def test_build_roadmap_image_returns_real_png(tmp_path, monkeypatch):
    import config

    monkeypatch.setattr(config, "GENERATED_DIR", tmp_path)
    path = build_roadmap_image(SAMPLE_ROADMAP)

    assert os.path.exists(path)
    assert os.path.getsize(path) > 0

    from PIL import Image

    with Image.open(path) as img:
        img.verify()


def test_build_roadmap_image_with_zero_phases(tmp_path, monkeypatch):
    import config

    monkeypatch.setattr(config, "GENERATED_DIR", tmp_path)
    roadmap = {**SAMPLE_ROADMAP, "phases": []}
    path = build_roadmap_image(roadmap)

    assert os.path.exists(path)
    assert os.path.getsize(path) > 0
    from PIL import Image

    with Image.open(path) as img:
        img.verify()


def test_build_roadmap_image_with_long_overview_and_topics(tmp_path, monkeypatch):
    import config

    monkeypatch.setattr(config, "GENERATED_DIR", tmp_path)
    roadmap = {
        "target_role": "Full Stack Developer with a very long and unwieldy target role title added on purpose",
        "timeframe": "6 months",
        "overview": " ".join(["This is a very long overview sentence meant to stress the text-wrapping logic."] * 20),
        "phases": [
            {
                "name": "Phase with lots of topics",
                "goal": " ".join(["Goal text that goes on and on and on."] * 10),
                "topics": [f"Topic number {i} with a fairly long descriptive name attached to it" for i in range(25)],
                "resources": [f"Resource {i}" for i in range(15)],
                "milestone": " ".join(["Milestone description that is unusually long."] * 8),
            }
        ],
        "weekly_checklist_tip": " ".join(["Tip text repeated many times to test wrapping."] * 15),
    }
    path = build_roadmap_image(roadmap)

    assert os.path.exists(path)
    assert os.path.getsize(path) > 0
    from PIL import Image

    with Image.open(path) as img:
        img.verify()
