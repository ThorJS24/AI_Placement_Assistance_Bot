import { useRef } from "react";

/**
 * A lightweight, dependency-free code editor: a monospace textarea with a
 * synced line-number gutter and Tab-to-indent support. Deliberately avoids
 * a heavier editor library (CodeMirror/Monaco) to keep the frontend's
 * dependency footprint small and installs reliable.
 */
export default function CodeEditor({ value, onChange, height = 320, readOnly = false, ariaLabel = "Code editor" }) {
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);

  const lineCount = Math.max(1, (value.match(/\n/g) || []).length + 1);

  const handleScroll = (e) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop;
  };

  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = value.slice(0, start) + "    " + value.slice(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
  };

  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-700 bg-slate-900 font-mono text-sm" style={{ height }}>
      <div
        ref={gutterRef}
        className="select-none overflow-hidden bg-slate-950/60 px-3 py-3 text-right text-slate-600"
        style={{ lineHeight: "1.6rem" }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        spellCheck={false}
        aria-label={ariaLabel}
        className="flex-1 resize-none overflow-auto bg-transparent px-3 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-inset focus:ring-brand-400/60"
        style={{ lineHeight: "1.6rem" }}
      />
    </div>
  );
}
