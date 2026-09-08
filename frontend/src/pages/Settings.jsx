import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon, CheckCircle2, XCircle, AlertTriangle, TestTube2,
  ShieldCheck, Save, KeyRound, Cpu, Mic, Building2, Lock, Volume2, Sliders,
  ShieldAlert, Code2, Database, Play, Sparkles, RefreshCw, Sun, Moon, Layers
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Spinner from "../components/Spinner.jsx";
import {
  apiGet, apiPost, apiAdminGet, apiAdminPatch, ApiError, getAdminPasscode, setAdminPasscode,
} from "../api/client.js";

const TABS = [
  { id: "branding", label: "Branding & Campus", icon: Building2 },
  { id: "engine", label: "AI Engine & Model Tuning", icon: Cpu },
  { id: "voice", label: "Voice & Audio Studio", icon: Mic },
  { id: "lockdown", label: "Assessment Lockdown", icon: ShieldAlert },
  { id: "editor", label: "VS Code Editor & IDE", icon: Code2 },
  { id: "security", label: "Security & Admin Passcode", icon: KeyRound },
];

export default function Settings() {
  const [status, setStatus] = useState(null);
  const [activeTab, setActiveTab] = useState("branding");
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
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={SettingsIcon}
        title="Settings & System Configuration"
        subtitle="Manage institution branding, AI model parameters, voice synthesizer, assessment lockdown rules, and IDE preferences."
      />

      {loadError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">
          <XCircle size={16} /> Couldn't reach the backend API. Make sure the server is running.
        </div>
      )}

      {status && (
        <>
          {/* Top Status & Health Bar */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4 flex items-center justify-between border-l-4 border-l-brand-600">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Active AI Engine</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize mt-0.5">{status.active_engine || status.llm_backend}</p>
              </div>
              <Cpu className="text-brand-600" size={24} />
            </div>

            <div className="card p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Speech Engine</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize mt-0.5">{status.tts_backend} ({status.edge_tts_voice.split('-')[2] || "Voice"})</p>
              </div>
              <Mic className="text-emerald-500" size={24} />
            </div>

            <div className="card p-4 flex items-center justify-between border-l-4 border-l-gold-400">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Lockdown Status</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize mt-0.5">Strictness: {status.lockdown_strictness || "Medium"}</p>
              </div>
              <ShieldCheck className="text-gold-400" size={24} />
            </div>
          </div>

          {/* Settings Section Tab Navigation */}
          <DepartmentSettings status={status} onSaved={load} activeTab={activeTab} setActiveTab={setActiveTab} runTest={runTest} testing={testing} testResult={testResult} />
        </>
      )}
    </div>
  );
}

