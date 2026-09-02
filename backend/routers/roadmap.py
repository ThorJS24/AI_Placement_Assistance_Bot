"""Roadmap Generator endpoints."""
from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import config
from core import llm, rate_limit, report_pdf, roadmap_ai_image, roadmap_image, storage
from modules import roadmap_generator as rg

router = APIRouter()


@router.get("/templates")
def templates():
    return rg.list_template_roles()


class RoadmapRequest(BaseModel):
    target_role: str = Field(max_length=config.MAX_TEXT_FIELD_CHARS)
    current_level: str = Field("", max_length=config.MAX_TEXT_FIELD_CHARS)
    timeframe: str = Field("3 months", max_length=config.MAX_TEXT_FIELD_CHARS)
    focus_notes: str = Field("", max_length=config.MAX_LONG_TEXT_CHARS)


@router.post("/generate")
def generate(
    req: RoadmapRequest, request: Request,
    x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default=""),
):
    rate_limit.enforce("roadmap-generate", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    try:
        profile = storage.get_student_profile(x_student_name, x_student_pin)
        stats = storage.technical_stats(x_student_name, x_student_pin)
        weak_topics = [
            t["name"] for t in sorted(stats.get("by_topic", []), key=lambda t: t["solve_rate"])
            if t["total"] >= 2 and t["solve_rate"] < 50
        ][:3]
        roadmap = rg.generate_roadmap(
            req.target_role, req.current_level, req.timeframe, req.focus_notes,
            profile=profile, weak_topics=weak_topics,
        )
        storage.save_roadmap(req.target_role, req.timeframe, roadmap, student_name=x_student_name, pin=x_student_pin)
        return roadmap
    except llm.LLMUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/history")
def history(x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    return storage.list_roadmaps(student_name=x_student_name, pin=x_student_pin, limit=15)


class RoadmapPdfRequest(BaseModel):
    roadmap: dict


@router.post("/pdf")
def roadmap_pdf(req: RoadmapPdfRequest):
    path = report_pdf.build_roadmap_pdf(req.roadmap)
    return {"download_pdf": f"/api/roadmap/pdf/download/{os.path.basename(path)}"}


@router.get("/pdf/download/{filename}")
def download_roadmap_pdf(filename: str):
    safe_name = os.path.basename(filename)
    path = config.GENERATED_DIR / safe_name
    if not path.is_file() or path.parent != config.GENERATED_DIR:
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(path, filename=safe_name)


class RoadmapImageRequest(BaseModel):
    roadmap: dict


@router.post("/image")
def roadmap_image_export(req: RoadmapImageRequest):
    path = roadmap_image.build_roadmap_image(req.roadmap)
    return {"download_image": f"/api/roadmap/image/download/{os.path.basename(path)}"}


@router.get("/image/download/{filename}")
def download_roadmap_image(filename: str):
    safe_name = os.path.basename(filename)
    path = config.GENERATED_DIR / safe_name
    if not path.is_file() or path.parent != config.GENERATED_DIR:
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(path, filename=safe_name, media_type="image/png")


@router.get("/image/ai-available")
def ai_image_available():
    """Whether the optional AI-illustrated image extra is configured on
    this deployment (see .env.example's IMAGE_GEN_API_KEY) — the frontend
    uses this to decide whether to even show that option."""
    return {"available": roadmap_ai_image.is_configured()}


class RoadmapAiImageRequest(BaseModel):
    roadmap: dict


@router.post("/image/ai")
def roadmap_ai_image_export(req: RoadmapAiImageRequest, request: Request, x_student_name: str = Header(default="Guest")):
    rate_limit.enforce("roadmap-ai-image", request, config.LLM_ACTION_RATE_LIMIT, config.LLM_ACTION_RATE_WINDOW_SECS, x_student_name)
    try:
        path = roadmap_ai_image.build_ai_illustration(
            req.roadmap.get("target_role", ""), req.roadmap.get("overview", "")
        )
    except roadmap_ai_image.ImageGenUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"download_image": f"/api/roadmap/image/download/{os.path.basename(path)}"}
