"""Business logic for the Technical Interview module: a DSA coding judge
(curated question bank + local sandboxed execution) and a CS-fundamentals
concept Q&A round (curated bank + optional AI-generated extra questions),
following the same 'curated first, generative on top' philosophy as the
Roadmap Generator."""
from __future__ import annotations

import json
import os
import random
import tempfile

import config
from core import llm
from core.llm import ANTI_SLOP_INSTRUCTION

# mtime-keyed cache: {path: (mtime, parsed_data)}. These banks are re-read
# on every call by design (so the admin question-bank editor's edits apply
# live, no restart - see _atomic_write_json's docstring), but under normal
# traffic the file doesn't change between requests, so re-parsing tens/
# hundreds of KB of JSON on every single question pick is pure waste. This
# keeps the "live edit" guarantee (an mtime bump - from the atomic
# temp-file-then-replace write - is always a cache miss) while skipping the
# reparse for the common case of no change.
_json_cache: dict[str, tuple[float, list[dict]]] = {}


def _load_json_cached(path) -> list[dict]:
    key = str(path)
    mtime = os.path.getmtime(path)
    cached = _json_cache.get(key)
    if cached is not None and cached[0] == mtime:
        return list(cached[1])  # shallow copy - callers shuffle/filter their own list in place
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    _json_cache[key] = (mtime, data)
    return list(data)


def load_dsa_questions() -> list[dict]:
    return _load_json_cached(config.DATA_DIR / "dsa_questions.json")


def _atomic_write_json(path, data) -> None:
    """Writes JSON via a temp file + os.replace so a crash or a concurrent
    read (load_dsa_questions()/load_topic_questions() re-read the file fresh
    on every single request - no caching) never observes a partially-written
    question bank. Used by the admin question-bank editor (see
    routers/admin_questions.py) so edits take effect immediately, with no
    server restart, the same live-effective philosophy as
    core/runtime_settings.py."""
    fd, tmp_path = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        os.replace(tmp_path, path)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


def save_dsa_questions(questions: list[dict]) -> None:
    _atomic_write_json(config.DATA_DIR / "dsa_questions.json", questions)


def save_topic_questions(questions: list[dict]) -> None:
    _atomic_write_json(config.DATA_DIR / "topic_questions.json", questions)


def load_topic_questions() -> list[dict]:
    return _load_json_cached(config.DATA_DIR / "topic_questions.json")


def dsa_topics() -> list[str]:
    return sorted({q["topic"] for q in load_dsa_questions()})


def dsa_companies() -> list[str]:
    """Distinct companies tagged across the DSA bank - powers the company
    filter, the campus-placement-tool feature students expect most."""
    companies: set[str] = set()
    for q in load_dsa_questions():
        companies.update(q.get("companies", []))
    return sorted(companies)


def concept_topics() -> list[str]:
    return sorted({q["topic"] for q in load_topic_questions()})


def pick_dsa_question(
    topic: str | None, difficulty: str | None, exclude_ids: set[str], company: str | None = None
) -> dict | None:
    """Picks a question matching the requested topic/difficulty/company as
    closely as possible. The three filters used to be a strict AND with no
    fallback, so any combination the curated bank didn't happen to cover
    (e.g. a niche topic + a specific company + Hard) dead-ended into "no
    questions match" even though plenty of questions existed for that topic
    alone. Instead, relax filters one at a time -- company first (the
    narrowest, least essential dimension for practice purposes), then
    difficulty, then finally topic -- so a student always gets SOME question
    rather than an error. If the exact combination wasn't available, the
    returned dict carries a `match_note` explaining what was relaxed, so the
    UI can be upfront about it instead of silently substituting."""
    pool = load_dsa_questions()
    if not pool:
        return None

    def _apply(use_topic: bool, use_difficulty: bool, use_company: bool) -> list[dict]:
        out = pool
        if use_topic and topic and topic != "Any":
            out = [q for q in out if q["topic"] == topic]
        if use_difficulty and difficulty and difficulty != "Any":
            out = [q for q in out if q["difficulty"] == difficulty]
        if use_company and company and company != "Any":
            out = [q for q in out if company in q.get("companies", [])]
        return out

    tiers = [(True, True, True), (True, True, False), (True, False, False), (False, False, False)]
    chosen: list[dict] | None = None
    tier_used = tiers[0]
    for tier in tiers:
        candidate = _apply(*tier)
        if candidate:
            chosen, tier_used = candidate, tier
            break
    if not chosen:
        return None

    filtered = [q for q in chosen if q["id"] not in exclude_ids] or chosen
    picked = dict(random.choice(filtered))

    if tier_used != (True, True, True):
        use_topic, use_difficulty, use_company = tier_used
        missed = []
        if not use_company and company and company != "Any":
            missed.append(f"asked at {company}")
        if not use_difficulty and difficulty and difficulty != "Any":
            missed.append(f"{difficulty} difficulty")
        if not use_topic and topic and topic != "Any":
            missed.append(f"the {topic} topic")
        if missed:
            picked["match_note"] = (
                f"No exact match for {', '.join(missed)} yet - showing the closest available question instead."
            )
    return picked


