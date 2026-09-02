"""Account signup/login/logout + "who am I" - real, password-protected
identity (see core/auth.py). Every other /api/* endpoint's student identity
is now verified server-side from the session cookie set here (see main.py's
session-enforcing middleware), not trusted from a client header."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

import config
from core import auth, rate_limit

router = APIRouter()

_COOKIE_KWARGS = dict(httponly=True, samesite="lax", max_age=auth.SESSION_TTL_SECS, path="/")


class Credentials(BaseModel):
    username: str = Field(max_length=60)
    password: str = Field(max_length=200)


@router.post("/signup")
def signup(req: Credentials, request: Request, response: Response):
    rate_limit.enforce("account-auth", request, config.ACCOUNT_AUTH_RATE_LIMIT, config.ACCOUNT_AUTH_RATE_WINDOW_SECS)
    try:
        token = auth.signup(req.username, req.password)
    except auth.AuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    username = auth.resolve_session(token)
    response.set_cookie(auth.SESSION_COOKIE, token, **_COOKIE_KWARGS)
    return {"username": username}


@router.post("/login")
def login(req: Credentials, request: Request, response: Response):
    rate_limit.enforce("account-auth", request, config.ACCOUNT_AUTH_RATE_LIMIT, config.ACCOUNT_AUTH_RATE_WINDOW_SECS)
    try:
        token = auth.login(req.username, req.password)
    except auth.AuthError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    username = auth.resolve_session(token)
    response.set_cookie(auth.SESSION_COOKIE, token, **_COOKIE_KWARGS)
    return {"username": username}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(auth.SESSION_COOKIE)
    auth.logout(token)
    response.delete_cookie(auth.SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(request: Request):
    token = request.cookies.get(auth.SESSION_COOKIE)
    username = auth.resolve_session(token)
    if not username:
        raise HTTPException(status_code=401, detail="Not logged in.")
    return {"username": username}
