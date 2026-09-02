"""Post-session evaluation pass for the Live AI Interview — deliberately a
SEPARATE LLM call from the live conversational turns in modules/
live_interview.py, run once after the session ends (routers/
live_interview.py's /end endpoint), not interleaved with the live
back-and-forth. Mirrors modules/mock_interview.py's generate_final_report
pattern (same "insufficient data" guard, same anti-slop guardrail, same
honest-full-range-scoring instruction) but scores across more dimensions
and uses a rubric whose weights vary by interview type.

The server is the sole source of truth for the report: nothing client-sent
(score, duration, "completed" status) ever feeds into this — only the
transcript this module itself is given, which the router builds from
storage.list_turns() (the server-persisted log), never from anything the
client claims happened.
"""
from __future__ import annotations

from core import llm
from core.llm import ANTI_SLOP_INSTRUCTION

DIMENSIONS = ["technical", "communication", "confidence", "problem_solving", "role_fit"]

# Simple per-interview-type weighting used to compute `overall_score` from
# the per-dimension scores below, instead of a flat average — a technical
# round should weight `technical`/`problem_solving` more heavily, an HR
# round should weight `communication`/`confidence`/`role_fit` more heavily,
# a behavioral round sits in between. Kept as one small dict rather than a
# more elaborate rubric engine, per the "keep it simple" guidance this
# module was scoped against.
RUBRIC_WEIGHTS: dict[str, dict[str, float]] = {
    "technical": {"technical": 0.35, "communication": 0.15, "confidence": 0.10, "problem_solving": 0.30, "role_fit": 0.10},
    "hr": {"technical": 0.05, "communication": 0.30, "confidence": 0.25, "problem_solving": 0.10, "role_fit": 0.30},
    "behavioral": {"technical": 0.10, "communication": 0.25, "confidence": 0.20, "problem_solving": 0.15, "role_fit": 0.30},
}
DEFAULT_RUBRIC = "behavioral"


def resolve_rubric(interview_type: str) -> str:
    t = (interview_type or "").strip().lower()
    if "tech" in t:
        return "technical"
    if "hr" in t or "culture" in t:
        return "hr"
    return DEFAULT_RUBRIC


def _weighted_overall(scores: dict[str, float | None], rubric: str) -> int | None:
    weights = RUBRIC_WEIGHTS.get(rubric, RUBRIC_WEIGHTS[DEFAULT_RUBRIC])
    total_weight = 0.0
    total = 0.0
    for dim, weight in weights.items():
        val = scores.get(dim)
        if isinstance(val, (int, float)):
            total += val * weight
            total_weight += weight
    if total_weight <= 0:
        return None
    return round(total / total_weight)


def _insufficient_data_report(reason: str, rubric: str) -> dict:
    return {
        "overall_score": None,
        "technical_score": None,
        "communication_score": None,
        "confidence_score": None,
        "problem_solving_score": None,
        "role_fit_score": None,
        "strengths": [],
        "weaknesses": [],
        "recommendations": [],
        "question_notes": [],
        "summary": reason,
        "rubric": rubric,
        "insufficient_data": True,
    }


PROMPT_TEMPLATE = """You are evaluating a completed LIVE spoken mock interview transcript for the role: \
{role} (interview type: {interview_type}, difficulty: {difficulty}).
{profile_line}
Full transcript (Interviewer/Candidate turns in order):
{transcript}

Interruption count (candidate interrupted the AI while it was speaking, a real-time signal of \
engagement/confidence, not necessarily negative): {interrupt_count}

Score honestly across the FULL 0-100 range for each dimension below — do not default every candidate into a \
comfortable 60-80 band. Different dimensions can land far apart for the same candidate; score each on its \
own merits, based ONLY on what the candidate actually said in the transcript above.

Return ONLY a JSON object with exactly this shape:
{{
  "technical_score": <integer 0-100, depth/accuracy of technical or role-relevant content>,
  "communication_score": <integer 0-100, clarity, structure, conciseness of spoken answers>,
  "confidence_score": <integer 0-100, judged from hesitation/hedging/directness in the transcript, not tone of voice>,
  "problem_solving_score": <integer 0-100, how they approached harder/deep-dive/challenge questions>,
  "role_fit_score": <integer 0-100, how well their answers suggest fit for this specific role>,
  "strengths": [<3-5 short strings, specific to what they actually said>],
  "weaknesses": [<3-5 short strings, specific and actionable>],
  "recommendations": [<2-4 short strings, concrete next steps to improve>],
  "question_notes": [<one object per interviewer question actually asked, in order: {{"question": "<short>", "note": "<1 sentence assessment of the answer>"}}>],
  "summary": "<3-4 sentence overall summary, encouraging but honest>"
}}
{anti_slop}"""


def generate_evaluation(
    role: str, interview_type: str, difficulty: str,
    transcript: list[dict], interrupt_count: int = 0, profile: dict | None = None,
) -> dict:
    rubric = resolve_rubric(interview_type)
    candidate_turns = [t for t in transcript if t.get("speaker") == "candidate" and (t.get("text") or "").strip()]
    if not candidate_turns:
        return _insufficient_data_report(
            "This session ended before you answered any question, so there's nothing to score. "
            "Start a new live interview when you're ready.",
            rubric,
        )

    transcript_text = "\n".join(
        f"{'Interviewer' if t['speaker'] == 'ai' else 'Candidate'}: {t['text']}" for t in transcript
    )
    profile_line = ""
    if profile and any(profile.get(k) for k in ("stream", "specialization", "semester")):
        profile_line = f"\nCandidate background: {profile.get('stream', '')} {profile.get('specialization', '')} (semester {profile.get('semester', '')}).\n"

    prompt = PROMPT_TEMPLATE.format(
        role=role, interview_type=interview_type, difficulty=difficulty or "medium",
        transcript=transcript_text, interrupt_count=interrupt_count,
        profile_line=profile_line, anti_slop=ANTI_SLOP_INSTRUCTION,
    )
    report = llm.chat_json(
        llm.system_user("You are a rigorous but fair live-interview performance evaluator.", prompt),
        temperature=0.4, max_tokens=1400,
    )

    scores = {dim: report.get(f"{dim}_score") for dim in DIMENSIONS}
    report["overall_score"] = _weighted_overall(scores, rubric)
    report["rubric"] = rubric
    report.setdefault("strengths", [])
    report.setdefault("weaknesses", [])
    report.setdefault("recommendations", [])
    report.setdefault("question_notes", [])
    report["insufficient_data"] = False
    return report
