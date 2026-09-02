// Tests for the local-first preferences module. Covers the pieces that are
// pure logic + browser storage/DOM, without needing a rendered component:
// defaulting, persistence round-trip, DOM attribute application, and the
// "apply locally first, sync best-effort" contract syncPreferences promises
// in its own doc comment (a failed/slow network sync must never undo or
// block the local effect).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/client.js", () => ({
  apiPatch: vi.fn(),
}));

import { apiPatch } from "../api/client.js";
import {
  DEFAULT_PREFERENCES,
  getLocalPreferences,
  applyPreferences,
  saveLocalPreferences,
  syncPreferences,
} from "./preferences.js";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-font-size");
  document.documentElement.removeAttribute("data-density");
  vi.clearAllMocks();
});

describe("getLocalPreferences", () => {
  it("falls back to defaults when nothing is stored and the OS has no dark-mode preference", () => {
    const prefs = getLocalPreferences();
    expect(prefs.dark_mode).toBe("light");
    expect(prefs.color_theme).toBe(DEFAULT_PREFERENCES.color_theme);
    expect(prefs.font_size).toBe(DEFAULT_PREFERENCES.font_size);
    expect(prefs.density).toBe(DEFAULT_PREFERENCES.density);
    expect(prefs.sidebar_collapsed).toBe(false);
  });

  it("respects the OS prefers-color-scheme when no explicit theme is saved", () => {
    const original = window.matchMedia;
    window.matchMedia = () => ({ matches: true });
    expect(getLocalPreferences().dark_mode).toBe("dark");
    window.matchMedia = original;
  });

  it("an explicitly saved theme always wins over the OS preference", () => {
    const original = window.matchMedia;
    window.matchMedia = () => ({ matches: true }); // OS says dark
    localStorage.setItem("theme", "light"); // student explicitly chose light
    expect(getLocalPreferences().dark_mode).toBe("light");
    window.matchMedia = original;
  });

  it("reads back everything saveLocalPreferences wrote", () => {
    saveLocalPreferences({
      dark_mode: "dark",
      color_theme: "ocean",
      font_size: "lg",
      density: "compact",
      sidebar_collapsed: true,
    });
    expect(getLocalPreferences()).toEqual({
      dark_mode: "dark",
      color_theme: "ocean",
      font_size: "lg",
      density: "compact",
      sidebar_collapsed: true,
    });
  });
});

describe("saveLocalPreferences", () => {
  it("only writes keys that are present in the patch, leaving others untouched", () => {
    saveLocalPreferences({ color_theme: "forest" });
    expect(localStorage.getItem("color_theme")).toBe("forest");
    expect(localStorage.getItem("theme")).toBeNull();
    expect(localStorage.getItem("font_size")).toBeNull();
  });

  it("stores sidebar_collapsed as the string '1'/'0', not a boolean", () => {
    saveLocalPreferences({ sidebar_collapsed: true });
    expect(localStorage.getItem("sidebar_collapsed")).toBe("1");
    saveLocalPreferences({ sidebar_collapsed: false });
    expect(localStorage.getItem("sidebar_collapsed")).toBe("0");
  });
});

describe("applyPreferences", () => {
  it("toggles the dark class and sets the three data-* attributes on <html>", () => {
    applyPreferences({ dark_mode: "dark", color_theme: "crimson", font_size: "sm", density: "compact" });
    const root = document.documentElement;
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.getAttribute("data-theme")).toBe("crimson");
    expect(root.getAttribute("data-font-size")).toBe("sm");
    expect(root.getAttribute("data-density")).toBe("compact");
  });

  it("removes the dark class when switching back to light", () => {
    applyPreferences({ dark_mode: "dark" });
    applyPreferences({ dark_mode: "light" });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("leaves untouched attributes alone when a partial patch is applied", () => {
    applyPreferences({ dark_mode: "dark", color_theme: "ocean" });
    applyPreferences({ font_size: "lg" }); // no color_theme in this patch
    expect(document.documentElement.getAttribute("data-theme")).toBe("ocean");
    expect(document.documentElement.getAttribute("data-font-size")).toBe("lg");
  });
});

describe("syncPreferences", () => {
  it("applies and saves locally, then calls apiPatch with the same patch", async () => {
    apiPatch.mockResolvedValueOnce({});
    await syncPreferences({ dark_mode: "dark", color_theme: "forest" });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("color_theme")).toBe("forest");
    expect(apiPatch).toHaveBeenCalledWith("/preferences", { dark_mode: "dark", color_theme: "forest" });
  });

  it("keeps the local change even when the server sync fails", async () => {
    apiPatch.mockRejectedValueOnce(new Error("network down"));
    await expect(syncPreferences({ font_size: "lg" })).resolves.toBeUndefined();
    expect(localStorage.getItem("font_size")).toBe("lg");
    expect(document.documentElement.getAttribute("data-font-size")).toBe("lg");
  });
});
