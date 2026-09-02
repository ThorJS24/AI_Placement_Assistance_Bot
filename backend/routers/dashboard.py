"""Home dashboard endpoint."""
from __future__ import annotations

from fastapi import APIRouter

from core import storage

router = APIRouter()


@router.get("/counts")
def counts():
    return storage.dashboard_counts()
