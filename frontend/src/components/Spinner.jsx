import { Loader2 } from "lucide-react";

export default function Spinner({ label, size = 16, className = "" }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 ${className}`}
    >
      <Loader2 size={size} className="animate-spin" aria-hidden="true" />
      {label}
    </span>
  );
}
