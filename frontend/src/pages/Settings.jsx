import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon, CheckCircle2, XCircle, AlertTriangle, TestTube2,
  ShieldCheck, Save, KeyRound, Cpu, Mic, Building2, Lock, Volume2, Sliders,
  ShieldAlert, Code2, Database, Play, Sparkles, RefreshCw, Sun, Moon, Layers,
  User, BookOpen, Target, Palette, Bell, SlidersHorizontal, Check, Briefcase
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Spinner from "../components/Spinner.jsx";
import {
  apiGet, apiPost, apiAdminGet, apiAdminPatch, ApiError, getAdminPasscode, setAdminPasscode,
} from "../api/client.js";
import {
  getLocalPreferences, syncPreferences, COLOR_THEMES, FONT_SIZES
} from "../lib/preferences.js";

const STUDENT_TABS = [
  { id: "profile", label: "Academic Profile & Career", icon: User },
  { id: "appearance", label: "Appearance & Theme", icon: Palette },
  { id: "ide", label: "IDE & Coding Judge", icon: Code2 },
  { id: "audio", label: "Voice & Speech Studio", icon: Mic },
];

const ADMIN_TABS = [
  { id: "branding", label: "Branding & Campus", icon: Building2 },
  { id: "engine", label: "AI Models & Engine Tuning", icon: Cpu },
  { id: "lockdown", label: "Assessment Lockdown Rules", icon: ShieldAlert },
  { id: "security", label: "Security & Passcode", icon: KeyRound },
];

