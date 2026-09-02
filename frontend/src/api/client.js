// Thin fetch wrappers for the FastAPI backend. All calls are relative to
// "/api" - in production the backend serves the frontend from the same
// origin, and in dev the Vite proxy (see vite.config.js) forwards them.

const BASE = "/api";
const STUDENT_NAME_KEY = "student_name";
const ADMIN_PASSCODE_KEY = "admin_passcode"; // sessionStorage - clears when the browser closes

// --- Identity ----------------------------------------------------------
// Real accounts (see core/auth.py + routers/auth.py): every request's
// student identity is verified server-side from an httpOnly session
// cookie (set by /auth/login or /auth/signup and sent automatically by the
// browser via `credentials: "include"` below) - nothing here can spoof it.
// getStudentName/setStudentName just cache the logged-in username locally
// for instant display (e.g. the sidebar) without an extra round trip; it is
// NOT read for authentication anywhere.

export function getStudentName() {
  return (localStorage.getItem(STUDENT_NAME_KEY) || "").trim();
}

export function setStudentName(name) {
  const clean = (name || "").trim().slice(0, 60);
  if (clean) localStorage.setItem(STUDENT_NAME_KEY, clean);
  else localStorage.removeItem(STUDENT_NAME_KEY);
}

function withCredentials(init = {}) {
  return { credentials: "include", ...init };
}

async function parseErrorDetail(res) {
  try {
    const data = await res.json();
    const detail = data.detail || data.error;
    // FastAPI's own 422 validation errors send `detail` as an ARRAY of
    // {loc, msg, type} objects, not a string - rendering that directly (or
    // JSON.stringifying a plain object) produced a useless "[object Object]"
    // for the student. Fall back to each error's `msg` field, or a generic
    // message, rather than ever handing a non-string to an ApiError.
    if (typeof detail === "string" && detail) return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail.map((d) => (typeof d === "string" ? d : d.msg || JSON.stringify(d))).join("; ");
    }
    if (detail && typeof detail === "object") return detail.msg || JSON.stringify(detail);
    return JSON.stringify(data);
  } catch {
    return res.statusText || `Request failed (${res.status})`;
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, withCredentials());
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, withCredentials({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }));
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

export async function apiPostForm(path, formData) {
  const res = await fetch(`${BASE}${path}`, withCredentials({ method: "POST", body: formData }));
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

export async function apiPatch(path, body) {
  const res = await fetch(`${BASE}${path}`, withCredentials({
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  }));
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(`${BASE}${path}`, withCredentials({ method: "DELETE" }));
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// --- Auth ----------------------------------------------------------------

export async function authSignup(username, password) {
  const data = await apiPost("/auth/signup", { username, password });
  setStudentName(data.username);
  return data;
}

export async function authLogin(username, password) {
  const data = await apiPost("/auth/login", { username, password });
  setStudentName(data.username);
  return data;
}

export async function authLogout() {
  try {
    await apiPost("/auth/logout", {});
  } finally {
    setStudentName("");
  }
}

export async function authMe() {
  return apiGet("/auth/me");
}

/**
 * Streams a POST response as plain text, invoking onChunk(text) as pieces
 * arrive. Used for the chatbot's token-by-token streaming reply. Falls back
 * gracefully - if the browser can't stream, it just resolves once with the
 * full body via onChunk. Pass { signal } to allow aborting mid-stream (used
 * by the chatbot's "stop generating" button) - the backend also detects the
 * dropped connection and stops pulling further tokens from the LLM.
 */
export async function apiPostStream(path, body, onChunk, options = {}) {
  const { signal } = options;
  const res = await fetch(`${BASE}${path}`, withCredentials({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    signal,
  }));
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  if (!res.body || !res.body.getReader) {
    const text = await res.text();
    onChunk(text);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

/**
 * Like apiPostStream, but for endpoints that stream newline-delimited JSON
 * events (one JSON object per line) instead of raw text - see the mock
 * interview's live-mode endpoints (/mock/start/stream, /mock/next/stream).
 * Buffers partial lines across chunk boundaries (a network chunk has no
 * reason to align with a "\n") and calls onEvent(parsedObject) for each
 * complete line, including any trailing line with no final newline.
 */
export async function apiPostStreamLines(path, body, onEvent, options = {}) {
  let buffer = "";
  const flushLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed));
    } catch {
      // A malformed/partial line slipping through is a protocol bug, not
      // something the student should see - drop it rather than crash the turn.
    }
  };
  await apiPostStream(path, body, (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      flushLine(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
  }, options);
  if (buffer) flushLine(buffer);
}

export function downloadUrl(path) {
  return path; // backend already returns absolute paths like /api/resume/download/x.pdf
}

// --- Admin / TPO dashboard ---------------------------------------------------
// A single shared passcode (config.ADMIN_PASSCODE on the backend), kept in
// sessionStorage only - so it clears when the browser closes, unlike the
// student name tag which is meant to persist.

export function getAdminPasscode() {
  return sessionStorage.getItem(ADMIN_PASSCODE_KEY) || "";
}

export function setAdminPasscode(passcode) {
  if (passcode) sessionStorage.setItem(ADMIN_PASSCODE_KEY, passcode);
  else sessionStorage.removeItem(ADMIN_PASSCODE_KEY);
}

export async function apiAdminGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { "X-Admin-Passcode": getAdminPasscode() } });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

export async function apiAdminPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "X-Admin-Passcode": getAdminPasscode(), "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

export async function apiAdminPatch(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "X-Admin-Passcode": getAdminPasscode(), "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  return res.json();
}

export async function apiAdminDelete(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: { "X-Admin-Passcode": getAdminPasscode() },
  });
  if (!res.ok) throw new ApiError(await parseErrorDetail(res), res.status);
  try {
    return await res.json();
  } catch {
    return {};
  }
}
