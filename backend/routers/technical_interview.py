"""Technical Interview endpoints: DSA coding judge (+ company tags and a
timed contest mode) and a CS concept quiz."""
from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import config
from core import code_judge, llm, rate_limit, report_pdf, storage
from modules import technical_interview as ti

router = APIRouter()


# ---------------------------------------------------------------------------
# DSA coding round
# ---------------------------------------------------------------------------

@router.get("/dsa/topics")
def dsa_topics():
    return ti.dsa_topics()


@router.get("/dsa/companies")
def dsa_companies():
    """Distinct companies tagged in the DSA bank (e.g. TCS, Amazon) — powers
    the company filter, mirroring how real campus placement prep tools let
    students target a specific recruiter's question style."""
    return ti.dsa_companies()


class DsaQuestionRequest(BaseModel):
    topic: str = Field("Any", max_length=config.MAX_TEXT_FIELD_CHARS)
    difficulty: str = Field("Any", max_length=config.MAX_TEXT_FIELD_CHARS)
    company: str = Field("Any", max_length=config.MAX_TEXT_FIELD_CHARS)
    exclude_ids: list[str] = Field(default_factory=list, max_length=500)


@router.post("/dsa/question")
def dsa_question(
    req: DsaQuestionRequest, x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")
):
    q = ti.pick_dsa_question(req.topic, req.difficulty, set(req.exclude_ids), company=req.company)
    if not q:
        raise HTTPException(status_code=404, detail="No questions match those filters.")
    session_id = storage.create_interview_session("technical", "DSA", student_name=x_student_name, pin=x_student_pin)
    return {**q, "session_id": session_id}


@router.post("/dsa/question/{question_id}")
def dsa_question_by_id(
    question_id: str, x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")
):
    """Reopen one specific question directly — used by the "Bookmarked
    questions" panel to jump back into a question a student starred
    earlier, instead of the filtered-random flow /dsa/question uses."""
    q = ti.get_dsa_question_by_id(question_id)
    if not q:
        raise HTTPException(status_code=404, detail="That question is no longer available.")
    session_id = storage.create_interview_session("technical", "DSA", student_name=x_student_name, pin=x_student_pin)
    return {**q, "session_id": session_id}


# ---------------------------------------------------------------------------
# Bookmarks — "come back to this one later"
# ---------------------------------------------------------------------------

@router.get("/bookmarks")
def list_bookmarks(x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    ids = storage.list_bookmark_ids(x_student_name, x_student_pin)
    return ti.get_dsa_questions_by_ids(ids)


@router.post("/bookmarks/{question_id}")
def add_bookmark(
    question_id: str, x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")
):
    storage.add_bookmark(x_student_name, x_student_pin, question_id)
    return {"ok": True}


@router.delete("/bookmarks/{question_id}")
def remove_bookmark(
    question_id: str, x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")
):
    storage.remove_bookmark(x_student_name, x_student_pin, question_id)
    return {"ok": True}


class TestCase(BaseModel):
    input: str
    expected: str


class DsaRunRequest(BaseModel):
    code: str = Field(max_length=config.MAX_CODE_BYTES)
    test_cases: list[TestCase] = Field(max_length=50)


@router.post("/dsa/run")
def dsa_run(req: DsaRunRequest, request: Request, x_student_name: str = Header(default="Guest")):
    # Rate limit + size guardrails — this endpoint executes arbitrary student
    # code in a subprocess (see code_judge.py's scope note), so it's worth
    # protecting against a runaway loop hammering it or an accidental
    # giant paste, even on a trusted local department deployment.
    limiter_key = x_student_name or (request.client.host if request.client else "unknown")
    if not rate_limit.allow(limiter_key, config.DSA_RUN_RATE_LIMIT, config.DSA_RUN_RATE_WINDOW_SECS):
        raise HTTPException(
            status_code=429,
            detail=f"Too many runs — please wait a moment. Limit is {config.DSA_RUN_RATE_LIMIT} runs per {config.DSA_RUN_RATE_WINDOW_SECS}s.",
        )
    try:
        code_judge.validate_code_size(req.code)
    except code_judge.CodeTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc))

    result = code_judge.run_against_tests(req.code, [tc.model_dump() for tc in req.test_cases])
    return {
        "compiled": result.compiled,
        "compile_error": result.compile_error,
        "passed_count": result.passed_count,
        "total_count": result.total_count,
        "all_passed": result.all_passed,
        "results": [
            {"input": r.input, "expected": r.expected, "actual": r.actual, "passed": r.passed, "error": r.error}
            for r in result.results
        ],
    }


