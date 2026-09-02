import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check } from "lucide-react";

// Lightweight, dependency-free "syntax highlighting". Real syntax
// highlighters (react-syntax-highlighter, rehype-highlight + highlight.js)
// pull in a sizeable new npm dependency, which is risky on a department PC
// with an unreliable internet connection - this is a deliberate trade-off:
// a small regex tokenizer that covers comments/strings/numbers/keywords
// well enough to read at a glance, with zero new installs.
const KEYWORDS = new Set([
  "def", "class", "return", "if", "elif", "else", "for", "while", "in", "not", "and", "or", "import", "from",
  "as", "try", "except", "finally", "raise", "with", "lambda", "yield", "pass", "break", "continue", "is", "None",
  "True", "False", "self", "async", "await", "global", "nonlocal", "del",
  "function", "const", "let", "var", "new", "this", "typeof", "instanceof", "extends", "super", "export",
  "default", "null", "undefined", "true", "false", "switch", "case", "do", "of",
  "public", "private", "protected", "static", "void", "int", "long", "double", "float", "char", "boolean",
  "String", "interface", "implements", "package", "throws", "throw", "final", "abstract",
  "struct", "namespace", "template", "using", "include", "printf", "cout", "cin", "endl",
]);

const TOKEN_RE = /(#.*$|\/\/.*$|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/gm;

function highlightNodes(code) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(code))) {
    if (match.index > lastIndex) nodes.push(code.slice(lastIndex, match.index));
    const tok = match[0];
    let cls = "";
    if (tok.startsWith("#") || tok.startsWith("//") || tok.startsWith("/*")) cls = "text-slate-500 italic";
    else if (tok[0] === '"' || tok[0] === "'" || tok[0] === "`") cls = "text-emerald-400";
    else if (/^\d/.test(tok)) cls = "text-amber-400";
    else if (KEYWORDS.has(tok)) cls = "text-sky-400 font-medium";
    if (cls) nodes.push(<span key={key++} className={cls}>{tok}</span>);
    else nodes.push(tok);
    lastIndex = match.index + tok.length;
  }
  if (lastIndex < code.length) nodes.push(code.slice(lastIndex));
  return nodes;
}

function CopyChip({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function CodeTag({ className, children }) {
  const isBlock = /language-/.test(className || "");
  if (!isBlock) return <code className={className}>{children}</code>;
  const text = String(children).replace(/\n$/, "");
  return <code className={className}>{highlightNodes(text)}</code>;
}

function PreTag({ children }) {
  const codeEl = Array.isArray(children) ? children[0] : children;
  const raw = String(codeEl?.props?.children ?? "").replace(/\n$/, "");
  const lang = (String(codeEl?.props?.className || "").match(/language-(\w+)/) || [, ""])[1];
  return (
    <div className="not-prose my-2 overflow-hidden rounded-xl bg-slate-900">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{lang || "code"}</span>
        <CopyChip text={raw} />
      </div>
      <pre className="overflow-x-auto p-3 text-[0.85em] leading-relaxed text-slate-100">{children}</pre>
    </div>
  );
}

const COMPONENTS = { code: CodeTag, pre: PreTag };

export default function Markdown({ children }) {
  return (
    <div className="prose-chat text-[0.925rem] text-slate-800 dark:text-slate-200">
      <ReactMarkdown components={COMPONENTS}>{children || ""}</ReactMarkdown>
    </div>
  );
}
