"""TPO / placement-cell admin dashboard endpoints.

Gated by a single shared passcode sent as the X-Admin-Passcode header -
proportionate to a local single-machine deployment, not a real multi-user
auth system. The effective passcode is whatever's been set from the
Settings page, falling back to config.ADMIN_PASSCODE (.env) if it was
never changed - see core/runtime_settings.py. Every endpoint here reads
department-wide data across all students; nothing here is scoped to one
student_name the way the rest of the API is.
"""
from __future__ import annotations

import csv
import io
import os

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

import config
from core import rate_limit, report_pdf, runtime_settings, storage

router = APIRouter()


def _check_passcode(x_admin_passcode: str, request: Request) -> None:
    # Rate-limited by IP (not by the passcode itself - a wrong guess has no
    # student name attached) so a brute-force script can't iterate passcodes
    # quickly against an endpoint that's directly linked from every page's
    # sidebar.
    rate_limit.enforce("admin-auth", request, config.ADMIN_AUTH_RATE_LIMIT, config.ADMIN_AUTH_RATE_WINDOW_SECS)
    if not x_admin_passcode or x_admin_passcode != runtime_settings.effective_admin_passcode():
        raise HTTPException(status_code=401, detail="Incorrect admin passcode.")


@router.post("/login")
def login(request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    return {"ok": True}


@router.get("/overview")
def overview(request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    return {
        "department_name": runtime_settings.effective_department_name(),
        "counts": storage.dashboard_counts(),
        "students": storage.admin_overview(),
        "leaderboard": storage.leaderboard(10),
    }


@router.get("/export.csv")
def export_csv(request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    students = storage.admin_overview()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Student", "Stream", "Specialization", "Semester", "Resumes", "Roadmaps",
                      "DSA/Quiz Attempts", "DSA/Quiz Correct", "Solve Rate %", "Mock Interviews",
                      "Mock Avg Score", "Readiness", "Last Active (unix)"])
    for s in students:
        tech = s.get("technical", {})
        mock = s.get("mock", {})
        writer.writerow([
            s.get("name"), s.get("stream", ""), s.get("specialization", ""), s.get("semester", ""),
            s.get("resumes_count", 0), s.get("roadmaps_count", 0),
            tech.get("total", 0), tech.get("correct", 0), tech.get("solve_rate", 0),
            mock.get("count", 0), mock.get("avg_score") or "", s.get("readiness"),
            int(s.get("last_active") or 0),
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=placement_readiness.csv"},
    )


@router.post("/export/pdf")
def export_pdf(request: Request, x_admin_passcode: str = Header(default="")):
    _check_passcode(x_admin_passcode, request)
    counts = storage.dashboard_counts()
    students = storage.admin_overview()
    path = report_pdf.build_cohort_report_pdf(runtime_settings.effective_department_name(), counts, students)
    return {"download_pdf": f"/api/admin/export/pdf/download/{os.path.basename(path)}"}


@router.get("/export/pdf/download/{filename}")
def download_export_pdf(filename: str):
    safe_name = os.path.basename(filename)
    path = config.GENERATED_DIR / safe_name
    if not path.is_file() or path.parent != config.GENERATED_DIR:
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(path, filename=safe_name)