class DsaLogRequest(BaseModel):
    session_id: int
    title: str
    code: str
    passed: bool
    topic: str = ""
    difficulty: str = ""
    round_type: str = "dsa"


@router.post("/dsa/log")
def dsa_log(req: DsaLogRequest):
    storage.log_qna(
        req.session_id, req.title, req.code, "", req.passed,
        topic=req.topic or None, difficulty=req.difficulty or None,
        round_type=req.round_type if req.round_type in ("dsa", "contest") else "dsa",
    )
    return {"ok": True}


class DsaReviewRequest(BaseModel):
    title: str = Field(max_length=config.MAX_TEXT_FIELD_CHARS)
    description: str = Field(max_length=config.MAX_LONG_TEXT_CHARS)
    code: str = Field(max_length=config.MAX_CODE_BYTES)
    all_passed: bool


@router.post("/dsa/review")
def dsa_review(req: DsaReviewRequest, request: Request, x_student_name: str = Header(default="Guest")):
    rate_limit.enforce("dsa-review", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    try:
        feedback = ti.code_review_feedback(req.title, req.description, req.code, req.all_passed)
        return {"feedback": feedback}
    except llm.LLMUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


# ---------------------------------------------------------------------------
# DSA contest mode — a small, time-boxed set of questions, scored on solves
# + a time bonus, the way an online-assessment round works.
# ---------------------------------------------------------------------------

class ContestStartRequest(BaseModel):
    company: str = "Any"
    num_questions: int = config.CONTEST_DEFAULT_QUESTIONS
    duration_mins: int = config.CONTEST_DEFAULT_MINUTES


@router.post("/contest/start")
def contest_start(
    req: ContestStartRequest, x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")
):
    n = max(1, min(req.num_questions, config.CONTEST_MAX_QUESTIONS))
    questions = ti.pick_contest_set(req.company, n)
    if not questions:
        raise HTTPException(status_code=404, detail="No DSA questions are available for a contest right now.")
    label = f"Contest ({req.company})" if req.company and req.company != "Any" else "Contest"
    session_id = storage.create_interview_session("technical", label, student_name=x_student_name, pin=x_student_pin)
    duration_mins = max(5, min(req.duration_mins, 120))
    return {"session_id": session_id, "questions": questions, "duration_secs": duration_mins * 60}


class ContestResult(BaseModel):
    question_id: str
    title: str
    topic: str = ""
    difficulty: str = ""
    passed: bool
    code: str = ""


class Violation(BaseModel):
    type: str = Field(max_length=60)
    label: str = Field("", max_length=120)
    at: float = 0


class ContestFinishRequest(BaseModel):
    session_id: int
    results: list[ContestResult]
    elapsed_secs: float
    duration_secs: float
    violations: list[Violation] = Field(default_factory=list, max_length=100)


@router.post("/contest/finish")
def contest_finish(req: ContestFinishRequest):
    total = len(req.results) or 1
    solved = sum(1 for r in req.results if r.passed)
    solve_pct = 100 * solved / total
    # Time bonus: finishing well under the allotted time nudges the score up,
    # capped so it can never matter more than actually solving problems.
    time_left_ratio = max(0.0, min(1.0, 1 - (req.elapsed_secs / req.duration_secs))) if req.duration_secs else 0.0
    score = round(min(100.0, solve_pct + (10 * time_left_ratio if solved == total and total else 0)), 1)

    for r in req.results:
        storage.log_qna(
            req.session_id, r.title, r.code, "", r.passed,
            topic=r.topic or None, difficulty=r.difficulty or None, round_type="contest",
        )
    storage.finish_interview_session(
        req.session_id,
        {
            "solved": solved, "total": total, "elapsed_secs": req.elapsed_secs, "duration_secs": req.duration_secs,
            "violations": [v.model_dump() for v in req.violations],
        },
        score,
    )
    return {"score": score, "solved": solved, "total": total}


@router.get("/leaderboard")
def leaderboard():
    """Department-wide DSA leaderboard — a batch-level motivator, deliberately
    not scoped to one student (see storage.leaderboard's docstring)."""
    return storage.leaderboard(limit=10)


# ---------------------------------------------------------------------------
# Concept Q&A round
# ---------------------------------------------------------------------------

@router.get("/quiz/topics")
def quiz_topics():
    return ti.concept_topics()


class QuizBuildRequest(BaseModel):
    topics: list[str] = Field(default_factory=list, max_length=20)
    num_questions: int = Field(6, ge=1, le=20)
    include_ai: bool = True


@router.post("/quiz/build")
def quiz_build(
    req: QuizBuildRequest, request: Request,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    rate_limit.enforce("quiz-build", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    questions = ti.build_quiz(req.topics, req.num_questions)
    if req.include_ai and len(questions) < req.num_questions:
        for _ in range(req.num_questions - len(questions)):
            extra = ti.generate_bonus_question(req.topics[0] if req.topics else "General CS")
            if extra:
                questions.append(extra)
    session_id = storage.create_interview_session(
        "technical", ", ".join(req.topics), student_name=x_student_name, pin=x_student_pin
    )
    return {"questions": questions, "session_id": session_id}


class QuizGradeRequest(BaseModel):
    session_id: int
    question: str = Field(max_length=config.MAX_LONG_TEXT_CHARS)
    reference_answer: str = Field("", max_length=config.MAX_LONG_TEXT_CHARS)
    user_answer: str = Field(max_length=config.MAX_LONG_TEXT_CHARS)
    is_mcq: bool = False
    mcq_correct: bool = False
    explanation: str = Field("", max_length=config.MAX_LONG_TEXT_CHARS)
    topic: str = Field("", max_length=config.MAX_TEXT_FIELD_CHARS)
    difficulty: str = Field("", max_length=config.MAX_TEXT_FIELD_CHARS)


@router.post("/quiz/grade")
def quiz_grade(req: QuizGradeRequest, request: Request, x_student_name: str = Header(default="Guest")):
    if not req.is_mcq:
        rate_limit.enforce("quiz-grade", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    if req.is_mcq:
        correct, feedback = req.mcq_correct, req.explanation
    else:
        try:
            grading = ti.evaluate_short_answer(req.question, req.reference_answer, req.user_answer)
            correct, feedback = bool(grading.get("correct")), grading.get("feedback", "")
        except llm.LLMUnavailableError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

    storage.log_qna(
        req.session_id, req.question, req.user_answer, feedback, correct,
        topic=req.topic or None, difficulty=req.difficulty or None, round_type="quiz",
    )
    return {"correct": correct, "feedback": feedback}


class QuizFinishRequest(BaseModel):
    session_id: int
    score_pct: float
    log: list[dict] = []
    violations: list[Violation] = Field(default_factory=list, max_length=100)


@router.post("/quiz/finish")
def quiz_finish(req: QuizFinishRequest):
    storage.finish_interview_session(
        req.session_id, {"log": req.log, "violations": [v.model_dump() for v in req.violations]}, req.score_pct
    )
    return {"ok": True}


@router.get("/stats")
def stats(x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    """Personal solve-rate dashboard: overall + broken down by topic and
    difficulty across the DSA, quiz, and contest rounds, plus a recent timeline."""
    return storage.technical_stats(student_name=x_student_name, pin=x_student_pin)


@router.post("/stats/pdf")
def stats_pdf(x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    """Export this student's own solve-rate breakdown as a PDF — a printable
    record to bring to a placement drive, mirroring the resume/roadmap/
    interview-report export pattern (this was previously the only module
    with saved history and no export option)."""
    student_stats = storage.technical_stats(student_name=x_student_name, pin=x_student_pin)
    path = report_pdf.build_technical_stats_pdf(x_student_name or "Guest", student_stats)
    return {"download_pdf": f"/api/technical/stats/pdf/download/{os.path.basename(path)}"}


@router.get("/stats/pdf/download/{filename}")
def download_stats_pdf(filename: str):
    safe_name = os.path.basename(filename)
    path = config.GENERATED_DIR / safe_name
    if not path.is_file() or path.parent != config.GENERATED_DIR:
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(path, filename=safe_name)
