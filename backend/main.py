"""
AI Placement Assistance Platform — FastAPI backend.

Run with (from the backend/ folder, inside the venv):
    uvicorn main:app --host 127.0.0.1 --port 8000

In production this single process serves BOTH the JSON API (under /api/*)
AND the pre-built React frontend (frontend/dist), so the whole platform is
one process to start and one port to open — see run.bat / run.sh at the
project root, which do exactly this.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

import config
from core import auth, runtime_settings, storage
from routers import (
    admin,
    admin_analytics,
    admin_questions,
    auth as auth_router,
    chat,
    dashboard,
    live_interview,
    mock_interview,
    preferences,
    profile,
    resume,
    roadmap,
    settings,
    technical_interview,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.init_db()
    logger.info("Database ready at %s", config.DB_PATH)
    yield


app = FastAPI(title=runtime_settings.effective_app_title(), lifespan=lifespan)

# CORS is only relevant when running the Vite dev server (npm run dev) against
# this API during frontend development. The production build is served by this
# same process (see below), so no cross-origin request ever happens there.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.DEV_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Session-identity enforcement — real accounts (core/auth.py) replaced the
# old "trust whatever X-Student-Name header the client sends" model. Rather
# than threading a new `Depends(...)` through every single router function
# (dozens of endpoints across ~10 files, all of which already correctly key
# everything off an `x_student_name` header param), this single middleware
# verifies the session cookie once per request and REWRITES the
# X-Student-Name header to the verified username before it reaches any
# route handler — every existing `Header(default="Guest")` param downstream
# keeps working completely unchanged, but the value it receives is now
# authenticated, not client-controlled. X-Student-Pin becomes moot (a real
# password now gates who can claim a username at all) but is left alone —
# harmless, and storage._resolve_student's PIN check just never triggers
# for accounts created through /api/auth/signup.
_AUTH_EXEMPT_PREFIXES = ("/api/auth", "/api/admin")
_AUTH_EXEMPT_EXACT = {"/api/health", "/api/settings/status"}


@app.middleware("http")
async def enforce_session_identity(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/") or path.startswith(_AUTH_EXEMPT_PREFIXES) or path in _AUTH_EXEMPT_EXACT:
        return await call_next(request)

    token = request.cookies.get(auth.SESSION_COOKIE)
    username = auth.resolve_session(token)
    if not username:
        return JSONResponse(status_code=401, content={"detail": "Not authenticated — please log in."})

    raw_headers = [
        (k, v) for k, v in request.scope["headers"]
        if k.decode("latin-1").lower() not in ("x-student-name", "x-student-pin")
    ]
    raw_headers.append((b"x-student-name", username.encode("utf-8")))
    request.scope["headers"] = raw_headers
    return await call_next(request)


app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(roadmap.router, prefix="/api/roadmap", tags=["roadmap"])
app.include_router(mock_interview.router, prefix="/api/mock", tags=["mock-interview"])
app.include_router(live_interview.router, prefix="/api/live-interview", tags=["live-interview"])
app.include_router(technical_interview.router, prefix="/api/technical", tags=["technical-interview"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(admin_questions.router, prefix="/api/admin/questions", tags=["admin-questions"])
app.include_router(admin_analytics.router, prefix="/api/admin/trends", tags=["admin-analytics"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(preferences.router, prefix="/api/preferences", tags=["preferences"])


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Serve the built React frontend (frontend/dist), with SPA fallback routing.
# If the frontend hasn't been built yet, show a friendly message instead of a
# confusing 404 so setup problems are obvious.
# ---------------------------------------------------------------------------
DIST = config.FRONTEND_DIST_DIR
INDEX_HTML = DIST / "index.html"

if DIST.exists() and (DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        candidate = DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(INDEX_HTML)

else:

    @app.get("/{full_path:path}")
    def frontend_not_built(full_path: str):
        return JSONResponse(
            status_code=503,
            content={
                "error": "Frontend is not built yet.",
                "fix": "Run setup.bat (Windows) or ./setup.sh (Mac/Linux) from the project root, "
                "which runs 'npm install && npm run build' inside frontend/. "
                "The API itself is working — try GET /api/health.",
            },
        )
