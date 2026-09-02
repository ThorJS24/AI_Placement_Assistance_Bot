import { useMemo, useState } from "react";
import { Plus, MessageSquare, Trash2, Pencil, Search, X } from "lucide-react";

export default function ChatSidebar({ sessions, activeId, onSelect, onNew, onDelete, onRename }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [query, setQuery] = useState("");

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditValue(s.title || "New chat");
  };

  const commitEdit = () => {
    if (editingId && editValue.trim()) onRename(editingId, editValue.trim());
    setEditingId(null);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => (s.title || "New chat").toLowerCase().includes(q));
  }, [sessions, query]);

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
      <div className="space-y-2 p-2.5">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-xl border border-slate-700 px-3 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800"
        >
          <Plus size={16} /> New chat
        </button>
        {sessions.length > 4 && (
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-1.5 pl-7 pr-6 text-xs text-slate-200 outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:border-slate-500"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-300" aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 && (
          <p className="px-2.5 py-4 text-center text-xs text-slate-500 dark:text-slate-400">Your conversations will appear here.</p>
        )}
        {sessions.length > 0 && filtered.length === 0 && (
          <p className="px-2.5 py-4 text-center text-xs text-slate-500 dark:text-slate-400">No conversations match "{query}".</p>
        )}
        <div className="space-y-0.5">
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => editingId !== s.id && onSelect(s.id)}
              role="button"
              tabIndex={editingId === s.id ? -1 : 0}
              aria-current={s.id === activeId ? "true" : undefined}
              aria-label={`Open conversation "${s.title || "New chat"}"`}
              onKeyDown={(e) => {
                if (editingId === s.id || e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(s.id);
                }
              }}
              className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400/60 ${
                s.id === activeId ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60"
              }`}
            >
              <MessageSquare size={14} className="shrink-0 text-slate-500 dark:text-slate-400" />
              {editingId === s.id ? (
                <input
                  autoFocus
                  aria-label="Conversation name"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={commitEdit}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 rounded bg-slate-700 px-1.5 py-0.5 text-sm text-white outline-none focus:ring-2 focus:ring-brand-400/60"
                />
              ) : (
                <span className="min-w-0 flex-1 truncate">{s.title || "New chat"}</span>
              )}
              {editingId !== s.id && (
                <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(s);
                    }}
                    className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-700 hover:text-white"
                    title="Rename"
                    aria-label={`Rename conversation "${s.title || "New chat"}"`}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${s.title || "New chat"}"? This can't be undone.`)) {
                        onDelete(s.id);
                      }
                    }}
                    className="rounded p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-700 hover:text-red-300"
                    title="Delete"
                    aria-label={`Delete conversation "${s.title || "New chat"}"`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
