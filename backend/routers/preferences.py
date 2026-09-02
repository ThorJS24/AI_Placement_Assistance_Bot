"""Per-student UI appearance preferences - color theme, dark/light, font
size, density, and sidebar layout. Applied instantly client-side via
localStorage (see frontend/src/lib/preferences.js) and persisted here so a
student's chosen look follows them across devices/browsers, not just one
machine's local storage. See core/storage.py's preferences section for the
persistence model - same lightweight name+PIN identity as routers/profile.py,
not real authentication."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Header
from pydantic import BaseModel

from core import storage

router = APIRouter()


class PreferencesRequest(BaseModel):
    color_theme: Literal["default", "ocean", "forest", "crimson"] | None = None
    dark_mode: Literal["light", "dark"] | None = None
    font_size: Literal["sm", "md", "lg"] | None = None
    density: Literal["comfortable", "compact"] | None = None
    sidebar_collapsed: bool | None = None


@router.get("")
def get_preferences(x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    return storage.get_student_preferences(x_student_name, x_student_pin)


@router.patch("")
def update_preferences(
    req: PreferencesRequest, x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")
):
    return storage.save_student_preferences(x_student_name, x_student_pin, req.model_dump())
