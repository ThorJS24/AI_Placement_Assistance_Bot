import { useEffect, useState } from "react";
import { Cloud, Laptop, AlertTriangle } from "lucide-react";
import { apiGet } from "../api/client.js";

export default function StatusPill() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await apiGet("/settings/status");
        if (!cancelled) {
          setStatus(data);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    };
    poll();
    // 45s instead of 20s: each poll does a live health-check round trip to
    // Ollama/Groq on the backend (core/llm.py's check_ollama/check_groq),
    // so polling every tab that's open more often than needed adds real,
    // pointless network chatter for information that rarely changes.
    const id = setInterval(poll, 45000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) {
    return (
      <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs font-medium text-red-300">
        <AlertTriangle size={14} />
        Backend unreachable
      </div>
    );
  }
  if (!status) {
    return <div role="status" aria-live="polite" className="h-4 w-32 animate-pulse-soft rounded bg-white/10"><span className="sr-only">Checking backend status...</span></div>;
  }

  const engine = status.active_engine;
  const label = engine === "groq" ? "Groq (cloud)" : engine === "ollama" ? "Ollama (local)" : "No AI engine";
  const Icon = engine === "groq" ? Cloud : engine === "ollama" ? Laptop : AlertTriangle;
  const color = engine === "none" ? "text-amber-300" : "text-emerald-300";

  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-2 text-xs font-semibold ${color}`}>
      <Icon size={14} />
      {label}
    </div>
  );
}