export default function Settings() {
  const [section, setSection] = useState("student"); // "student" | "admin"
  const [activeTab, setActiveTab] = useState("profile");
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const loadStatus = () => {
    apiGet("/settings/status").then(setStatus).catch(() => setLoadError(true));
  };

  useEffect(loadStatus, []);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        icon={SettingsIcon}
        title="Settings & Preferences"
        subtitle="Manage your student academic profile, UI appearance, code editor preferences, voice settings, and department administration."
      />

      {loadError && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">
          <XCircle size={16} /> Couldn't reach the backend API. Make sure the server is running.
        </div>
      )}

      {/* Main Section Switcher: Student Preferences vs Department Admin */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white dark:bg-slate-800 p-2 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-1 w-full sm:w-auto">
          <button
            onClick={() => { setSection("student"); setActiveTab("profile"); }}
            className={`flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all ${
              section === "student"
                ? "bg-white dark:bg-slate-800 text-brand-700 dark:text-brand-300 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <User size={16} /> Student Preferences
          </button>
          <button
            onClick={() => { setSection("admin"); setActiveTab("branding"); }}
            className={`flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all ${
              section === "admin"
                ? "bg-white dark:bg-slate-800 text-brand-700 dark:text-brand-300 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Building2 size={16} /> Department Administration 🔒
          </button>
        </div>

        <div className="flex items-center gap-3 px-3">
          <span className="text-xs text-slate-400">
            {section === "student" ? "Unlocked Personal Settings" : "Admin Protected Control Panel"}
          </span>
        </div>
      </div>

      {section === "student" ? (
        <StudentSettingsContainer activeTab={activeTab} setActiveTab={setActiveTab} />
      ) : (
        status && <AdminSettingsContainer status={status} onSaved={loadStatus} activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </div>
  );
}

/* ===========================================================================
 * STUDENT PREFERENCES CONTAINER (Unlocked - accessible to all students)
 * =========================================================================== */

function StudentSettingsContainer({ activeTab, setActiveTab }) {
  return (
    <div className="card overflow-hidden">
      {/* Student Sub-Tabs Bar */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 overflow-x-auto">
        {STUDENT_TABS.map(({ id, label, icon: Icon }) => (
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
        {activeTab === "profile" && <StudentProfileSection />}
        {activeTab === "appearance" && <StudentAppearanceSection />}
        {activeTab === "ide" && <StudentIDESection />}
        {activeTab === "audio" && <StudentAudioSection />}
      </div>
    </div>
  );
}

function StudentProfileSection() {
  const [profile, setProfile] = useState({
    stream: "", specialization: "", semester: "", subjects: [], target_role: "", target_companies: ""
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [subjectsText, setSubjectsText] = useState("");

  useEffect(() => {
    apiGet("/profile").then((data) => {
      if (data) {
        setProfile(data);
        if (data.subjects) setSubjectsText(data.subjects.join(", "));
      }
    }).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const subs = subjectsText.split(",").map(s => s.trim()).filter(Boolean);
      const updated = await apiPost("/profile", {
        stream: profile.stream,
        specialization: profile.specialization,
        semester: profile.semester,
        subjects: subs,
      });
      setProfile(updated);
      setMsg({ ok: true, text: "Academic Profile updated successfully." });
    } catch {
      setMsg({ ok: false, text: "Failed to save profile." });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3500);
    }
  };

  return (
    <form onSubmit={save} className="space-y-5 max-w-2xl">
      <div>
        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Academic Profile &amp; Career Path</h4>
        <p className="text-xs text-slate-500">The AI uses your stream, semester, and target role to personalize roadmaps, interview questions, and chatbot advice.</p>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-sm font-semibold ${msg.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Academic Stream / Degree</label>
          <input
            className="input"
            value={profile.stream || ""}
            onChange={(e) => setProfile({ ...profile, stream: e.target.value })}
            placeholder="e.g. B.Tech Computer Science"
          />
        </div>

        <div>
          <label className="label">Specialization / Domain</label>
          <input
            className="input"
            value={profile.specialization || ""}
            onChange={(e) => setProfile({ ...profile, specialization: e.target.value })}
            placeholder="e.g. Artificial Intelligence / Data Science"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Current Semester</label>
          <select
            className="input"
            value={profile.semester || ""}
            onChange={(e) => setProfile({ ...profile, semester: e.target.value })}
          >
            <option value="">Select Semester</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={String(s)}>Semester {s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Target Career Role</label>
          <select
            className="input"
            value={profile.target_role || "Software Engineer"}
            onChange={(e) => setProfile({ ...profile, target_role: e.target.value })}
          >
            <option value="Software Engineer">Software Engineer (General)</option>
            <option value="Backend Developer">Backend Developer (Python/Node/Java)</option>
            <option value="Full Stack Engineer">Full Stack Web Engineer (MERN/React)</option>
            <option value="AI/ML Engineer">AI / Machine Learning Engineer</option>
            <option value="Data Scientist">Data Scientist &amp; Analyst</option>
            <option value="Cloud DevOps Engineer">Cloud &amp; DevOps Engineer</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Current Semester Subjects (comma-separated)</label>
        <input
          className="input"
          value={subjectsText}
          onChange={(e) => setSubjectsText(e.target.value)}
          placeholder="Data Structures, DBMS, Operating Systems, Computer Networks"
        />
      </div>

      <button className="btn-primary" disabled={saving}>
        {saving ? <Spinner label="Saving..." /> : <><Save size={16} /> Save Student Academic Profile</>}
      </button>
    </form>
  );
}

function StudentAppearanceSection() {
  const [prefs, setPrefs] = useState(getLocalPreferences());

  const update = (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    syncPreferences(patch);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Appearance &amp; User Interface</h4>
        <p className="text-xs text-slate-500">Preferences apply instantly across all pages and sync to your browser.</p>
      </div>

      {/* Dark / Light Mode */}
      <div className="space-y-2">
        <label className="label">Theme Mode</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { id: "light", label: "Light Mode", icon: Sun },
            { id: "dark", label: "Dark Mode", icon: Moon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => update({ dark_mode: id })}
              className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold transition-all ${
                prefs.dark_mode === id
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                  : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Institutional Color Themes */}
      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        <label className="label">Institutional Color Ramp</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLOR_THEMES.map((theme) => (
            <button
              key={theme.id}
              onClick={() => update({ color_theme: theme.id })}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm font-bold text-left transition-all ${
                prefs.color_theme === theme.id
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                  : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <span className="h-4 w-4 shrink-0 rounded-full border shadow-sm" style={{ backgroundColor: theme.swatch }} />
              <span className="truncate">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        <label className="label">Application Font Size</label>
        <div className="grid grid-cols-3 gap-3">
          {FONT_SIZES.map((fs) => (
            <button
              key={fs.id}
              onClick={() => update({ font_size: fs.id })}
              className={`rounded-xl border p-2.5 text-sm font-bold text-center transition-all ${
                prefs.font_size === fs.id
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                  : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {fs.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StudentIDESection() {
  const [lang, setLang] = useState(() => localStorage.getItem("preferred_lang") || "python");
  const [editorFontSize, setEditorFontSize] = useState(() => localStorage.getItem("editor_font_size") || "14");

  const saveLang = (l) => {
    setLang(l);
    localStorage.setItem("preferred_lang", l);
  };

  const saveSize = (sz) => {
    setEditorFontSize(sz);
    localStorage.setItem("editor_font_size", sz);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">VS Code IDE &amp; Technical Judge Preferences</h4>
        <p className="text-xs text-slate-500">Configure default coding language and editor font size for the technical interview workspace.</p>
      </div>

      <div>
        <label className="label">Default Coding Language</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { id: "python", label: "Python 3" },
            { id: "cpp", label: "C++ 17" },
            { id: "java", label: "Java 17" },
            { id: "javascript", label: "JavaScript (Node.js)" },
            { id: "go", label: "Go 1.21" },
            { id: "sql", label: "SQL (PostgreSQL / SQLite)" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => saveLang(item.id)}
              className={`rounded-xl border p-3 text-sm font-bold text-center transition-all ${
                lang === item.id
                  ? "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                  : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
        <label className="label">Code Editor Font Size: <span className="font-bold text-brand-600">{editorFontSize}px</span></label>
        <input
          type="range"
          min="12"
          max="20"
          step="1"
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
          value={editorFontSize}
          onChange={(e) => saveSize(e.target.value)}
        />
      </div>
    </div>
  );
}

function StudentAudioSection() {
  const [speechRate, setSpeechRate] = useState(() => localStorage.getItem("speech_rate") || "1.0");
  const [autoTTS, setAutoTTS] = useState(() => localStorage.getItem("auto_tts") === "1");

  const saveRate = (r) => {
    setSpeechRate(r);
    localStorage.setItem("speech_rate", r);
  };

  const toggleAutoTTS = () => {
    const next = !autoTTS;
    setAutoTTS(next);
    localStorage.setItem("auto_tts", next ? "1" : "0");
  };

  const playTestAudio = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("This is a test of your interview speech synthesis settings at " + speechRate + "x speed.");
    u.rate = parseFloat(speechRate) || 1.0;
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Voice Interview &amp; Text-To-Speech Studio</h4>
        <p className="text-xs text-slate-500">Configure speech rate and auto-read out loud features for chat and mock interviews.</p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Auto-Read AI Answers Out Loud</p>
          <p className="text-xs text-slate-500">Automatically speak AI response text in Chatbot and Mock Interview.</p>
        </div>
        <button
          onClick={toggleAutoTTS}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            autoTTS ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-700"
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoTTS ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
        <label className="label">Speech Synthesis Speed Rate: <span className="font-bold text-brand-600">{speechRate}x</span></label>
        <input
          type="range"
          min="0.75"
          max="1.5"
          step="0.05"
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
          value={speechRate}
          onChange={(e) => saveRate(e.target.value)}
        />
        <button onClick={playTestAudio} type="button" className="btn-secondary">
          <Volume2 size={16} /> Test Speech Audio Rate 🔊
        </button>
      </div>
    </div>
  );
}

/* ===========================================================================
 * DEPARTMENT ADMINISTRATION CONTAINER (Gated by Admin Passcode)
 * =========================================================================== */

function AdminSettingsContainer({ status, onSaved, activeTab, setActiveTab }) {
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
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-brand-600 dark:text-brand-400" />
          <h3 className="font-bold text-slate-900 dark:text-slate-100">Department Administration (TPO Portal)</h3>
        </div>
        {unlocked && (
          <button
            className="btn-ghost text-xs text-slate-500 hover:text-slate-700"
            onClick={() => { setAdminPasscode(""); setUnlocked(false); }}
          >
            <Lock size={13} /> Lock Admin Panel
          </button>
        )}
      </div>

      {checking ? (
        <div className="p-8 text-center text-sm text-slate-400">Checking authorization...</div>
      ) : unlocked ? (
        <div>
          <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 overflow-x-auto">
            {ADMIN_TABS.map(({ id, label, icon: Icon }) => (
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
            <AdminSettingsForm status={status} onSaved={onSaved} activeTab={activeTab} />
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

function AdminSettingsForm({ status, onSaved, activeTab }) {
  const [appTitle, setAppTitle] = useState(status.app_title || "");
  const [collegeName, setCollegeName] = useState(status.college_name || "");
  const [departmentName, setDepartmentName] = useState(status.department_name || "");
  const [llmBackend, setLlmBackend] = useState(status.llm_backend || "auto");
  const [temperature, setTemperature] = useState(status.temperature || "0.7");
  const [maxTokens, setMaxTokens] = useState(status.max_tokens || "1024");
  const [persona, setPersona] = useState(status.interviewer_persona || "mentor");
  const [strictness, setStrictness] = useState(status.lockdown_strictness || "medium");
  const [tabLimit, setTabLimit] = useState(status.tab_switch_limit || "3");

  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");

  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState(null);

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
      flash(true, "Branding updated.");
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
      flash(true, "AI Model Tuning parameters saved.");
      onSaved();
    } catch (err) {
      flash(false, err instanceof ApiError ? err.message : "Couldn't save AI tuning.");
    } finally {
      setSaving("");
    }
  };

  const saveLockdown = async (e) => {
    e.preventDefault();
    setSaving("lockdown");
    try {
      await apiAdminPatch("/settings/lockdown", {
        strictness, tab_switch_limit: tabLimit
      });
      flash(true, "Assessment lockdown rules saved.");
      onSaved();
    } catch (err) {
      flash(false, err instanceof ApiError ? err.message : "Couldn't save lockdown rules.");
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
      setCurrentPasscode(""); setNewPasscode(""); setConfirmPasscode("");
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
        <div className={`p-4 rounded-xl text-sm font-semibold ${message.ok ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </div>
      )}

      {activeTab === "branding" && (
        <form onSubmit={saveBranding} className="space-y-4 max-w-2xl">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Department Branding</h4>
            <p className="text-xs text-slate-500">Configures platform header branding across all student accounts.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Application Title</label>
              <input className="input" value={appTitle} onChange={(e) => setAppTitle(e.target.value)} placeholder="AI Placement Assistance Platform" />
            </div>
            <div>
              <label className="label">University Name</label>
              <input className="input" value={collegeName} onChange={(e) => setCollegeName(e.target.value)} placeholder="CHRIST (Deemed to be University)" />
            </div>
          </div>
          <div>
            <label className="label">Department Name</label>
            <input className="input" value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="Department of Computer Science and Engineering" />
          </div>
          <button className="btn-primary" disabled={saving === "branding"}>
            {saving === "branding" ? <Spinner label="Saving..." /> : <><Save size={16} /> Save Branding</>}
          </button>
        </form>
      )}

      {activeTab === "engine" && (
        <div className="space-y-6 max-w-2xl">
          <div className="space-y-3">
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">AI Model Engine Backend</h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "auto", label: "Auto (Groq -> Ollama)" },
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
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Generation Parameters</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Creativity Temperature: <span className="font-bold text-brand-600">{temperature}</span></label>
                <input
                  type="range" min="0.1" max="1.0" step="0.05"
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                  value={temperature} onChange={(e) => setTemperature(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Max Token Output</label>
                <select className="input" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)}>
                  <option value="512">512 Tokens</option>
                  <option value="1024">1024 Tokens</option>
                  <option value="2048">2048 Tokens</option>
                  <option value="4096">4096 Tokens</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Interviewer AI Persona</label>
              <select className="input" value={persona} onChange={(e) => setPersona(e.target.value)}>
                <option value="mentor">Empathetic Senior Placement Mentor</option>
                <option value="lead">Senior Tech Lead (Deep Architecture)</option>
                <option value="recruiter">Strict FAANG Recruiter</option>
              </select>
            </div>

            <button className="btn-primary" disabled={saving === "tuning"}>
              {saving === "tuning" ? <Spinner label="Saving..." /> : <><Sliders size={16} /> Save Model Parameters</>}
            </button>
          </form>
        </div>
      )}

      {activeTab === "lockdown" && (
        <form onSubmit={saveLockdown} className="space-y-4 max-w-2xl">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Assessment Lockdown Configuration</h4>
            <p className="text-xs text-slate-500">Enforcement rules during proctored coding rounds.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Proctoring Enforcement Mode</label>
              <select className="input" value={strictness} onChange={(e) => setStrictness(e.target.value)}>
                <option value="lenient">Lenient (Warnings only)</option>
                <option value="medium">Standard (Auto-submit on 3 violations)</option>
                <option value="strict">Strict (Immediate lockdown)</option>
              </select>
            </div>
            <div>
              <label className="label">Max Allowed Tab Switches</label>
              <select className="input" value={tabLimit} onChange={(e) => setTabLimit(e.target.value)}>
                <option value="1">1 Tab Switch</option>
                <option value="2">2 Tab Switches</option>
                <option value="3">3 Tab Switches (Recommended)</option>
                <option value="5">5 Tab Switches</option>
              </select>
            </div>
          </div>
          <button className="btn-primary" disabled={saving === "lockdown"}>
            {saving === "lockdown" ? <Spinner label="Saving..." /> : <><ShieldAlert size={16} /> Save Lockdown Rules</>}
          </button>
        </form>
      )}

      {activeTab === "security" && (
        <form onSubmit={savePasscode} className="space-y-4 max-w-2xl">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">Admin Security Passcode</h4>
            <p className="text-xs text-slate-500">Protects TPO Placement Cell Dashboard and Department Settings.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input className="input" type="password" placeholder="Current passcode" value={currentPasscode} onChange={(e) => setCurrentPasscode(e.target.value)} />
            <input className="input" type="password" placeholder="New passcode" value={newPasscode} onChange={(e) => setNewPasscode(e.target.value)} />
            <input className="input" type="password" placeholder="Confirm passcode" value={confirmPasscode} onChange={(e) => setConfirmPasscode(e.target.value)} />
          </div>
          <button className="btn-secondary" disabled={saving === "passcode" || !currentPasscode || !newPasscode}>
            {saving === "passcode" ? <Spinner label="Saving..." /> : <><KeyRound size={16} /> Update Admin Passcode</>}
          </button>
        </form>
      )}
    </div>
  );
}
