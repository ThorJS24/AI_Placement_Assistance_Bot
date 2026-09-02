"""Admin-only CRUD for the two curated question banks (DSA coding problems
and the CS-fundamentals quiz bank) - lets the TPO/placement cell add,
edit, and remove questions from the dashboard instead of hand-editing
backend/data/dsa_questions.json / topic_questions.json directly.

Same passcode gate and rate-limit bucket as routers/admin.py and
routers/settings.py (see each module's own `_check_passcode` - duplicated
by convention in this codebase rather than shared, so each router stays
self-contained). Writes go through modules/technical_interview.py's
atomic-write helpers, and take effect immediately since
load_dsa_questions()/load_topic_questions() re-read the file fresh on
every request - no cache to invalidate, no restart needed.
"""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator

import config
from core import rate_limit, runtime_settings
from modules import technical_interview as ti

router = APIRouter()


def _check_passcode(x_admin_passcode: str, request: Request) -> None:
    rate_limit.enforce("admin-auth", request, config.ADMIN_AUTH_RATE_LIMIT, config.ADMIN_AUTH_RATE_WINDOW_SECS)
    if not x_admin_passcode or x_admin_passcode != runtime_settings.effective_admin_passcode():
        raise HTTPException(status_code=401, detail="Incorrect admin passcode.")


def _clean_str_list(items: list[str] | None, max_chars: int = 200) -> list[str]:
    return [item.strip()[:max_chars] for item in (items or []) if item and item.strip()]


# ---------------------------------------------------------------------------
# DSA question bank
# ---------------------------------------------------------------------------

class DsaTestCaseIn(BaseModel):
    input: str = Field(default="", max_length=5000)
    expected: str = Field(default="", max_length=5000)


class DsaQuestionIn(BaseModel):
    id: str = Field(min_length=1, max_length=40, pattern=r"^[a-zA-Z0-9_-]+$")
    topic: str = Field(min_length=1, max_length=60)
    difficulty: Literal["Easy", "Medium", "Hard"]
    companies: list[str] = Field(default_factory=list, max_length=20)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=4000)
    input_format: str = Field(default="", max_length=2000)
    output_format: str = Field(default="", max_length=2000)
    starter_code: str = Field(default="", max_length=4000)
    hints: list[str] = Field(default_factory=list, max_length=10)
    test_cases: list[DsaTestCaseIn] = Field(min_length=1, max_length=50)

    @field_validator("companies", "hints")
    @classmethod
    def _clean_lists(cls, v):
        return _clean_str_list(v)


@router.get("/dsa")
def list_dsa_questions(request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    return ti.load_dsa_questions()


@router.post("/dsa")
def create_dsa_question(req: DsaQuestionIn, request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    questions = ti.load_dsa_questions()
    if any(q["id"] == req.id for q in questions):
        raise HTTPException(status_code=409, detail=f"A DSA question with id '{req.id}' already exists.")
    questions.append(req.model_dump())
    ti.save_dsa_questions(questions)
    return {"ok": True}


@router.patch("/dsa/{question_id}")
def update_dsa_question(
    question_id: str, req: DsaQuestionIn, request: Request, x_admin_passcode: str = Header(default="")
):
    _check_passcode(x_admin_passcode, request)
    questions = ti.load_dsa_questions()
    idx = next((i for i, q in enumerate(questions) if q["id"] == question_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="DSA question not found.")
    if req.id != question_id and any(q["id"] == req.id for q in questions):
        raise HTTPException(status_code=409, detail=f"A DSA question with id '{req.id}' already exists.")
    questions[idx] = req.model_dump()
    ti.save_dsa_questions(questions)
    return {"ok": True}


@router.delete("/dsa/{question_id}")
def delete_dsa_question(question_id: str, request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    questions = ti.load_dsa_questions()
    remaining = [q for q in questions if q["id"] != question_id]
    if len(remaining) == len(questions):
        raise HTTPException(status_code=404, detail="DSA question not found.")
    ti.save_dsa_questions(remaining)
    return {"ok": True}


# ---------------------------------------------------------------------------
# CS-fundamentals quiz bank
# ---------------------------------------------------------------------------

class QuizQuestionIn(BaseModel):
    id: str = Field(min_length=1, max_length=40, pattern=r"^[a-zA-Z0-9_-]+$")
    topic: str = Field(min_length=1, max_length=60)
    type: Literal["mcq", "short_answer"]
    difficulty: Literal["Easy", "Medium", "Hard"]
    question: str = Field(min_length=1, max_length=2000)
    options: list[str] | None = Field(default=None, max_length=10)
    answer: str = Field(min_length=1, max_length=2000)
    explanation: str = Field(default="", max_length=2000)

    @field_validator("options")
    @classmethod
    def _clean_options(cls, v):
        return _clean_str_list(v, max_chars=500) if v else v

    @model_validator(mode="after")
    def _validate_mcq_shape(self):
        if self.type == "mcq":
            if not self.options or len(self.options) < 2:
                raise ValueError("MCQ questions need at least 2 options.")
            if self.answer not in self.options:
                raise ValueError("The answer must be exactly one of the provided options.")
        return self


@router.get("/quiz")
def list_quiz_questions(request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    return ti.load_topic_questions()


@router.post("/quiz")
def create_quiz_question(req: QuizQuestionIn, request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    questions = ti.load_topic_questions()
    if any(q["id"] == req.id for q in questions):
        raise HTTPException(status_code=409, detail=f"A quiz question with id '{req.id}' already exists.")
    questions.append(req.model_dump())
    ti.save_topic_questions(questions)
    return {"ok": True}


@router.patch("/quiz/{question_id}")
def update_quiz_question(
    question_id: str, req: QuizQuestionIn, request: Request, x_admin_passcode: str = Header(default="")
):
    _check_passcode(x_admin_passcode, request)
    questions = ti.load_topic_questions()
    idx = next((i for i, q in enumerate(questions) if q["id"] == question_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Quiz question not found.")
    if req.id != question_id and any(q["id"] == req.id for q in questions):
        raise HTTPException(status_code=409, detail=f"A quiz question with id '{req.id}' already exists.")
    questions[idx] = req.model_dump()
    ti.save_topic_questions(questions)
    return {"ok": True}


@router.delete("/quiz/{question_id}")
def delete_quiz_question(question_id: str, request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    questions = ti.load_topic_questions()
    remaining = [q for q in questions if q["id"] != question_id]
    if len(remaining) == len(questions):
        raise HTTPException(status_code=404, detail="Quiz question not found.")
    ti.save_topic_questions(remaining)
    return {"ok": True}
