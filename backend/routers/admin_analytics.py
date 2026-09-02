"""Admin-only trend/analytics endpoints — daily activity, solve-rate trend,
and readiness distribution over time, layered on top of the existing
snapshot-only /api/admin/overview. Same passcode gate and rate-limit bucket
as routers/admin.py (see that module's docstring for the rationale behind
duplicating `_check_passcode` per router instead of sharing it)."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query, Request

import config
from core import rate_limit, runtime_settings, storage

router = APIRouter()


def _check_passcode(x_admin_passcode: str, request: Request) -> None:
    rate_limit.enforce("admin-auth", request, config.ADMIN_AUTH_RATE_LIMIT, config.ADMIN_AUTH_RATE_WINDOW_SECS)
    if not x_admin_passcode or x_admin_passcode != runtime_settings.effective_admin_passcode():
        raise HTTPException(status_code=401, detail="Incorrect admin passcode.")


@router.get("/activity")
def activity_trend(
    request: Request, days: int = Query(default=14, ge=1, le=90), x_admin_passcode: str = Header(default="")
):
    _check_passcode(x_admin_passcode, request)
    return storage.activity_trend(days)


@router.get("/solve-rate")
def solve_rate_trend(
    request: Request, days: int = Query(default=14, ge=1, le=90), x_admin_passcode: str = Header(default="")
):
    _check_passcode(x_admin_passcode, request)
    return storage.solve_rate_trend(days)


@router.get("/readiness")
def readiness_distribution(request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    return storage.readiness_distribution()
