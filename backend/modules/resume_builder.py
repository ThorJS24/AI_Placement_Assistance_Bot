"""Business logic for the Resume Builder & Analyzer module."""
from __future__ import annotations

from core import llm, utils
from core.llm import ANTI_SLOP_INSTRUCTION


def _profile_context(profile: dict | None) -> str:
    """Turn a student academic profile into a short natural-language clause
    the LLM can ground the summary in, so it's not writing in a vacuum."""
    if not profile:
        return ""
    bits = []
    if profile.get("stream"):
        bits.append(profile["stream"])
    if profile.get("specialization"):
        bits.append(f"specializing in {profile['specialization']}")
    if profile.get("semester"):
        bits.append(f"currently in semester {profile['semester']}")
    subjects = profile.get("subjects") or []
    if subjects:
        bits.append(f"coursework includes {', '.join(subjects[:6])}")
    return ("Student's academic background: " + ", ".join(bits) + ". ") if bits else ""


def enhance_bullets(context_label: str, bullets: list[str]) -> list[str]:
    """Rewrite a list of raw bullet points into strong, ATS-friendly resume bullets
    (action verb + what was done + measurable impact where possible)."""
    bullets = [b.strip() for b in bullets if b.strip()]
    if not bullets:
        return []

    prompt = (
        f"Rewrite the following resume bullet points for a '{context_label}' entry so each one:\n"
        "- starts with a strong action verb\n"
        "- is specific and concise (one line, no more than ~20 words)\n"
        "- quantifies impact/scale wherever plausible (%, time saved, users, size) - but NEVER invent "
        "numbers that weren't implied by the original text\n"
        "- avoids first-person pronouns and generic filler ('worked on', 'helped with', 'responsible for')\n\n"
        f"{ANTI_SLOP_INSTRUCTION}\n\n"
        "Return ONLY a JSON array of strings, one per improved bullet, same order, same count as input.\n\n"
        f"Original bullets:\n{chr(10).join('- ' + b for b in bullets)}"
    )
    try:
        result = llm.chat_json(llm.system_user("You are an expert technical resume writer.", prompt))
        if isinstance(result, list) and all(isinstance(x, str) for x in result) and len(result) == len(bullets):
            return result
    except Exception:
        pass
    return bullets  # graceful fallback: keep originals if the model output couldn't be parsed


def generate_summary(
    full_name: str, target_role: str, skills: list[str], years_context: str, profile: dict | None = None
) -> str:
    prompt = (
        f"Write a 2-3 sentence professional summary for a resume, for someone targeting the role "
        f"'{target_role or 'an entry-level software/tech role'}'. Context: {years_context or 'final-year student / recent graduate'}. "
        f"{_profile_context(profile)}"
        f"Key skills to weave in naturally: {', '.join(skills[:8]) if skills else 'general technical skills'}. "
        "Write in third-person-omitted resume style (no 'I'), confident but not exaggerated. "
        "Ground it in the actual skills/background given - do not pad with generic claims that could describe any candidate. "
        f"{ANTI_SLOP_INSTRUCTION}\n"
        "Return ONLY the summary text, no preamble, no quotes."
    )
    return llm.chat(llm.system_user("You are an expert technical resume writer.", prompt), temperature=0.6, max_tokens=200).strip()


ANALYSIS_SCHEMA_PROMPT = """Analyze the resume text below{jd_clause}.

Return ONLY a JSON object with exactly these keys:
{{
  "ats_score": <integer 0-100, how well-structured and keyword-optimized this resume is for ATS systems>,
  "strengths": [<3-5 short strings>],
  "weaknesses": [<3-5 short strings>],
  "missing_keywords": [<up to 8 short strings - skills/terms likely expected but absent; empty list if no job description was given>],
  "section_feedback": {{"summary": "<1 sentence>", "skills": "<1 sentence>", "experience_or_projects": "<1 sentence>", "education": "<1 sentence>"}},
  "top_action_items": [<3-5 short, concrete, actionable strings - what to fix first>]
}}

Use the FULL 0-100 range for ats_score - a genuinely weak, generic, unquantified resume should score below 40, an average one 50-70, only a genuinely strong, well-structured, quantified one should score above 85. Do not default to a comfortable 70-80 band regardless of quality.
{anti_slop}

Resume text:
---
{resume_text}
---
{jd_block}"""


def analyze_resume(resume_text: str, job_description: str = "") -> dict:
    resume_text = utils.truncate(resume_text, 6000)
    jd_clause = " against the target job description provided" if job_description.strip() else ""
    jd_block = f"\nTarget job description:\n---\n{utils.truncate(job_description, 2000)}\n---" if job_description.strip() else ""
    prompt = ANALYSIS_SCHEMA_PROMPT.format(
        jd_clause=jd_clause, resume_text=resume_text, jd_block=jd_block, anti_slop=ANTI_SLOP_INSTRUCTION
    )
    return llm.chat_json(
        llm.system_user(
            "You are a strict, expert technical recruiter and ATS specialist. Be honest and specific, not generic - "
            "vague praise or vague criticism is worse than useless to the candidate.",
            prompt,
        ),
        temperature=0.3,
        max_tokens=1200,
    )
