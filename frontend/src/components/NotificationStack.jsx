import { ShieldAlert, OctagonAlert, X } from "lucide-react";

const TONE_STYLES = {
  warning: {
    icon: ShieldAlert,
    badge: "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400",
    border: "border-red-200 dark:border-red-900",
  },
  danger: {
    icon: OctagonAlert,
    badge: "bg-red-600 text-white",
    border: "border-red-700",
  },
};

/**
 * Fixed top-right stack of popup notifications, newest on top, each
 * independently dismissible — pairs with useNotifications.js. Renders
 * nothing when the list is empty.
 */
export default function NotificationStack({ notifications, onDismiss }) {
  if (!notifications.length) return null;
  return (
    <div className="fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:top-6">
      {notifications.map((n) => {
        const style = TONE_STYLES[n.tone] || TONE_STYLES.warning;
        const Icon = style.icon;
        return (
          <div
            key={n.id}
            role="alert"
            aria-live="assertive"
            className={`animate-slide-up rounded-2xl border ${style.border} bg-white dark:bg-slate-800 p-4 shadow-2xl`}
          >
            <div className="flex items-start gap-2.5">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.badge}`}>
                <Icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{n.title}</p>
                {n.message && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{n.message}</p>}
                {n.footer && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{n.footer}</p>}
              </div>
              <button
                onClick={() => onDismiss(n.id)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
