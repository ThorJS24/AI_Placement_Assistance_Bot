import { useCallback, useRef, useState } from "react";

let idCounter = 0;

/**
 * Generic stacked-popup notification manager - multiple notifications queue
 * and stack instead of one overwriting the last (the earlier lockdown toast
 * only ever showed the single most recent violation). Each entry
 * auto-dismisses after its own timer (or stays until manually dismissed if
 * `durationMs: 0`), independent of the others. Used by the DSA Contest,
 * Concept Q&A quiz, and Mock Interview screens for proctoring violations
 * and session-ended alerts; generic enough to reuse anywhere else that
 * wants stacked popups instead of a single inline banner.
 */
export default function useNotifications({ maxVisible = 4, defaultDurationMs = 5000 } = {}) {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback((notification) => {
    const id = ++idCounter;
    const entry = { id, tone: "warning", durationMs: defaultDurationMs, ...notification };
    setNotifications((prev) => [entry, ...prev].slice(0, maxVisible));
    if (entry.durationMs > 0) {
      const timer = setTimeout(() => dismiss(id), entry.durationMs);
      timersRef.current.set(id, timer);
    }
    return id;
  }, [defaultDurationMs, maxVisible, dismiss]);

  return { notifications, push, dismiss };
}
