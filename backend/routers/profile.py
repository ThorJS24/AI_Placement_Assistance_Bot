"""Student academic profile - stream/branch, specialization/honours,
semester, and this semester's subjects. Feeds into the chatbot's system
prompt and pre-fills the Roadmap Generator; also read by the admin
dashboard. See core/storage.py's profile section for the persistence
model and its relationship to the name+PIN identity system."""
from __future__ import annotations

from fastapi import APIRouter, Header
from pydantic import BaseModel

from core import storage

router = APIRouter()


class ProfileRequest(BaseModel):
    stream: str = ""
    specialization: str = ""
    semester: str = ""
    subjects: list[str] = []
    pin: str = ""  # lets the profile form also set/confirm a PIN in one save


@router.get("")
def get_profile(x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")):
    return storage.get_student_profile(x_student_name, x_student_pin)


@router.post("")
def save_profile(
    req: ProfileRequest, x_student_name: str = Header(default="Guest"), x_student_pin: str = Header(default="")
):
    pin_for_resolution = req.pin.strip() or x_student_pin
    storage.save_student_profile(
        x_student_name, pin_for_resolution,
        stream=req.stream.strip()[:80] or None,
        specialization=req.specialization.strip()[:80] or None,
        semester=req.semester.strip()[:20] or None,
        subjects=req.subjects,
    )
    return storage.get_student_profile(x_student_name, pin_for_resolution)
