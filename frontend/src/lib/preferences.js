// Local-first UI preferences: color theme, dark/light, font size, density,
// and sidebar layout. Applied to <html> via data-* attributes/a class so
// index.css and tailwind.config.js can style off them (see the CSS variable
// blocks and compact-density overrides in index.css).
//
// Mirrors the "local first, then sync to the student's saved identity"
// pattern already used by the name tag in api/client.js: localStorage makes
// the choice apply instantly and offline-safe (including before first
// paint, from main.jsx), while core/storage.py's per-student `preferences`
// column (see routers/preferences.py) makes the same choice follow the
// student to another device once they've set a name/PIN. Guests (no name
// set) only get the localStorage copy, same as the academic profile.

import { apiPatch } from "../api/client.js";

const KEYS = {
  theme: "theme", // "dark" | "light"
  colorTheme: "color_theme", // "default" | "ocean" | "forest" | "crimson"
  fontSize: "font_size", // "sm" | "md" | "lg"
  density: "density", // "comfortable" | "compact"
  sidebarCollapsed: "sidebar_collapsed", // "1" | "0"
};

export const COLOR_THEMES = [
  { id: "default", label: "Navy & Gold", swatch: "#0C4D8B" },
  { id: "ocean", label: "Ocean", swatch: "#0284c7" },
  { id: "forest", label: "Forest", swatch: "#059669" },
  { id: "crimson", label: "Crimson", swatch: "#e11d48" },
];

export const FONT_SIZES = [
  { id: "sm", label: "Small" },
  { id: "md", label: "Medium" },
  { id: "lg", label: "Large" },
];

export const DEFAULT_PREFERENCES = {
  dark_mode: "light",
  color_theme: "default",
  font_size: "md",
  density: "comfortable",
  sidebar_collapsed: false,
};

export function getLocalPreferences() {
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const savedTheme = localStorage.getItem(KEYS.theme);
  const darkMode = savedTheme === "dark" || savedTheme === "light" ? savedTheme : prefersDark ? "dark" : "light";
  return {
    dark_mode: darkMode,
    color_theme: localStorage.getItem(KEYS.colorTheme) || DEFAULT_PREFERENCES.color_theme,
    font_size: localStorage.getItem(KEYS.fontSize) || DEFAULT_PREFERENCES.font_size,
    density: localStorage.getItem(KEYS.density) || DEFAULT_PREFERENCES.density,
    sidebar_collapsed: localStorage.getItem(KEYS.sidebarCollapsed) === "1",
  };
}

export function applyPreferences(prefs) {
  const root = document.documentElement;
  if (prefs.dark_mode) root.classList.toggle("dark", prefs.dark_mode === "dark");
  if (prefs.color_theme) root.setAttribute("data-theme", prefs.color_theme);
  if (prefs.font_size) root.setAttribute("data-font-size", prefs.font_size);
  if (prefs.density) root.setAttribute("data-density", prefs.density);
}

export function saveLocalPreferences(prefs) {
  if (prefs.dark_mode !== undefined) localStorage.setItem(KEYS.theme, prefs.dark_mode);
  if (prefs.color_theme !== undefined) localStorage.setItem(KEYS.colorTheme, prefs.color_theme);
  if (prefs.font_size !== undefined) localStorage.setItem(KEYS.fontSize, prefs.font_size);
  if (prefs.density !== undefined) localStorage.setItem(KEYS.density, prefs.density);
  if (prefs.sidebar_collapsed !== undefined) {
    localStorage.setItem(KEYS.sidebarCollapsed, prefs.sidebar_collapsed ? "1" : "0");
  }
}

// Applies a preference change instantly (DOM + localStorage) and best-effort
// syncs it to the student's server-saved preferences (routers/preferences.py)
// so it follows them to another device once they've set a name/PIN. The
// local apply always happens first and synchronously — a slow or failed
// network sync never delays or blocks the visible effect.
export async function syncPreferences(patch) {
  applyPreferences(patch);
  saveLocalPreferences(patch);
  try {
    await apiPatch("/preferences", patch);
  } catch {
    // Best-effort — the change already applied locally regardless. A
    // student on a shared/offline PC still gets instant, working
    // preferences; only cross-device sync is missed.
  }
}
