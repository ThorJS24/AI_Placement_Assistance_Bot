import { Lock } from "lucide-react";

/**
 * Persistent "Proctoring active" status pill. The actual violation alerts
 * are popup notifications rendered by NotificationStack (see
 * useNotifications.js) - this component is just the small always-visible
 * strike counter, reused by the DSA Contest, Concept Q&A quiz, and Mock
 * Interview running screens.
 */
export default function LockdownBanner({ strikes, maxStrikes, isFullscreen, enterFullscreen }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div
        role="status"
        aria-live="polite"
        title="Proctoring active: monitors fullscreen, window focus, tab switches, DevTools shortcuts, clipboard, and anti-tamper integrity."
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
          strikes > 0
            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60"
            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
        }`}
      >
        <Lock size={13} /> Proctoring active - {strikes}/{maxStrikes} strikes
      </div>

      {!isFullscreen && enterFullscreen && (
        <button
          type="button"
          onClick={enterFullscreen}
          className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/50 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-200 transition-colors border border-red-300/50"
        >
          ⚠️ Re-enter Fullscreen Mode
        </button>
      )}
    </div>
  );
}
