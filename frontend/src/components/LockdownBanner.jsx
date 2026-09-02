import { Lock } from "lucide-react";

/**
 * Persistent "Proctoring active" status pill. The actual violation alerts
 * are popup notifications rendered by NotificationStack (see
 * useNotifications.js) - this component is just the small always-visible
 * strike counter, reused by the DSA Contest, Concept Q&A quiz, and Mock
 * Interview running screens.
 */
export default function LockdownBanner({ strikes, maxStrikes }) {
  return (
    <div
      role="status"
      aria-live="polite"
      title="Blocks copy/paste, right-click, and dev-tools shortcuts; flags tab switches and leaving fullscreen (browsers don't let a website fully prevent those two, so they're detected and penalized instead); also detects tampering with the tab-detection API itself."
      className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        strikes > 0
          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
      }`}
    >
      <Lock size={13} /> Proctoring active - {strikes}/{maxStrikes} strikes
    </div>
  );
}
