import { useEffect, useState } from "react";
import { ShieldCheck, Download, FileDown, Trophy, Users, Lock, LayoutGrid, BookOpen, BarChart3, AlertTriangle } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Spinner from "../components/Spinner.jsx";
import QuestionBankEditor from "../components/QuestionBankEditor.jsx";
import TrendsPanel from "../components/TrendCharts.jsx";
import { apiAdminGet, apiAdminPost, ApiError, getAdminPasscode, setAdminPasscode } from "../api/client.js";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "questions", label: "Question bank", icon: BookOpen },
  { key: "trends", label: "Trends", icon: BarChart3 },
];

const READINESS_STYLE = {
  green: "bg-emerald-100 text-emerald-700 dark:text-emerald-400",
  amber: "bg-amber-100 text-amber-700 dark:text-amber-400",
  red: "bg-red-100 text-red-700 dark:text-red-400",
};
const READINESS_LABEL = { green: "Ready", amber: "In progress", red: "Not started" };

function formatWhen(unixSecs) {
  if (!unixSecs) return "Never";
  const d = new Date(unixSecs * 1000);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function PasscodeGate({ onUnlock }) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAdminPasscode(passcode);
    try {
      await apiAdminGet("/admin/overview");
      onUnlock();
    } catch (err) {
      setAdminPasscode("");
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="card p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <ShieldCheck size={22} />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Placement Cell Admin</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter the department passcode to view cohort readiness.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            className="input text-center"
            type="password"
            placeholder="Passcode"
            aria-label="Passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
          />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full justify-center" disabled={loading || !passcode}>
            {loading ? <Spinner label="Checking..." /> : "Unlock"}
          </button>
        </form>
        <p className="mt-4 text-[11px] text-slate-400 dark:text-slate-500">
          Set with the ADMIN_PASSCODE variable in .env. Change it from the default before handing this app to the department.
        </p>
      </div>
    </div>
  );
}

function CountTile({ label, value }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  const load = () => {
    setError("");
    apiAdminGet("/admin/overview")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load overview."));
  };

  useEffect(load, []);

  const exportCsv = async () => {
    setExporting("csv");
    try {
      const res = await fetch("/api/admin/export.csv", { headers: { "X-Admin-Passcode": getAdminPasscode() } });
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "placement_readiness.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't export the CSV right now.");
    } finally {
      setExporting("");
    }
  };

  const exportPdf = async () => {
    setExporting("pdf");
    try {
      const { download_pdf } = await apiAdminPost("/admin/export/pdf", {});
      window.open(download_pdf, "_blank");
    } catch {
      setError("Couldn't export the PDF right now.");
    } finally {
      setExporting("");
    }
  };

  if (error) {
    return <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">{error}</div>;
  }
  if (!data) {
    return <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">Loading cohort data...</div>;
  }

  const { department_name, counts, students, leaderboard } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{department_name}</p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={exportCsv} disabled={!!exporting}>
            {exporting === "csv" ? <Spinner label="Exporting..." /> : <><Download size={15} /> Export CSV</>}
          </button>
          <button className="btn-secondary" onClick={exportPdf} disabled={!!exporting}>
            {exporting === "pdf" ? <Spinner label="Exporting..." /> : <><FileDown size={15} /> Export PDF report</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <CountTile label="Chat sessions" value={counts.chat_sessions} />
        <CountTile label="Resumes built" value={counts.resumes_built} />
        <CountTile label="Roadmaps" value={counts.roadmaps_generated} />
        <CountTile label="Mock interviews" value={counts.mock_interviews} />
        <CountTile label="Technical rounds" value={counts.technical_interviews} />
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Users size={16} className="text-brand-600" />
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Student readiness</h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">({students.length} students with recorded activity)</span>
        </div>
        {students.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">No student activity recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <th className="py-2 pr-3">Student</th>
                  <th className="py-2 pr-3">Stream / specialization</th>
                  <th className="py-2 pr-3">Sem</th>
                  <th className="py-2 pr-3">Last active</th>
                  <th className="py-2 pr-3">Resumes</th>
                  <th className="py-2 pr-3">DSA/Quiz solve rate</th>
                  <th className="py-2 pr-3">Mock interviews</th>
                  <th className="py-2 pr-3">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.name} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">
                      <span>{s.name}</span>
                      {s.violations_count > 0 && (
                        <span
                          title={`${s.violations_count} proctoring violation${s.violations_count === 1 ? "" : "s"} flagged during lockdown-mode sessions`}
                          className="badge ml-2 bg-amber-100 text-amber-700 dark:text-amber-400"
                        >
                          <AlertTriangle size={12} />
                          {s.violations_count} proctoring flag{s.violations_count === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">
                      {s.stream || <span className="text-slate-300">-</span>}
                      {s.specialization && <span className="text-slate-400 dark:text-slate-500"> · {s.specialization}</span>}
                    </td>
                    <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{s.semester || <span className="text-slate-300">-</span>}</td>
                    <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{formatWhen(s.last_active)}</td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">{s.resumes_count}</td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">
                      {s.technical.solve_rate}% <span className="text-slate-400 dark:text-slate-500">({s.technical.correct}/{s.technical.total})</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-400">
                      {s.mock.count}{s.mock.avg_score != null && <span className="text-slate-400 dark:text-slate-500"> (avg {s.mock.avg_score})</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`badge ${READINESS_STYLE[s.readiness] || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
                        {READINESS_LABEL[s.readiness] || s.readiness}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Trophy size={16} className="text-gold-600" />
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">DSA leaderboard</h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">department-wide, by problems solved</span>
        </div>
        {leaderboard.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">No solved DSA problems recorded yet.</p>
        ) : (
          <ol className="space-y-1.5">
            {leaderboard.map((r, i) => (
              <li key={r.name} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm even:bg-slate-50 dark:even:bg-slate-900">
                <span className="w-5 shrink-0 text-right font-semibold text-slate-400 dark:text-slate-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-200">{r.name}</span>
                <span className="text-slate-500 dark:text-slate-400">{r.solved} solved</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{r.accuracy}% accuracy</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function TabNav({ active, onChange, onLock }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>
      <button className="btn-secondary mb-1.5" onClick={onLock} title="Lock - clears the passcode from this browser">
        <Lock size={15} /> Lock
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (getAdminPasscode()) {
      apiAdminGet("/admin/overview")
        .then(() => setUnlocked(true))
        .catch(() => setAdminPasscode(""))
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  return (
    <div>
      <PageHeader
        icon={ShieldCheck}
        title="Placement Cell Admin"
        subtitle="Department-wide readiness view for the TPO team - passcode-protected, linked from the sidebar on every page."
      />
      {checking ? (
        <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : unlocked ? (
        <div className="space-y-5">
          <TabNav active={tab} onChange={setTab} onLock={() => { setAdminPasscode(""); setUnlocked(false); }} />
          {tab === "overview" && <Dashboard />}
          {tab === "questions" && <QuestionBankEditor />}
          {tab === "trends" && <TrendsPanel />}
        </div>
      ) : (
        <PasscodeGate onUnlock={() => setUnlocked(true)} />
      )}
    </div>
  );
}
