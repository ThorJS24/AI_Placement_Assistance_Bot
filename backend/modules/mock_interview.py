"""Business logic for the Mock Interview (speech-to-speech) module."""
from __future__ import annotations

from core import llm
from core.llm import ANTI_SLOP_INSTRUCTION

SYSTEM_PROMPT = """You are an experienced, professional technical interviewer conducting a mock \
placement interview. Ask realistic questions (mix of behavioral and role-relevant technical/conceptual \
questions - no live coding, this is a spoken round), one at a time, and adapt your next question based \
on the candidate's previous answer, the way a real interviewer would (ask a natural follow-up sometimes, \
move to a new topic other times). Stay encouraging but professional; do not just say 'good job' to everything."""


def _profile_line(profile: dict | None) -> str:
    if not profile:
        return ""
    bits = []
    if profile.get("stream"):
        bits.append(profile["stream"])
    if profile.get("specialization"):
        bits.append(f"specializing in {profile['specialization']}")
    if profile.get("semester"):
        bits.append(f"semester {profile['semester']}")
    subjects = profile.get("subjects") or []
    if subjects:
        bits.append(f"studies {', '.join(subjects[:5])}")
    return f"\nCandidate's academic background: {', '.join(bits)}. Use this to pick relevant follow-ups where natural, don't force it into every question.\n" if bits else ""


def generate_first_question(role: str, level: str, profile: dict | None = None) -> str:
    prompt = (
        f"Start a mock interview for the role '{role}' with a candidate whose experience level is: "
        f"{level or 'fresher / entry-level'}. Ask ONE opening question - something like a warm-up "
        "('Tell me about yourself' style) or a role-relevant opener. "
        f"{_profile_line(profile)}"
        "Return ONLY the question text, nothing else, no numbering, no quotes."
    )
    return llm.chat(llm.system_user(SYSTEM_PROMPT, prompt), temperature=0.7, max_tokens=150).strip()


def stream_first_question(role: str, level: str, profile: dict | None = None):
    """Token generator variant of generate_first_question, for the live-mode
    streaming start endpoint - lets TTS begin on the opening question's first
    sentence before the rest of it has finished generating."""
    prompt = (
        f"Start a mock interview for the role '{role}' with a candidate whose experience level is: "
        f"{level or 'fresher / entry-level'}. Ask ONE opening question - something like a warm-up "
        "('Tell me about yourself' style) or a role-relevant opener. "
        f"{_profile_line(profile)}"
        "Return ONLY the question text, nothing else, no numbering, no quotes."
    )
    yield from llm.stream_chat(llm.system_user(SYSTEM_PROMPT, prompt), temperature=0.7, max_tokens=150)


def generate_next_turn(role: str, level: str, qna_so_far: list[dict], last_answer: str, profile: dict | None = None) -> dict:
    """Return {"feedback": str, "next_question": str} - brief feedback on the last answer
    plus the next interview question, generated together for context efficiency."""
    history_text = "\n".join(
        f"Q{i+1}: {turn['question']}\nA{i+1}: {turn['answer']}" for i, turn in enumerate(qna_so_far)
    )
    prompt = f"""Role being interviewed for: {role}
Candidate level: {level or 'fresher / entry-level'}
{_profile_line(profile)}
Interview so far:
{history_text}

The candidate's latest answer was: "{last_answer}"

Return ONLY a JSON object:
{{
  "feedback": "<1-2 sentence constructive, specific feedback on the LATEST answer only - mention something concrete they said, not generic praise. If the answer was thin, vague, or dodged the question, say so plainly instead of softening it.>",
  "next_question": "<the next interview question - either a natural follow-up on their last answer, or a fresh question covering a new relevant topic/behavioral angle>"
}}
{ANTI_SLOP_INSTRUCTION}"""
    return llm.chat_json(llm.system_user(SYSTEM_PROMPT, prompt), temperature=0.7, max_tokens=400)


NEXT_TURN_STREAM_MARKER_FEEDBACK = "FEEDBACK:"
NEXT_TURN_STREAM_MARKER_QUESTION = "QUESTION:"


def stream_next_turn(role: str, level: str, qna_so_far: list[dict], last_answer: str, profile: dict | None = None):
    """Token generator for the live-mode streaming endpoint (routers/mock_interview.py's
    /next/stream). Same content as generate_next_turn, but asks for a plain
    two-section format instead of one JSON blob, since a JSON object can't be
    usefully parsed until the whole thing has arrived - this format lets the
    caller start acting on the feedback section, then the question section,
    as soon as each one's text (and, for the question, each full sentence)
    is available, instead of waiting for the entire response."""
    history_text = "\n".join(
        f"Q{i+1}: {turn['question']}\nA{i+1}: {turn['answer']}" for i, turn in enumerate(qna_so_far)
    )
    prompt = f"""Role being interviewed for: {role}
Candidate level: {level or 'fresher / entry-level'}
{_profile_line(profile)}
Interview so far:
{history_text}

The candidate's latest answer was: "{last_answer}"

Respond in EXACTLY this plain-text format, nothing else before or after (no JSON, no markdown, no headers):
{NEXT_TURN_STREAM_MARKER_FEEDBACK} <1-2 sentence constructive, specific feedback on the LATEST answer only - mention something concrete they said, not generic praise. If the answer was thin, vague, or dodged the question, say so plainly instead of softening it.>
{NEXT_TURN_STREAM_MARKER_QUESTION} <the next interview question - either a natural follow-up on their last answer, or a fresh question covering a new relevant topic/behavioral angle>
{ANTI_SLOP_INSTRUCTION}"""
    yield from llm.stream_chat(llm.system_user(SYSTEM_PROMPT, prompt), temperature=0.7, max_tokens=400)


