import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Proctored "assessment lockdown" behavior shared by the DSA Contest, the
 * Concept Q&A quiz round, and the Mock Interview — fullscreen + violation
 * detection (tab switch, window blur, copy/paste, right-click, common
 * devtools shortcuts, and tampering with the Page Visibility API itself),
 * with a warn + strike-counter model: each violation is logged and shown
 * to the student, and `onLimitExceeded` fires once (and only once) after
 * `maxStrikes` violations — or immediately for a `severe` violation — so
 * the caller can auto-submit exactly like a timer running out.
 *
 * Not every violation can actually be *prevented* by JS (fullscreen-exit,
 * tab switch, alt-tab window blur are all browser-level, not scriptable) —
 * those are detected and logged after the fact rather than blocked. Ones
 * that *can* be intercepted (copy/paste/cut, right-click, devtools
 * shortcuts) are prevented as well as logged.
 *
 * A website can never enumerate a browser's installed extensions (browsers
 * deliberately hide that from page JS). What IS detectable, and what
 * `checkVisibilityApiIntegrity` below does: whether the actual browser APIs
 * this hook depends on (`document.hidden` / `document.visibilityState`)
 * have been monkey-patched away from their native implementation — which is
 * exactly the mechanism most "hide my tab switch" cheat extensions and
 * bookmarklets use. That's treated as a `severe` violation (ends the
 * session immediately, no warning strikes) since tampering with the
 * detection mechanism itself is a much stronger signal of deliberate intent
 * than an accidental blur/tab-switch.
 */
const VIOLATION_LABELS = {
  fullscreen_exit: "Exited fullscreen",
  tab_hidden: "Switched tabs / minimized the window",
  window_blur: "Left the assessment window",
  copy: "Attempted to copy",
  paste: "Attempted to paste",
  cut: "Attempted to cut",
  context_menu: "Right-click menu",
  devtools_shortcut: "Attempted to open developer tools",
  visibility_tamper: "Tab-detection API was tampered with (likely an anti-detection extension)",
};

export function violationLabel(type) {
  return VIOLATION_LABELS[type] || type;
}

const DEVTOOLS_KEYS = new Set(["F12"]);

function isDevtoolsShortcut(e) {
  if (DEVTOOLS_KEYS.has(e.key)) return true;
  const k = (e.key || "").toLowerCase();
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === "i" || k === "j" || k === "c")) return true;
  if ((e.ctrlKey || e.metaKey) && k === "u") return true;
  return false;
}

// A genuine browser implementation of these accessor properties always
// stringifies to "function get hidden() { [native code] }" — any extension
// or injected script that overrides them to spoof "always visible" replaces
// that with real (non-native) JS source, which this reliably catches.
function isNativeAccessor(proto, prop) {
  try {
    const desc = Object.getOwnPropertyDescriptor(proto, prop);
    if (!desc || typeof desc.get !== "function") return false;
    return /\{\s*\[native code\]\s*\}\s*$/.test(Function.prototype.toString.call(desc.get));
  } catch {
    return false;
  }
}

function checkVisibilityApiIntegrity() {
  try {
    return isNativeAccessor(Document.prototype, "hidden") && isNativeAccessor(Document.prototype, "visibilityState");
  } catch {
    return true; // an environment where this check itself throws shouldn't be treated as tampering
  }
}

const INTEGRITY_CHECK_INTERVAL_MS = 4000;

export default function useLockdown({ active, maxStrikes = 3, onLimitExceeded, onViolation }) {
  const [strikes, setStrikes] = useState(0);
  const [violations, setViolations] = useState([]);
  const [lastViolation, setLastViolation] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const limitFiredRef = useRef(false);
  const violationsRef = useRef([]); // mirrors `violations` synchronously, so interval/instant-fail paths always read the latest list rather than a stale closure
  const onLimitExceededRef = useRef(onLimitExceeded);
  onLimitExceededRef.current = onLimitExceeded;
  const onViolationRef = useRef(onViolation);
  onViolationRef.current = onViolation;

  const triggerLimit = useCallback(() => {
    if (limitFiredRef.current) return;
    limitFiredRef.current = true;
    onLimitExceededRef.current?.(violationsRef.current);
  }, []);

  const report = useCallback((type, { severe = false } = {}) => {
    const entry = { type, label: violationLabel(type), at: Date.now(), severe };
    violationsRef.current = [...violationsRef.current, entry];
    setViolations(violationsRef.current);
    setLastViolation(entry);
    onViolationRef.current?.(entry);
    if (severe) {
      setStrikes(maxStrikes);
      triggerLimit();
    } else {
      setStrikes((prev) => prev + 1);
    }
    return entry;
  }, [maxStrikes, triggerLimit]);

  const enterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
    } catch {
      // Fullscreen can be denied/unsupported (e.g. some embedded/mobile
      // browsers) — the rest of lockdown (blur/copy/paste/devtools
      // detection) still works without it, so this is non-fatal.
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    limitFiredRef.current = false;

    const onFullscreenChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) report("fullscreen_exit");
    };
    const onVisibility = () => {
      if (document.hidden) report("tab_hidden");
    };
    const onBlur = () => report("window_blur");
    const onContextMenu = (e) => {
      e.preventDefault();
      report("context_menu");
    };
    const onCopy = (e) => {
      e.preventDefault();
      report("copy");
    };
    const onCut = (e) => {
      e.preventDefault();
      report("cut");
    };
    const onPaste = (e) => {
      e.preventDefault();
      report("paste");
    };
    const onKeyDown = (e) => {
      if (isDevtoolsShortcut(e)) {
        e.preventDefault();
        report("devtools_shortcut");
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("keydown", onKeyDown);

    setIsFullscreen(!!document.fullscreenElement);

    // Anti-tamper: check once immediately, then on an interval, since some
    // extensions patch these APIs asynchronously after page load rather
    // than at document-start.
    let tamperFlagged = false;
    const checkIntegrity = () => {
      if (tamperFlagged) return;
      if (!checkVisibilityApiIntegrity()) {
        tamperFlagged = true;
        report("visibility_tamper", { severe: true });
      }
    };
    checkIntegrity();
    const integrityTimer = setInterval(checkIntegrity, INTEGRITY_CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("keydown", onKeyDown);
      clearInterval(integrityTimer);
    };
  }, [active, report]);

  useEffect(() => {
    if (active && !limitFiredRef.current && strikes >= maxStrikes) {
      triggerLimit();
    }
  }, [active, strikes, maxStrikes, triggerLimit]);

  // Clear accumulated state whenever a new lockdown session starts.
  useEffect(() => {
    if (active) {
      violationsRef.current = [];
      setStrikes(0);
      setViolations([]);
      setLastViolation(null);
    }
  }, [active]);

  return { strikes, maxStrikes, violations, lastViolation, isFullscreen, enterFullscreen, exitFullscreen };
}
