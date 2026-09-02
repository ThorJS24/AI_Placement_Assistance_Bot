import { useState } from "react";
import { GraduationCap, LogIn, UserPlus } from "lucide-react";
import Spinner from "../components/Spinner.jsx";
import { authLogin, authSignup, ApiError } from "../api/client.js";

export default function Login({ onAuthenticated, appTitle, departmentName, collegeName }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = mode === "login" ? await authLogin(username, password) : await authSignup(username, password);
      onAuthenticated(data.username);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-950 via-brand-900 to-brand-950 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-white">
            <GraduationCap size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{appTitle || "Placement Assistant"}</h1>
            {collegeName && <p className="text-xs text-slate-500 dark:text-slate-400">{collegeName}</p>}
            {departmentName && <p className="text-xs text-slate-400 dark:text-slate-500">{departmentName}</p>}
          </div>
        </div>

        <div className="mb-5 inline-flex w-full rounded-xl bg-slate-100 dark:bg-slate-900 p-1">
          {[
            { id: "login", label: "Log in" },
            { id: "signup", label: "Sign up" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setMode(t.id);
                setError("");
              }}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                mode === t.id ? "bg-white dark:bg-slate-800 text-brand-700 shadow-sm" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className="input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="input"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={mode === "signup" ? 8 : undefined}
              required
            />
            {mode === "signup" && (
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">At least 8 characters.</p>
            )}
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <button className="btn-primary w-full justify-center" type="submit" disabled={busy}>
            {busy ? (
              <Spinner label={mode === "login" ? "Logging in..." : "Creating account..."} />
            ) : mode === "login" ? (
              <><LogIn size={16} /> Log in</>
            ) : (
              <><UserPlus size={16} /> Create account</>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
          Runs locally on this PC — your account and history never leave this machine.
        </p>
      </div>
    </div>
  );
}
