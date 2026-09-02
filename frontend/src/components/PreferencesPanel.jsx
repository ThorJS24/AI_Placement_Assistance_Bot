import { useEffect, useState } from "react";
import { X, Palette, Sun, Moon } from "lucide-react";
import { apiGet } from "../api/client.js";
import { COLOR_THEMES, FONT_SIZES, getLocalPreferences, syncPreferences } from "../lib/preferences.js";

function OptionButton({ active, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
          : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export default function PreferencesPanel({ onClose, collapsed, onCollapsedChange }) {
  const [prefs, setPrefs] = useState(getLocalPreferences());

  useEffect(() => {
    // Reconcile against the student's server-saved preferences, if any —
    // localStorage/main.jsx already applied a local copy instantly, this
    // just catches this browser up if the student changed something on a
    // different device. Silently ignored if it fails (offline, Guest, etc).
    apiGet("/preferences")
      .then((server) => setPrefs((prev) => ({ ...prev, ...server })))
      .catch(() => {});
  }, []);

  const update = (patch) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
    syncPreferences(patch);
    if (patch.sidebar_collapsed !== undefined) onCollapsedChange?.(patch.sidebar_collapsed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="preferences-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl animate-slide-up dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="preferences-title" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
            <Palette size={18} className="text-brand-600" /> Appearance
          </h2>
          <button
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-5">
          <p className="label">Mode</p>
          <div className="flex gap-2">
            <OptionButton active={prefs.dark_mode === "light"} onClick={() => update({ dark_mode: "light" })}>
              <Sun size={16} className="mx-auto mb-1" />
              Light
            </OptionButton>
            <OptionButton active={prefs.dark_mode === "dark"} onClick={() => update({ dark_mode: "dark" })}>
              <Moon size={16} className="mx-auto mb-1" />
              Dark
            </OptionButton>
          </div>
        </div>

        <div className="mb-5">
          <p className="label">Color theme</p>
          <div className="grid grid-cols-4 gap-2">
            {COLOR_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => update({ color_theme: t.id })}
                title={t.label}
                aria-label={`${t.label} theme`}
                aria-pressed={prefs.color_theme === t.id}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-[11px] font-medium transition-colors duration-150 ${
                  prefs.color_theme === t.id
                    ? "border-brand-500 ring-2 ring-brand-500/30"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500"
                }`}
              >
                <span className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: t.swatch }} />
                <span className="truncate text-slate-600 dark:text-slate-300">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="label">Text size</p>
          <div className="flex gap-2">
            {FONT_SIZES.map((f) => (
              <OptionButton key={f.id} active={prefs.font_size === f.id} onClick={() => update({ font_size: f.id })}>
                {f.label}
              </OptionButton>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="label">Density</p>
          <div className="flex gap-2">
            <OptionButton active={prefs.density === "comfortable"} onClick={() => update({ density: "comfortable" })}>
              Comfortable
            </OptionButton>
            <OptionButton active={prefs.density === "compact"} onClick={() => update({ density: "compact" })}>
              Compact
            </OptionButton>
          </div>
        </div>

        <div>
          <p className="label">Sidebar (desktop)</p>
          <div className="flex gap-2">
            <OptionButton active={!collapsed} onClick={() => update({ sidebar_collapsed: false })}>
              Full
            </OptionButton>
            <OptionButton active={!!collapsed} onClick={() => update({ sidebar_collapsed: true })}>
              Icons only
            </OptionButton>
          </div>
        </div>

        <p className="mt-5 text-xs text-slate-400 dark:text-slate-500">
          Applies instantly on this device, and follows your name across other devices once you've set one (see the
          sidebar).
        </p>
      </div>
    </div>
  );
}