def get_dsa_question_by_id(question_id: str) -> dict | None:
    """Fetch one specific question by id - used to reopen a bookmarked
    question directly, rather than the random-pick-with-filters flow
    pick_dsa_question uses for a fresh practice round."""
    for q in load_dsa_questions():
        if q["id"] == question_id:
            return q
    return None


def get_dsa_questions_by_ids(question_ids: list[str]) -> list[dict]:
    """Bulk lookup, order-preserving vs. `question_ids` (most-recently-
    bookmarked first, since callers pass ids in that order) - powers the
    "Bookmarked questions" panel without one request per question."""
    by_id = {q["id"]: q for q in load_dsa_questions()}
    return [by_id[qid] for qid in question_ids if qid in by_id]


def pick_contest_set(company: str | None, num_questions: int) -> list[dict]:
    """Pick a small, distinct, difficulty-spread set of DSA questions for a
    timed contest round, optionally filtered to one company's tagged bank."""
    pool = load_dsa_questions()
    if company and company != "Any":
        pool = [q for q in pool if company in q.get("companies", [])]
    if not pool:
        pool = load_dsa_questions()
    random.shuffle(pool)
    # Prefer an easy-to-hard spread when there's enough variety, otherwise
    # just take whatever's available.
    by_diff = {"Easy": [], "Medium": [], "Hard": []}
    for q in pool:
        by_diff.setdefault(q["difficulty"], []).append(q)
    ordered = by_diff.get("Easy", []) + by_diff.get("Medium", []) + by_diff.get("Hard", [])
    seen_ids: set[str] = set()
    picked: list[dict] = []
    for q in ordered:
        if q["id"] in seen_ids:
            continue
        seen_ids.add(q["id"])
        picked.append(q)
        if len(picked) >= num_questions:
            break
    return picked


def build_quiz(topics: list[str], num_questions: int) -> list[dict]:
    pool = load_topic_questions()
    if topics:
        pool = [q for q in pool if q["topic"] in topics]
    random.shuffle(pool)
    return pool[:num_questions]


def evaluate_short_answer(question: str, reference_answer: str, user_answer: str) -> dict:
    """Semantic grading for free-text conceptual answers, since exact string
    matching is useless for open-ended CS questions."""
    prompt = f"""Question: {question}
Reference/model answer: {reference_answer}
Candidate's answer: {user_answer}

Grade the candidate's answer for correctness and completeness compared to the reference answer. \
Minor wording differences are fine; focus on whether the core concept is understood. Use the full 0-100 \
range - an answer that's mostly wrong or off-topic should score below 30, a partially correct answer \
40-70 depending on how much is missing, only a genuinely complete and accurate answer above 85.

Return ONLY a JSON object:
{{"correct": <true if substantially correct, false otherwise>, "score": <0-100 integer>, "feedback": "<1-2 sentence specific feedback - name what was right or wrong, not a generic verdict>"}}
{ANTI_SLOP_INSTRUCTION}"""
    return llm.chat_json(
        llm.system_user("You are a fair, precise technical interviewer grading conceptual answers.", prompt),
        temperature=0.2,
        max_tokens=300,
    )


def code_review_feedback(question_title: str, description: str, student_code: str, all_passed: bool) -> str:
    prompt = f"""Problem: {question_title}
Description: {description}
Student's solution:
```python
{student_code}
```
Test result: {"all test cases PASSED" if all_passed else "some test cases FAILED"}

Give brief, specific feedback (3-5 sentences max): comment on their approach, time/space complexity, \
code style, and one concrete suggestion for improvement (even if all tests passed, suggest an optimization \
or edge case to consider if one exists). Be direct and technical, not generic praise.
{ANTI_SLOP_INSTRUCTION}"""
    return llm.chat(
        llm.system_user("You are a senior software engineer giving code review feedback in a mock technical interview.", prompt),
        temperature=0.4,
        max_tokens=350,
    ).strip()


def generate_bonus_question(topic: str, difficulty: str = "Medium") -> dict | None:
    """Optional: ask the LLM for one extra conceptual question beyond the curated bank,
    in the same schema as data/topic_questions.json, so the quiz never runs dry."""
    prompt = f"""Generate ONE {difficulty}-difficulty interview question about the topic "{topic}", \
suitable for a campus placement technical interview. Prefer a short-answer conceptual question over MCQ.

Return ONLY a JSON object:
{{"topic": "{topic}", "type": "short_answer", "difficulty": "{difficulty}", "question": "<question text>", "answer": "<model answer, 2-4 sentences>", "explanation": "<why this matters / what it tests, 1 sentence>"}}
{ANTI_SLOP_INSTRUCTION}"""
    try:
        q = llm.chat_json(llm.system_user("You are an expert CS interview question setter.", prompt), temperature=0.8, max_tokens=400)
        q["id"] = f"gen-{random.randint(10000, 99999)}"
        return q
    except Exception:
        return None
