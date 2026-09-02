import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon, CheckCircle2, XCircle, AlertTriangle, TestTube2,
  ShieldCheck, Save, KeyRound, Cpu, Mic, Building2, Lock,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Spinner from "../components/Spinner.jsx";
import {
  apiGet, apiPost, apiAdminGet, apiAdminPatch, ApiError, getAdminPasscode, setAdminPasscode,
} from "../api/client.js";

export default function Settings() {
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    apiGet("/settings/status").then(setStatus).catch(() => setLoadError(true));
  };

  useEffect(load, []);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiPost("/settings/test", {});
      setTestResult(res);
    } catch {
      setTestResult({ ok: false, reply: "Request failed." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <PageHeader icon={SettingsIcon} title="Settings" subtitle="Configure this deployment's branding, AI engine, admin passcode, and interview voice - plus diagnose the AI/speech engines." />

      {loadError && (
        <div role="alert" className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">
          <XCircle size={16} /> Couldn't reach the backend API. Make sure the server is running.
        </div>
      )}

      {status && (
        <div className="space-y-5">
          <DepartmentSettings status={status} onSaved={load} />

          <div className="grid gap-4 sm:grid-cols-2">
            <EngineCard
              title="💻 Ollama (local)"
              reachable={status.ollama.reachable}
              detail={status.ollama.detail}
              meta={`Host: ${status.ollama.host} · Model: ${status.ollama.model}`}
              instructions={[
                "Download Ollama for free: https://ollama.com/download",
                "Install it and make sure it's running (starts automatically in the background).",
                `Open a terminal and run: ollama pull ${status.ollama.model}`,
                "Refresh this page - the status above should turn green.",
              ]}
            />
            <EngineCard
              title="☁️ Groq (cloud, optional)"
              reachable={status.groq.reachable}
              detail={status.groq.detail}
              meta={`Model: ${status.groq.model}`}
              instructions={[
                "Create a free account: https://console.groq.com",
                "Generate an API key: https://console.groq.com/keys",
                "Open the .env file in the project root and set GROQ_API_KEY=your_key_here",
                "Restart the app.",
              ]}
            />
          </div>

          <div className="card p-5">
            <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Active mode: <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5">LLM_BACKEND={status.llm_backend}</code></p>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Right now, chat requests will be served by: <strong>{status.active_engine}</strong>
            </p>
            <button className="btn-secondary" onClick={runTest} disabled={testing}>
              {testing ? <Spinner label="Waiting for a response..." /> : <><TestTube2 size={16} /> Send a test message to the AI engine</>}
            </button>
            {testResult && (
              <div role="status" aria-live="polite" className={`mt-3 rounded-xl p-3 text-sm ${testResult.ok ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"}`}>
                {testResult.reply}
              </div>
            )}
          </div>

          <div className="card grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">🎙️ Speech-to-text</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Backend: <code>{status.stt_backend}</code></p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Local model size: <code>{status.whisper_model_size}</code></p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">🔊 Text-to-speech</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Backend: <code>{status.tts_backend}</code></p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Edge voice: <code>{status.edge_tts_voice}</code> - change it in Department Settings above.</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">STT backend / Whisper model size are deployment-level and only change via the .env file + restart.</p>
        </div>
      )}
    </div>
  );
}

function EngineCard({ title, reachable, detail, meta, instructions }) {
  return (
    <div className="card p-5">
      <h3 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <div className={`mb-2 flex items-start gap-2 rounded-xl p-3 text-sm ${reachable ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"}`}>
        {reachable ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
        {detail}
      </div>
      <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">{meta}</p>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-slate-600 dark:text-slate-400">Setup instructions</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-500 dark:text-slate-400">
          {instructions.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </details>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Department Settings - real, persisted, live-effective configuration.
// Gated behind the same admin passcode as the TPO dashboard (shared
// sessionStorage token), since these affect every student on this shared
// deployment, not just whoever's sitting at the PC right now.
// ---------------------------------------------------------------------------

function DepartmentSettings({ status, onSaved }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateLoading, setGateLoading] = useState(false);

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

  const unlock = async (e) => {
    e.preventDefault();
    setGateLoading(true);
    setGateError("");
    setAdminPasscode(passcode);
    try {
      await apiAdminGet("/admin/overview");
      setUnlocked(true);
    } catch (err) {
      setAdminPasscode("");
      setGateError(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setGateLoading(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-brand-600" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Department Settings</h3>
        </div>
        {unlocked && (
          <button
            className="btn-ghost text-xs"
            onClick={() => { setAdminPasscode(""); setUnlocked(false); }}
            title="Lock - clears the passcode from this browser"
          >
            <Lock size={13} /> Lock
          </button>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Branding, AI engine, and the placement-cell passcode - changes here apply immediately for every student, no restart needed.
      </p>

      {checking ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Checking access...</p>
      ) : unlocked ? (
        <DepartmentSettingsForm status={status} onSaved={onSaved} />
      ) : (
        <form onSubmit={unlock} className="flex flex-wrap items-center gap-2">
          <input
            className="input max-w-[220px]"
            type="password"
            placeholder="Admin passcode"
            aria-label="Admin passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
          <button className="btn-secondary" disabled={gateLoading || !passcode}>
            {gateLoading ? <Spinner label="Checking..." /> : <><ShieldCheck size={15} /> Unlock</>}
          </button>
          {gateError && <span role="alert" className="text-sm text-red-600">{gateError}</span>}
        </form>
      )}
    </div>
  );
}

function DepartmentSettingsForm({ status, onSaved }) {
  const [appTitle, setAppTitle] = useState(status.app_title || "");
  const [collegeName, setCollegeName] = useState(status.college_name || "");
  const [departmentName, setDepartmentName] = useState(status.department_name || "");
  const [llmBackend, setLlmBackend] = useState(status.llm_backend || "auto");
  const [voice, setVoice] = useState(status.edge_tts_voice || "");
  const [voices, setVoices] = useState([]);

  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");

  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    apiGet("/settings/voices").then(setVoices).catch(() => {});
  }, []);

  const flash = (ok, text) => {
    setMessage({ ok, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const saveBranding = async (e) => {
    e.preventDefault();
    setSaving("branding");
    try {
      await apiAdminPatch("/settings/branding", {
        app_title: appTitle, college_name: collegeName, department_name: departmentName,
      });
      flash(true, "Branding updated. Reloading to apply it everywhere...");
      onSaved();
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      flash(false, err instanceof ApiError ? err.message : "Couldn't save branding.");
    } finally {
      setSaving("");
    }
  };

  const saveEngine = async (backend) => {
    setLlmBackend(backend);
    setSaving("engine");
    try {
      await apiAdminPatch("/settings/engine", { llm_backend: backend });
      flash(true, `AI engine preference set to "${backend}".`);
      onSaved();
    } catch (err) {
      flash(false, err instanceof ApiError ? err.message : "Couldn't save engine preference.");
    } finally {
      setSaving("");
    }
  };

  const saveVoice = async (voiceId) => {
    setVoice(voiceId);
    setSaving("voice");
    try {
      await apiAdminPatch("/settings/voice", { edge_tts_voice: voiceId });
      flash(true, "Interview voice updated.");
      onSaved();
    } catch (err) {
      flash(false, err instanceof ApiError ? err.message : "Couldn't save voice.");
    } finally {
      setSaving("");
    }
  };

  const savePasscode = async (e) => {
    e.preventDefault();
    if (newPasscode !== confirmPasscode) {
      flash(false, "New passcode and confirmation don't match.");
      return;
    }
    setSaving("passcode");
    try {
      await apiAdminPatch("/settings/passcode", { current_passcode: currentPasscode, new_passcode: newPasscode });
      setAdminPasscode(newPasscode);
      setCurrentPasscode("");
      setNewPasscode("");
      setConfirmPasscode("");
      flash(true, "Admin passcode changed.");
    } catch (err) {
      flash(false, err instanceof ApiError ? err.message : "Couldn't change passcode.");
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="space-y-5">
      {message && (
        <div
          role={message.ok ? "status" : "alert"}
          aria-live={message.ok ? "polite" : "assertive"}
          className={`rounded-xl p-3 text-sm ${message.ok ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"}`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={saveBranding} className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Branding</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="settings-app-title">App title</label>
            <input id="settings-app-title" className="input" value={appTitle} onChange={(e) => setAppTitle(e.target.value)} placeholder="AI Placement Assistance Platform" />
          </div>
          <div>
            <label className="label" htmlFor="settings-college-name">College / University</label>
            <input id="settings-college-name" className="input" value={collegeName} onChange={(e) => setCollegeName(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="settings-department-name">Department</label>
          <input id="settings-department-name" className="input" value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="Department of Computer Science and Engineering" />
        </div>
        <button className="btn-primary" disabled={saving === "branding"}>
          {saving === "branding" ? <Spinner label="Saving..." /> : <><Save size={15} /> Save branding</>}
        </button>
      </form>

      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300"><Cpu size={15} /> AI engine preference</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Which engine the chatbot, roadmap, and interview modules prefer. "Auto" tries Groq first (if configured) and falls back to Ollama.</p>
        <div className="flex flex-wrap gap-2">
          {["auto", "ollama", "groq"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => saveEngine(opt)}
              disabled={saving === "engine"}
              className={`rounded-xl border px-3.5 py-2 text-sm font-medium capitalize transition-colors ${
                llmBackend === opt ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300"><Mic size={15} /> Mock Interview voice</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Used when the Edge TTS engine is active for spoken interview questions.</p>
        <select aria-label="Mock Interview voice" className="input max-w-xs" value={voice} onChange={(e) => saveVoice(e.target.value)} disabled={saving === "voice" || voices.length === 0}>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
      </div>

      <form onSubmit={savePasscode} className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300"><KeyRound size={15} /> Change admin passcode</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Protects this Department Settings panel and the Placement Cell Admin dashboard. Change it from the insecure default before handing this app to the department.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="input" type="password" placeholder="Current passcode" aria-label="Current passcode" value={currentPasscode} onChange={(e) => setCurrentPasscode(e.target.value)} />
          <input className="input" type="password" placeholder="New passcode (min 4 chars)" aria-label="New passcode (min 4 chars)" value={newPasscode} onChange={(e) => setNewPasscode(e.target.value)} />
          <input className="input" type="password" placeholder="Confirm new passcode" aria-label="Confirm new passcode" value={confirmPasscode} onChange={(e) => setConfirmPasscode(e.target.value)} />
        </div>
        <button className="btn-secondary" disabled={saving === "passcode" || !currentPasscode || !newPasscode}>
          {saving === "passcode" ? <Spinner label="Saving..." /> : <><KeyRound size={15} /> Change passcode</>}
        </button>
      </form>
    </div>
  );
}
