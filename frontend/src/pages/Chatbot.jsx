import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, User, Sparkles, Square, Copy, Check, RotateCcw, ThumbsUp, ThumbsDown } from "lucide-react";
import Markdown from "../components/Markdown.jsx";
import ChatSidebar from "../components/ChatSidebar.jsx";
import { apiGet, apiPostStream, apiDelete, apiPatch, ApiError } from "../api/client.js";

function newSessionId() {
  return (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/-/g, "").slice(0, 20);
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function FeedbackButtons({ messageId, feedback, onSet }) {
  if (!messageId) return null;
  const toggle = (value) => onSet(messageId, feedback === value ? null : value);
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        onClick={() => toggle("up")}
        title="Good response"
        aria-label="Good response"
        aria-pressed={feedback === "up"}
        className={`rounded-md p-1 transition-colors ${feedback === "up" ? "text-emerald-600" : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"}`}
      >
        <ThumbsUp size={13} />
      </button>
      <button
        onClick={() => toggle("down")}
        title="Not helpful"
        aria-label="Not helpful"
        aria-pressed={feedback === "down"}
        className={`rounded-md p-1 transition-colors ${feedback === "down" ? "text-red-600" : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"}`}
      >
        <ThumbsDown size={13} />
      </button>
    </span>
  );
}

export default function Chatbot() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem("chat_session_id") || newSessionId());
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);

  const loadSessions = useCallback(() => {
    apiGet("/chat/sessions").then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    loadSessions();
    apiGet("/chat/suggestions").then(setSuggestions).catch(() => {});
  }, [loadSessions]);

  const refreshHistory = useCallback(() => {
    apiGet(`/chat/history/${sessionId}`)
      .then((h) => setMessages(h.map((m) => ({ id: m.id, role: m.role, content: m.content, feedback: m.feedback }))))
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    localStorage.setItem("chat_session_id", sessionId);
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const setFeedback = (messageId, feedback) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, feedback } : m)));
    apiPatch(`/chat/message/${messageId}/feedback`, { feedback }).catch(() => {
      // best-effort — feedback isn't critical path, don't interrupt the chat over it
    });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || streaming) return;
    setInput("");
    const history = messages;
    setMessages((prev) => [...prev, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let full = "";
      await apiPostStream(
        "/chat/stream",
        { session_id: sessionId, message, history },
        (chunk) => {
          full += chunk;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: full };
            return copy;
          });
        },
        { signal: controller.signal }
      );
    } catch (err) {
      if (err?.name === "AbortError") {
        // user pressed "stop generating" — keep whatever streamed so far
      } else {
        const msg = err instanceof ApiError ? err.message : "Something went wrong reaching the AI engine.";
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${msg}` };
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      loadSessions();
      refreshHistory(); // picks up real message ids (needed for the feedback buttons)
    }
  };

  const stopGenerating = () => abortRef.current?.abort();

  const regenerate = () => {
    if (streaming) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((prev) => (prev[prev.length - 1]?.role === "assistant" ? prev.slice(0, -1) : prev));
    send(lastUser.content);
  };

  const newConversation = () => {
    setSessionId(newSessionId());
    setMessages([]);
  };

  const selectSession = (id) => {
    if (id === sessionId) return;
    setSessionId(id);
  };

  const deleteSession = async (id) => {
    await apiDelete(`/chat/sessions/${id}`).catch(() => {});
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === sessionId) newConversation();
  };

  const renameSession = async (id, title) => {
    await apiPatch(`/chat/sessions/${id}`, { title }).catch(() => {});
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  };

  let lastAssistantIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      lastAssistantIdx = i;
      break;
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-soft lg:h-[calc(100vh-4.5rem)]">
      <ChatSidebar
        sessions={sessions}
        activeId={sessionId}
        onSelect={selectSession}
        onNew={newConversation}
        onDelete={deleteSession}
        onRename={renameSession}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <MessageSquare size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI Placement Chatbot</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ask about resumes, interviews, DSA topics, or placement strategy</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {messages.length === 0 && (
              <div className="mx-auto max-w-md py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Sparkles size={22} />
                </div>
                <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Try one of these to get started:</p>
                <div className="grid gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 transition-colors hover:border-brand-300 hover:bg-brand-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""} animate-fade-in`}>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      m.role === "user" ? "bg-slate-800 text-white" : "bg-brand-100 text-brand-700"
                    }`}
                  >
                    {m.role === "user" ? <User size={15} /> : <Sparkles size={15} />}
                  </div>
                  <div className={`flex min-w-0 max-w-[80%] flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm ${
                        m.role === "user" ? "bg-slate-800 text-white" : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      ) : m.content ? (
                        <Markdown>{m.content}</Markdown>
                      ) : (
                        <span className="inline-flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                        </span>
                      )}
                    </div>
                    {m.role === "assistant" && m.content && !(streaming && i === messages.length - 1) && (
                      <div className="mt-1 flex items-center gap-1">
                        <CopyButton text={m.content} />
                        <FeedbackButtons messageId={m.id} feedback={m.feedback} onSet={setFeedback} />
                        {i === lastAssistantIdx && (
                          <button
                            onClick={regenerate}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            <RotateCcw size={13} /> Regenerate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
          <form
            className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              aria-label="Message the placement assistant"
              className="max-h-[200px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder="Message the placement assistant..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={streaming}
            />
            {streaming ? (
              <button
                type="button"
                onClick={stopGenerating}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-900"
                title="Stop generating"
                aria-label="Stop generating"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                type="submit"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
                disabled={!input.trim()}
                title="Send"
                aria-label="Send message"
              >
                <Send size={15} />
              </button>
            )}
          </form>
          <p className="mt-1.5 text-center text-[11px] text-slate-400 dark:text-slate-500">
            AI-generated guidance can be imperfect — verify important placement details independently.
          </p>
        </div>
      </div>
    </div>
  );
}
