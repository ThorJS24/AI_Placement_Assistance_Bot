"""Business logic for the Roadmap Generator module.

Hybrid approach: start from a curated department template (data/roadmap_templates.json)
when the target role matches one closely, then ask the LLM to personalize it to the
student's stated current level and timeframe, and add a short weekly checklist.
This keeps roadmaps grounded in vetted, real resources while still tailoring them.
"""
from __future__ import annotations

import json
import os

from core import llm
from core.llm import ANTI_SLOP_INSTRUCTION

TEMPLATES_PATH = None  # set lazily below to avoid circular import ordering issues

# mtime-keyed cache, same rationale as modules/technical_interview.py's
# _load_json_cached: this file rarely changes, so avoid re-parsing it on
# every single roadmap generation while still picking up manual edits
# immediately (mtime change -> cache miss).
_templates_cache: tuple[float, dict] | None = None


def _load_templates() -> dict:
    global _templates_cache
    import config

    path = config.DATA_DIR / "roadmap_templates.json"
    mtime = os.path.getmtime(path)
    if _templates_cache is not None and _templates_cache[0] == mtime:
        return _templates_cache[1]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    _templates_cache = (mtime, data)
    return data


def list_template_roles() -> list[str]:
    return list(_load_templates().keys())


def closest_template(target_role: str) -> tuple[str, dict] | None:
    templates = _load_templates()
    target_lower = target_role.lower().strip()
    if not target_lower:
        return None
    # exact / substring match first
    for name, tpl in templates.items():
        if target_lower == name.lower() or target_lower in name.lower() or name.lower() in target_lower:
            return name, tpl
    return None


def _profile_block(profile: dict | None) -> str:
    if not profile:
        return ""
    bits = []
    if profile.get("stream"):
        bits.append(f"Stream: {profile['stream']}")
    if profile.get("specialization"):
        bits.append(f"Specialization: {profile['specialization']}")
    if profile.get("semester"):
        bits.append(f"Currently in semester {profile['semester']}")
    subjects = profile.get("subjects") or []
    if subjects:
        bits.append(f"Current coursework: {', '.join(subjects[:8])}")
    return ("\nStudent's academic profile (use this to calibrate difficulty and connect the plan to what "
            "they already know from coursework, without just repeating course names):\n" + "\n".join(bits) + "\n") if bits else ""


def _weak_topics_block(weak_topics: list[str] | None) -> str:
    if not weak_topics:
        return ""
    return (
        f"\nThis student's own Technical Interview practice history shows a below-50% solve rate on: "
        f"{', '.join(weak_topics)}. Prioritize these — devote extra explicit topics/resources to shoring "
        f"them up early in the plan rather than treating every topic as equally weighted.\n"
    )


def generate_roadmap(
    target_role: str, current_level: str, timeframe: str, focus_notes: str,
    profile: dict | None = None, weak_topics: list[str] | None = None,
) -> dict:
    match = closest_template(target_role)
    base_context = ""
    if match:
        name, tpl = match
        base_context = (
            f"\nHere is a vetted baseline curriculum for a closely related role ('{name}') you should "
            f"adapt (reorder/trim/extend phases, keep the good real resources, don't discard it wholesale):\n"
            f"{json.dumps(tpl, indent=2)}\n"
        )

    prompt = f"""Create a personalized, realistic learning roadmap for a student targeting the role: "{target_role}".
Student's current level: {current_level or 'not specified, assume beginner-to-intermediate'}.
Available timeframe: {timeframe or '3 months'}.
Extra notes/constraints from the student: {focus_notes or 'none'}.
{_profile_block(profile)}{_weak_topics_block(weak_topics)}{base_context}
{ANTI_SLOP_INSTRUCTION}
Return ONLY a JSON object with exactly this shape:
{{
  "target_role": "{target_role}",
  "timeframe": "{timeframe or '3 months'}",
  "overview": "<2-3 sentence overview of the plan and strategy>",
  "phases": [
    {{
      "name": "<phase name with a week range, e.g. 'Foundations (Weeks 1-3)'>",
      "goal": "<1 sentence phase goal>",
      "topics": [<4-6 short topic strings>],
      "resources": [<2-4 short strings naming REAL, well-known free/open resources — official docs, freeCodeCamp, GeeksforGeeks, NeetCode, Coursera audit mode, Kaggle Learn, MDN, etc. Do not invent fake course names.>],
      "milestone": "<1 concrete, checkable deliverable for this phase, e.g. 'Solve 30 array/string problems' or 'Deploy 1 working project'>"
    }}
  ],
  "weekly_checklist_tip": "<1 practical sentence on how to track weekly progress>"
}}
Use 3-5 phases total. Keep topics and resources concrete and realistic, not generic filler."""

    return llm.chat_json(
        llm.system_user(
            "You are an expert career mentor for computer science students preparing for campus placements. "
            "You give concrete, realistic, resource-grounded plans, never vague motivational fluff.",
            prompt,
        ),
        temperature=0.5,
        max_tokens=1800,
    )