REPORT_PROMPT_TEMPLATE = """You are evaluating a completed mock interview transcript for the role: {role} \
(candidate level: {level}).
{profile_line}
Transcript:
{transcript}

Filler-word usage detected across all answers (rough automatic count): {filler_summary}

Score honestly across the FULL 0-100 range - do not default every candidate into a comfortable 60-80 band. \
A candidate who gave short, vague, or off-topic answers should score below 40 on the relevant dimension. \
A candidate who was consistently specific, structured, and technically sound should score above 85. \
Most real candidates are uneven - it's normal and expected for different dimensions to land far apart \
(e.g. strong content_depth but weak structure), so score each dimension independently on its own merits.

Return ONLY a JSON object with exactly this shape:
{{
  "overall_score": <integer 0-100>,
  "communication_score": <integer 0-100, clarity/conciseness/verbal habits - this will be blended with a real measured filler-word ratio afterward, so judge it primarily on clarity and structure of speech, not just filler words>,
  "content_depth_score": <integer 0-100>,
  "structure_score": <integer 0-100, e.g. STAR-method usage for behavioral answers>,
  "strengths": [<3-5 short strings, specific to what they actually said - quote or paraphrase a specific moment, not a vague trait>],
  "areas_to_improve": [<3-5 short strings, specific and actionable - say what to do differently, not just what was wrong>],
  "filler_word_note": "<1 sentence commenting on filler-word usage using the count provided, or noting it was minimal>",
  "summary": "<3-4 sentence overall summary of the performance, encouraging but honest - do not soften a genuinely weak performance into false positivity>"
}}
{anti_slop}"""


def _insufficient_data_report(reason: str) -> dict:
    """Returned instead of calling the LLM when there's no real transcript to
    grade - e.g. the session ended (proctoring violation, early exit) before
    the candidate answered anything. Scoring or writing "strengths" off an
    empty or near-empty transcript would just be the model inventing plausible-
    sounding content that was never actually said, which is worse than no
    report at all. Scores are null (not 0) so the frontend can render "-"
    instead of a misleading zero (see ReportPanel's `val ?? "-"`)."""
    return {
        "overall_score": None,
        "communication_score": None,
        "content_depth_score": None,
        "structure_score": None,
        "strengths": [],
        "areas_to_improve": [],
        "filler_word_note": "",
        "summary": reason,
        "insufficient_data": True,
    }


def generate_final_report(
    role: str, level: str, qna: list[dict], filler_summary: str,
    profile: dict | None = None, filler_ratio: float | None = None,
) -> dict:
    real_answers = [t for t in qna if (t.get("answer") or "").strip() and t["answer"].strip() != "(skipped)"]
    if not real_answers:
        return _insufficient_data_report(
            "This session ended before you answered any question, so there's nothing to score. "
            "Start a new interview when you're ready."
        )

    transcript = "\n\n".join(
        f"Q{i+1}: {t['question']}\nA{i+1}: {t['answer']}" for i, t in enumerate(qna)
    )
    partial_note = (
        f"\nNote: this session ended early after only {len(real_answers)} question(s) were answered - "
        "score and comment ONLY on what was actually said above. Do not invent additional strengths, "
        "topics, or examples the candidate never mentioned; if there's too little to judge a dimension "
        "fairly, score it conservatively low rather than guessing generously.\n"
        if len(real_answers) < 3 else ""
    )
    prompt = REPORT_PROMPT_TEMPLATE.format(
        role=role, level=level or "fresher", transcript=transcript + partial_note,
        filler_summary=filler_summary or "negligible",
        profile_line=_profile_line(profile), anti_slop=ANTI_SLOP_INSTRUCTION,
    )
    report = llm.chat_json(
        llm.system_user("You are a rigorous but fair interview performance evaluator.", prompt),
        temperature=0.4,
        max_tokens=900,
    )

    # Ground communication_score in a real measured signal instead of leaving it
    # purely up to the LLM's guess: blend its qualitative judgment (70%) with a
    # rule-based penalty derived from the actual filler-word ratio (30%), so two
    # transcripts with identical LLM-perceived "clarity" but very different real
    # filler-word usage don't score identically.
    llm_comm = report.get("communication_score")
    if isinstance(llm_comm, (int, float)) and filler_ratio is not None:
        # 0% filler -> full marks on this component; >=15% filler -> 0 on this component.
        filler_component = max(0, 100 - min(filler_ratio / 0.15, 1.0) * 100)
        blended = round(0.7 * llm_comm + 0.3 * filler_component)
        report["communication_score"] = max(0, min(100, blended))

    return report
