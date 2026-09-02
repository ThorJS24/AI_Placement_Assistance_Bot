"""Resume Builder & Analyzer endpoints."""
from __future__ import annotations

import os

from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

import config
from core import llm, rate_limit, resume_parser, resume_writer, storage, validation
from modules import resume_builder as rb

router = APIRouter()

_FIELD = config.MAX_TEXT_FIELD_CHARS


class ExperienceEntry(BaseModel):
    role: str = Field("", max_length=_FIELD)
    company: str = Field("", max_length=_FIELD)
    duration: str = Field("", max_length=_FIELD)
    bullets: list[str] = Field(default_factory=list, max_length=config.MAX_LIST_ITEMS)

    @field_validator("bullets")
    @classmethod
    def _cap_bullets(cls, v):
        return validation.cap_list(v)


class ProjectEntry(BaseModel):
    title: str = Field("", max_length=_FIELD)
    tech: str = Field("", max_length=_FIELD)
    bullets: list[str] = Field(default_factory=list, max_length=config.MAX_LIST_ITEMS)

    @field_validator("bullets")
    @classmethod
    def _cap_bullets(cls, v):
        return validation.cap_list(v)


class EducationEntry(BaseModel):
    degree: str = Field("", max_length=_FIELD)
    institution: str = Field("", max_length=_FIELD)
    duration: str = Field("", max_length=_FIELD)
    score: str = Field("", max_length=_FIELD)


class ResumeBuildRequest(BaseModel):
    full_name: str = Field("", max_length=_FIELD)
    email: str = Field("", max_length=_FIELD)
    phone: str = Field("", max_length=_FIELD)
    location: str = Field("", max_length=_FIELD)
    linkedin: str = Field("", max_length=_FIELD)
    github: str = Field("", max_length=_FIELD)
    target_role: str = Field("", max_length=_FIELD)
    years_context: str = Field("", max_length=config.MAX_LONG_TEXT_CHARS)
    skills: list[str] = Field(default_factory=list, max_length=config.MAX_LIST_ITEMS)
    experience: list[ExperienceEntry] = Field(default_factory=list, max_length=config.MAX_LIST_ITEMS)
    projects: list[ProjectEntry] = Field(default_factory=list, max_length=config.MAX_LIST_ITEMS)
    education: list[EducationEntry] = Field(default_factory=list, max_length=config.MAX_LIST_ITEMS)
    certifications: list[str] = Field(default_factory=list, max_length=config.MAX_LIST_ITEMS)
    use_ai: bool = True

    @field_validator("skills", "certifications")
    @classmethod
    def _cap_lists(cls, v):
        return validation.cap_list(v)


@router.post("/build")
def build_resume(
    req: ResumeBuildRequest, request: Request,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    rate_limit.enforce("resume-build", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    summary = ""
    experience = [e.model_dump() for e in req.experience]
    projects = [p.model_dump() for p in req.projects]
    ai_warning = None

    if req.use_ai:
        try:
            profile = storage.get_student_profile(x_student_name, x_student_pin)
            summary = rb.generate_summary(req.full_name, req.target_role, req.skills, req.years_context, profile)
            for e in experience:
                e["bullets"] = rb.enhance_bullets(f"{e['role']} at {e['company']}", e["bullets"])
            for p in projects:
                p["bullets"] = rb.enhance_bullets(f"project: {p['title']}", p["bullets"])
        except llm.LLMUnavailableError as exc:
            ai_warning = str(exc)

    data = {
        "full_name": req.full_name, "email": req.email, "phone": req.phone, "location": req.location,
        "linkedin": req.linkedin, "github": req.github, "summary": summary, "skills": req.skills,
        "experience": experience, "projects": projects,
        "education": [e.model_dump() for e in req.education], "certifications": req.certifications,
        # Also mirrored into the payload (not just the `resumes.target_role` column)
        # so a saved draft can be fully reloaded into the builder form later.
        "target_role": req.target_role, "years_context": req.years_context, "use_ai": req.use_ai,
    }

    docx_path = resume_writer.build_docx(data)
    pdf_path = resume_writer.build_pdf(data)
    resume_id = storage.save_resume(
        req.full_name, req.target_role, data, docx_path, student_name=x_student_name, pin=x_student_pin
    )

    return {
        "resume_id": resume_id,
        "summary": summary,
        "ai_warning": ai_warning,
        "download_docx": f"/api/resume/download/{os.path.basename(docx_path)}",
        "download_pdf": f"/api/resume/download/{os.path.basename(pdf_path)}",
    }


@router.get("/download/{filename}")
def download_resume(filename: str):
    # Guard against path traversal — only allow serving exactly what's in GENERATED_DIR.
    safe_name = os.path.basename(filename)
    path = config.GENERATED_DIR / safe_name
    if not path.is_file() or path.parent != config.GENERATED_DIR:
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(path, filename=safe_name)


@router.get("/list")
def list_saved_resumes(x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    """This student's previously built resume drafts — powers the "My saved
    resumes" panel so a student can come back and re-edit one later."""
    return storage.list_resumes(student_name=x_student_name, pin=x_student_pin)


@router.get("/{resume_id}")
def get_saved_resume(resume_id: int, x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    resume = storage.get_resume(resume_id, student_name=x_student_name, pin=x_student_pin)
    if resume is None:
        raise HTTPException(status_code=404, detail="Saved resume not found.")
    return resume


@router.delete("/{resume_id}")
def delete_saved_resume(resume_id: int, x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    storage.delete_resume(resume_id, student_name=x_student_name, pin=x_student_pin)
    return {"ok": True}


@router.post("/analyze")
async def analyze_resume(
    request: Request, file: UploadFile = File(...), job_description: str = Form(""),
    x_student_name: str = Header(default="Guest"),
):
    rate_limit.enforce("resume-analyze", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    try:
        file_bytes = await validation.enforce_upload_size(file)
        text = resume_parser.extract_text(file_bytes, file.filename or "resume.pdf")
        if not text.strip():
            raise HTTPException(
                status_code=422,
                detail="Couldn't extract any text from this file — it may be a scanned image. "
                "Try a text-based PDF or DOCX.",
            )
        return rb.analyze_resume(text, validation.cap_text(job_description, config.MAX_LONG_TEXT_CHARS))
    except llm.LLMUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
