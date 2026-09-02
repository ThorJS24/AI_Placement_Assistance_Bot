// Tests for the thin fetch-wrapper layer every page/component goes through.
// `fetch` itself is mocked (vi.fn) rather than hit for real -- these tests
// are about the wrapper's own behavior (headers, error extraction, storage
// key handling), not about the backend, which is covered separately by the
// Python test suite in backend/tests/.
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ApiError,
  getStudentName,
  setStudentName,
  getAdminPasscode,
  setAdminPasscode,
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiAdminGet,
  apiAdminPost,
  apiAdminPatch,
  apiAdminDelete,
  downloadUrl,
  authSignup,
  authLogin,
  authLogout,
  authMe,
} from "./client.js";

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body, statusText: "" };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  global.fetch = vi.fn();
});

describe("student name tag (localStorage)", () => {
  it("returns an empty string when nothing is set", () => {
    expect(getStudentName()).toBe("");
  });

  it("trims whitespace and caps at 60 characters", () => {
    setStudentName(`  ${"a".repeat(70)}  `);
    expect(getStudentName()).toBe("a".repeat(60));
  });

  it("clearing with an empty/whitespace name removes the stored key", () => {
    setStudentName("Alice");
    setStudentName("   ");
    expect(getStudentName()).toBe("");
    expect(localStorage.getItem("student_name")).toBeNull();
  });
});

describe("admin passcode (sessionStorage, not localStorage)", () => {
  it("is stored in sessionStorage so it clears when the browser closes", () => {
    setAdminPasscode("changeme123");
    expect(sessionStorage.getItem("admin_passcode")).toBe("changeme123");
    expect(localStorage.getItem("admin_passcode")).toBeNull();
    expect(getAdminPasscode()).toBe("changeme123");
  });

  it("clearing with a falsy value removes the key", () => {
    setAdminPasscode("secret");
    setAdminPasscode("");
    expect(getAdminPasscode()).toBe("");
    expect(sessionStorage.getItem("admin_passcode")).toBeNull();
  });
});

describe("apiGet / apiPost / apiPatch / apiDelete", () => {
  it("apiGet sends credentials so the session cookie flows, and returns parsed JSON", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ hello: "world" }));
    const data = await apiGet("/ping");
    expect(data).toEqual({ hello: "world" });
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("/api/ping");
    expect(opts.credentials).toBe("include");
  });

  it("apiPost sends a JSON body and Content-Type header", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await apiPost("/things", { a: 1 });
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("/api/things");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(opts.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("apiPost defaults to an empty object body when none is given", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}));
    await apiPost("/things");
    expect(fetch.mock.calls[0][1].body).toBe("{}");
  });

  it("apiPatch uses the PATCH method", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({}));
    await apiPatch("/preferences", { font_size: "lg" });
    expect(fetch.mock.calls[0][1].method).toBe("PATCH");
  });

  it("apiDelete returns {} when the response has no JSON body", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("no body");
      },
    });
    await expect(apiDelete("/things/1")).resolves.toEqual({});
  });

  it("throws ApiError with the server's detail message on a non-ok response", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ detail: "Not found." }, { ok: false, status: 404 }));
    let caught = null;
    try {
      await apiGet("/missing");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({ message: "Not found.", status: 404 });
  });

  it("falls back to statusText when the error body isn't valid JSON", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(apiGet("/broken")).rejects.toMatchObject({ message: "Internal Server Error", status: 500 });
  });
});

describe("auth (cookie session)", () => {
  it("authSignup posts credentials and caches the returned username locally", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ username: "alice" }));
    const data = await authSignup("alice", "hunter22");
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("/api/auth/signup");
    expect(opts.method).toBe("POST");
    expect(opts.credentials).toBe("include");
    expect(opts.body).toBe(JSON.stringify({ username: "alice", password: "hunter22" }));
    expect(data).toEqual({ username: "alice" });
    expect(getStudentName()).toBe("alice");
  });

  it("authLogin posts credentials and caches the returned username locally", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ username: "bob" }));
    await authLogin("bob", "hunter22");
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(opts.credentials).toBe("include");
    expect(getStudentName()).toBe("bob");
  });

  it("authLogout posts to /auth/logout and clears the cached name even if the call fails", async () => {
    setStudentName("bob");
    fetch.mockRejectedValueOnce(new Error("network down"));
    await expect(authLogout()).rejects.toThrow("network down");
    expect(getStudentName()).toBe("");
  });

  it("authMe issues a credentialed GET and returns parsed JSON", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ username: "carol" }));
    const data = await authMe();
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe("/api/auth/me");
    expect(opts.credentials).toBe("include");
    expect(data).toEqual({ username: "carol" });
  });
});

describe("admin-gated calls", () => {
  it("apiAdminGet sends the X-Admin-Passcode header from sessionStorage", async () => {
    setAdminPasscode("s3cret");
    fetch.mockResolvedValueOnce(jsonResponse({ department_name: "CSE" }));
    await apiAdminGet("/admin/overview");
    expect(fetch.mock.calls[0][1].headers["X-Admin-Passcode"]).toBe("s3cret");
  });

  it("apiAdminPost/Patch/Delete all attach the same passcode header", async () => {
    setAdminPasscode("s3cret");
    fetch.mockResolvedValue(jsonResponse({}));
    await apiAdminPost("/admin/questions/dsa", { id: "x" });
    await apiAdminPatch("/admin/questions/dsa/x", { title: "y" });
    await apiAdminDelete("/admin/questions/dsa/x");
    for (const call of fetch.mock.calls) {
      expect(call[1].headers["X-Admin-Passcode"]).toBe("s3cret");
    }
    expect(fetch.mock.calls[0][1].method).toBe("POST");
    expect(fetch.mock.calls[1][1].method).toBe("PATCH");
    expect(fetch.mock.calls[2][1].method).toBe("DELETE");
  });

  it("apiAdminDelete returns {} when there's no JSON body", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("no body");
      },
    });
    await expect(apiAdminDelete("/admin/questions/dsa/x")).resolves.toEqual({});
  });

  it("rejects with ApiError on a 401 (wrong passcode)", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ detail: "Incorrect admin passcode." }, { ok: false, status: 401 }));
    await expect(apiAdminGet("/admin/overview")).rejects.toMatchObject({ status: 401 });
  });
});

describe("downloadUrl", () => {
  it("passes the backend-provided path through unchanged", () => {
    expect(downloadUrl("/api/resume/download/x.pdf")).toBe("/api/resume/download/x.pdf");
  });
});
