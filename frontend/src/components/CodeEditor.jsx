import { useRef, useState } from "react";
import { Copy, Check, FileCode, Sparkles } from "lucide-react";

/**
 * A sleek VS Code IDE Clone editor:
 * Includes VS Code title bar tabs, line-number gutter, active line tracking,
 * Tab-to-indent support, copy action, and VS Code Dark+ status bar.
 */
export default function CodeEditor({ value, onChange, height = 340, readOnly = false, ariaLabel = "VS Code editor", filename = "solution.py", language = "Python 3" }) {
  const textareaRef = useRef(null);
  const gutterRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const lineCount = Math.max(1, (value.match(/\n/g) || []).length + 1);

  const handleScroll = (e) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop;
  };

  const updateCursorPosition = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const val = ta.value.slice(0, ta.selectionStart);
    const lines = val.split("\n");
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
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
        updateCursorPosition();
      });
    }
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const ext = language.includes("SQL")
    ? "query.sql"
    : language.includes("C++")
    ? "main.cpp"
    : language.includes("Java")
    ? "Main.java"
    : language.includes("JavaScript")
    ? "index.js"
    : language.includes("Go")
    ? "main.go"
    : filename;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#1e1e1e] font-mono text-sm shadow-2xl" style={{ height }}>
      {/* VS Code Title Bar / Tab Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-[#252526] px-3 py-1.5 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-2 rounded-t-md bg-[#1e1e1e] border-t-2 border-brand-500 px-3 py-1 text-slate-200 font-medium">
            <FileCode size={13} className="text-brand-400" />
            <span>{ext}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyCode}
            className="flex items-center gap-1 text-[11px] hover:text-white transition-colors"
            title="Copy code"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        <div
          ref={gutterRef}
          className="select-none overflow-hidden bg-[#1e1e1e] border-r border-slate-800/60 px-3 py-3 text-right text-slate-600 font-mono text-xs"
          style={{ lineHeight: "1.6rem" }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div
              key={i}
              className={i + 1 === cursorPos.line ? "text-slate-300 font-bold bg-slate-800/40 px-1 rounded" : ""}
            >
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            updateCursorPosition();
          }}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onClick={updateCursorPosition}
          onKeyUp={updateCursorPosition}
          readOnly={readOnly}
          spellCheck={false}
          aria-label={ariaLabel}
          className="flex-1 resize-none overflow-auto bg-transparent px-3 py-3 text-slate-100 outline-none font-mono text-xs focus:ring-0"
          style={{ lineHeight: "1.6rem" }}
        />
      </div>

      {/* VS Code Bottom Status Bar */}
      <div className="flex items-center justify-between border-t border-slate-800 bg-[#007acc] px-3 py-0.5 text-[11px] font-medium text-white">
        <div className="flex items-center gap-3">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
          <span>Spaces: 4</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{language}</span>
          <span>VS Code Dark+</span>
        </div>
      </div>
    </div>
  );
}
