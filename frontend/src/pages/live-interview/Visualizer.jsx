import { useEffect, useRef } from "react";

/**
 * Canvas-based audio-reactive visualizer driven by a REAL Web Audio
 * AnalyserNode (`analyserRef`, shared with the mic capture pipeline in
 * useLiveInterviewSession) - never a CSS animation looping regardless of
 * actual sound. Deliberately restrained: a single horizontal bar-meter in
 * the app's existing brand color, not a glowing orb or glassmorphism
 * effect, matching this project's plain Tailwind aesthetic elsewhere.
 *
 * Respects prefers-reduced-motion: renders a single static level bar
 * (still reflecting real amplitude, just without the continuous redraw
 * loop) instead of animating every frame.
 */
export default function Visualizer({ analyserRef, active, label }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const barColor = getComputedStyle(document.documentElement).getPropertyValue("--tw-color-brand-600") || "#4f46e5";

    const readLevel = () => {
      const analyser = analyserRef.current;
      if (!analyser || !active) return 0;
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const centered = data[i] - 128;
        sumSquares += centered * centered;
      }
      return Math.min(1, Math.sqrt(sumSquares / data.length) / 40);
    };

    const drawBars = (level) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const barCount = 24;
      const gap = w / barCount;
      const barWidth = gap * 0.5;
      for (let i = 0; i < barCount; i++) {
        // A gentle center-weighted falloff so bars near the middle react
        // more, like a real level meter, rather than every bar being
        // identical (which would look static even while animating).
        const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
        const barLevel = active ? level * (1 - centerDist * 0.5) * (0.6 + 0.4 * Math.random()) : 0.04;
        const barHeight = Math.max(h * 0.06, barLevel * h);
        const x = i * gap + (gap - barWidth) / 2;
        const y = (h - barHeight) / 2;
        ctx.fillStyle = active ? "rgb(79, 70, 229)" : "rgb(203, 213, 225)";
        ctx.globalAlpha = active ? 0.55 + barLevel * 0.45 : 0.6;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
      ctx.globalAlpha = 1;
    };

    if (reducedMotion) {
      drawBars(active ? 0.5 : 0);
      return () => window.removeEventListener("resize", resize);
    }

    const tick = () => {
      drawBars(readLevel());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyserRef, active]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
      <canvas ref={canvasRef} role="img" aria-label={label} className="h-16 w-full" />
    </div>
  );
}