function DepartmentSettings({ status, onSaved, activeTab, setActiveTab, runTest, testing, testResult }) {
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
    <div className="card overflow-hidden">
      {/* Admin Passcode Lock Header */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-brand-600 dark:text-brand-400" />
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Department Administration Control Center</h3>
        </div>
        {unlocked && (
          <button
            className="btn-ghost text-xs text-slate-500 hover:text-slate-700"
            onClick={() => { setAdminPasscode(""); setUnlocked(false); }}
            title="Lock settings panel"
          >
            <Lock size={13} /> Lock Settings
          </button>
        )}
      </div>

      {checking ? (
        <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">Checking access authorization...</div>
      ) : unlocked ? (
        <div>
          {/* Tabs Bar */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeTab === id
                    ? "border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400 bg-white dark:bg-slate-800"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            <DepartmentSettingsForm
              status={status}
              onSaved={onSaved}
              activeTab={activeTab}
              runTest={runTest}
              testing={testing}
              testResult={testResult}
            />
          </div>
        </div>
      ) : (
        <div className="p-8 max-w-md mx-auto text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40">
            <Lock size={24} />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Department settings affect every student on this deployment. Enter the admin passcode to unlock editing access.
          </p>
          <form onSubmit={unlock} className="space-y-3">
            <input
              className="input text-center font-mono text-base"
              type="password"
              placeholder="Enter Admin Passcode"
              aria-label="Admin passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
            />
            <button className="btn-primary w-full justify-center" disabled={gateLoading || !passcode}>
              {gateLoading ? <Spinner label="Unlocking..." /> : <><ShieldCheck size={16} /> Unlock Administration</>}
            </button>
            {gateError && <p role="alert" className="text-xs font-semibold text-red-600">{gateError}</p>}
          </form>
        </div>
      )}
    </div>
  );
}

function DepartmentSettingsForm({ status, onSaved, activeTab, runTest, testing, testResult }) {
  const [appTitle, setAppTitle] = useState(status.app_title || "");
  const [collegeName, setCollegeName] = useState(status.college_name || "");
  const [departmentName, setDepartmentName] = useState(status.department_name || "");
  const [llmBackend, setLlmBackend] = useState(status.llm_backend || "auto");
  const [voice, setVoice] = useState(status.edge_tts_voice || "");
  const [voices, setVoices] = useState([]);

  // AI Tuning
  const [temperature, setTemperature] = useState(status.temperature || "0.7");
  const [maxTokens, setMaxTokens] = useState(status.max_tokens || "1024");
  const [persona, setPersona] = useState(status.interviewer_persona || "mentor");

  // Voice Speech Speed
  const [speechRate, setSpeechRate] = useState(status.speech_rate || "1.0");

  // Lockdown
  const [strictness, setStrictness] = useState(status.lockdown_strictness || "medium");
  const [tabLimit, setTabLimit] = useState(status.tab_switch_limit || "3");

  // Editor
  const [fontSize, setFontSize] = useState(status.editor_font_size || "14");
  const [editorTheme, setEditorTheme] = useState(status.editor_theme || "vscode-dark");

  // Security Passcode
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
      flash(true, "Branding updated. Reloading page...");
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

  const saveTuning = async (e) => {
    e.preventDefault();
    setSaving("tuning");
    try {
      await apiAdminPatch("/settings/tuning", {
        temperature, max_tokens: maxTokens, interviewer_persona: persona
      });
      flash(true, "AI Model Tuning parameters saved successfully.");
      onSaved();
    } catch (err) {
      flash(false, err instanceof ApiError ? err.message : "Couldn't save AI tuning.");
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

  const playVoicePreview = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const text = "Welcome to CHRIST (Deemed to be University) AI Placement Assistant. I am ready to conduct your interview.";
    const u = new SpeechSynthesisUtterance(text);
    u.rate = parseFloat(speechRate) || 1.0;
    window.speechSynthesis.speak(u);
  };

  const saveLockdown = async (e) => {
    e.preventDefault();
    setSaving("lockdown");
    try {
      await apiAdminPatch("/settings/lockdown", {
        strictness, tab_switch_limit: tabLimit
      });
      flash(true, "Assessment lockdown rules saved successfully.");
      onSaved();
    } catch (err) {
      flash(false, err instanceof ApiError ? err.message : "Couldn't save lockdown rules.");
    } finally {
      setSaving("");
    }
  };

  const saveEditor = async (e) => {
    e.preventDefault();
    setSaving("editor");
    try {
      await apiAdminPatch("/settings/editor", {
        font_size: fontSize, theme: editorTheme
      });
      flash(true, "VS Code Editor IDE preferences saved.");
      onSaved();
    } catch (err) {
      flash(false, err instanceof ApiError ? err.message : "Couldn't save editor preferences.");
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
      flash(true, "Admin passcode changed successfully.");
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
          className={`rounded-xl p-4 text-sm font-semibold flex items-center justify-between ${message.ok ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400"}`}
        >
          <span>{message.text}</span>
          {message.ok && <CheckCircle2 size={18} />}
        </div>
      )}

      {/* TAB 1: BRANDING & CAMPUS */}
      {activeTab === "branding" && (
        <form onSubmit={saveBranding} className="space-y-4 max-w-2xl">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Institutional Branding</h4>
            <p className="text-xs text-slate-500">Configure application headers, department title, and university credentials.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="settings-app-title">Application Title</label>
              <input id="settings-app-title" className="input" value={appTitle} onChange={(e) => setAppTitle(e.target.value)} placeholder="AI Placement Assistance Platform" />
            </div>
            <div>
              <label className="label" htmlFor="settings-college-name">University / Institution</label>
              <input id="settings-college-name" className="input" value={collegeName} onChange={(e) => setCollegeName(e.target.value)} placeholder="CHRIST (Deemed to be University)" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="settings-department-name">Department Name</label>
            <input id="settings-department-name" className="input" value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="Department of Computer Science and Engineering" />
          </div>
          <button className="btn-primary" disabled={saving === "branding"}>
            {saving === "branding" ? <Spinner label="Saving..." /> : <><Save size={16} /> Save Institutional Branding</>}
          </button>
        </form>
      )}

      {/* TAB 2: AI ENGINE & TUNING */}
      {activeTab === "engine" && (
        <div className="space-y-6 max-w-2xl">
          <div className="space-y-3">
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Active AI Model Backend</h4>
            <p className="text-xs text-slate-500">Select which engine powers chatbot, roadmap generation, and live interview responses.</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "auto", label: "Auto (Smart Fallback)" },
                { id: "ollama", label: "Ollama (Local)" },
                { id: "groq", label: "Groq (Cloud)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => saveEngine(opt.id)}
                  disabled={saving === "engine"}
                  className={`rounded-xl border p-3 text-sm font-bold text-center transition-all ${
                    llmBackend === opt.id
                      ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={saveTuning} className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Model Generation Parameters</h4>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Creativity Temperature: <span className="font-bold text-brand-600">{temperature}</span></label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-400">Lower = deterministic DSA &amp; code; Higher = creative interview answers.</p>
              </div>

              <div>
                <label className="label">Max Token Limit</label>
                <select className="input" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)}>
                  <option value="512">512 Tokens (Fast &amp; Crisp)</option>
                  <option value="1024">1024 Tokens (Standard)</option>
                  <option value="2048">2048 Tokens (Detailed Roadmaps)</option>
                  <option value="4096">4096 Tokens (Full Code Output)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Interviewer AI Persona</label>
              <select className="input" value={persona} onChange={(e) => setPersona(e.target.value)}>
                <option value="mentor">Empathetic Senior Placement Mentor (Encouraging &amp; Constructive)</option>
                <option value="lead">Senior Tech Lead (Technical Focus &amp; Deep Architecture)</option>
                <option value="recruiter">Strict FAANG Recruiter (High Standard &amp; Time Pressure)</option>
              </select>
            </div>

            <button className="btn-primary" disabled={saving === "tuning"}>
              {saving === "tuning" ? <Spinner label="Saving..." /> : <><Sliders size={16} /> Save Model Parameters</>}
            </button>
          </form>

          {/* Engine Connection Test */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">Engine Connection Diagnostic</h4>
            <button className="btn-secondary" onClick={runTest} disabled={testing}>
              {testing ? <Spinner label="Testing connection..." /> : <><TestTube2 size={16} /> Run Live Engine Ping Test</>}
            </button>
            {testResult && (
              <div role="status" className={`mt-3 rounded-xl p-3 text-sm font-semibold ${testResult.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"}`}>
                {testResult.reply}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VOICE & AUDIO STUDIO */}
      {activeTab === "voice" && (
        <div className="space-y-5 max-w-2xl">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Live AI Interview Voice Synthesizer</h4>
            <p className="text-xs text-slate-500">Configure voice tone and speech rate for hands-free mock interviews.</p>
          </div>

          <div>
            <label className="label">Interviewer Voice Accent &amp; Gender</label>
            <div className="flex gap-2">
              <select className="input flex-1" value={voice} onChange={(e) => saveVoice(e.target.value)} disabled={saving === "voice" || voices.length === 0}>
                {voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              <button onClick={playVoicePreview} type="button" className="btn-secondary shrink-0" title="Listen to sample audio">
                <Volume2 size={16} /> Test Audio 🔊
              </button>
            </div>
          </div>

          <div>
            <label className="label">Speech Speed Rate: <span className="font-bold text-brand-600">{speechRate}x</span></label>
            <input
              type="range"
              min="0.75"
              max="1.5"
              step="0.05"
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
              value={speechRate}
              onChange={(e) => setSpeechRate(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-400">1.0x is natural human pace; 1.2x speeds up mock interview practice.</p>
          </div>
        </div>
      )}

      {/* TAB 4: ASSESSMENT LOCKDOWN */}
      {activeTab === "lockdown" && (
        <form onSubmit={saveLockdown} className="space-y-4 max-w-2xl">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Anti-Cheating &amp; Lockdown Configuration</h4>
            <p className="text-xs text-slate-500">Rules applied during proctored technical coding assessments.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Proctoring Enforcement Mode</label>
              <select className="input" value={strictness} onChange={(e) => setStrictness(e.target.value)}>
                <option value="lenient">Lenient (Warnings only, no auto-submit)</option>
                <option value="medium">Standard (Auto-submit on 3 violations)</option>
                <option value="strict">Strict (Immediate lockdown &amp; fullscreen block)</option>
              </select>
            </div>

            <div>
              <label className="label">Max Allowed Tab Switches</label>
              <select className="input" value={tabLimit} onChange={(e) => setTabLimit(e.target.value)}>
                <option value="1">1 Tab Switch Allowed</option>
                <option value="2">2 Tab Switches Allowed</option>
                <option value="3">3 Tab Switches Allowed (Recommended)</option>
                <option value="5">5 Tab Switches Allowed</option>
              </select>
            </div>
          </div>

          <button className="btn-primary" disabled={saving === "lockdown"}>
            {saving === "lockdown" ? <Spinner label="Saving..." /> : <><ShieldAlert size={16} /> Save Lockdown Configuration</>}
          </button>
        </form>
      )}

      {/* TAB 5: VS CODE EDITOR & IDE */}
      {activeTab === "editor" && (
        <form onSubmit={saveEditor} className="space-y-4 max-w-2xl">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">VS Code Technical Editor Preferences</h4>
            <p className="text-xs text-slate-500">Customize font size and layout of the in-browser IDE.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Editor Font Size: <span className="font-bold text-brand-600">{fontSize}px</span></label>
              <input
                type="range"
                min="12"
                max="20"
                step="1"
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Editor Theme Preset</label>
              <select className="input" value={editorTheme} onChange={(e) => setEditorTheme(e.target.value)}>
                <option value="vscode-dark">VS Code Dark+ (Official)</option>
                <option value="one-dark">Atom One Dark</option>
                <option value="monokai">Monokai Pro</option>
                <option value="github-dark">GitHub Dark Default</option>
              </select>
            </div>
          </div>

          <button className="btn-primary" disabled={saving === "editor"}>
            {saving === "editor" ? <Spinner label="Saving..." /> : <><Code2 size={16} /> Save IDE Preferences</>}
          </button>
        </form>
      )}

      {/* TAB 6: SECURITY & PASSCODE */}
      {activeTab === "security" && (
        <form onSubmit={savePasscode} className="space-y-4 max-w-2xl">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Administration Access Passcode</h4>
            <p className="text-xs text-slate-500">Protects TPO Placement Cell Dashboard and Department Settings.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Current Passcode</label>
              <input className="input" type="password" placeholder="Current passcode" value={currentPasscode} onChange={(e) => setCurrentPasscode(e.target.value)} />
            </div>
            <div>
              <label className="label">New Passcode</label>
              <input className="input" type="password" placeholder="Min 4 characters" value={newPasscode} onChange={(e) => setNewPasscode(e.target.value)} />
            </div>
            <div>
              <label className="label">Confirm New Passcode</label>
              <input className="input" type="password" placeholder="Confirm passcode" value={confirmPasscode} onChange={(e) => setConfirmPasscode(e.target.value)} />
            </div>
          </div>

          <button className="btn-secondary" disabled={saving === "passcode" || !currentPasscode || !newPasscode}>
            {saving === "passcode" ? <Spinner label="Saving..." /> : <><KeyRound size={16} /> Update Admin Passcode</>}
          </button>
        </form>
      )}
    </div>
  );
}
