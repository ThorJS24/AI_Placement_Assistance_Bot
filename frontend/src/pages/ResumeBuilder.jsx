import { useEffect, useId, useState } from "react";
import { FileText, Plus, Trash2, Download, Sparkles, Search, Upload, FolderOpen, RefreshCw } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Spinner from "../components/Spinner.jsx";
import { apiDelete, apiGet, apiPost, apiPostForm, ApiError } from "../api/client.js";

const emptyExperience = () => ({ role: "", company: "", duration: "", bulletsText: "" });
const emptyProject = () => ({ title: "", tech: "", bulletsText: "" });
const emptyEducation = () => ({ degree: "", institution: "", duration: "", score: "" });

export default function ResumeBuilder() {
  const [tab, setTab] = useState("build");
  return (
    <div>
      <PageHeader
        icon={FileText}
        title="Resume Builder & Analyzer"
        subtitle="Build a new ATS-friendly resume, or get AI feedback on an existing one."
      />
      <div className="mb-5 inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        {[
          { id: "build", label: "Build a new resume" },
          { id: "analyze", label: "Analyze my resume" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id ? "bg-white dark:bg-slate-800 text-brand-700 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "build" ? <BuildTab /> : <AnalyzeTab />}
    </div>
  );
}

function Field({ label, ...props }) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} className="input" {...props} />
    </div>
  );
}

const emptyForm = () => ({
  full_name: "", email: "", phone: "", location: "", linkedin: "", github: "",
  target_role: "", years_context: "", skillsText: "", certificationsText: "", use_ai: true,
});

function BuildTab() {
  const [form, setForm] = useState(emptyForm);
  const [experience, setExperience] = useState([]);
  const [projects, setProjects] = useState([]);
  const [education, setEducation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [loadedFrom, setLoadedFrom] = useState(null); // saved resume this draft was loaded from, if any

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const loadDraft = (resumeRow, payload) => {
    setForm({
      full_name: payload.full_name || "",
      email: payload.email || "",
      phone: payload.phone || "",
      location: payload.location || "",
      linkedin: payload.linkedin || "",
      github: payload.github || "",
      target_role: payload.target_role || resumeRow.target_role || "",
      years_context: payload.years_context || "",
      skillsText: (payload.skills || []).join(", "),
      certificationsText: (payload.certifications || []).join("\n"),
      use_ai: payload.use_ai ?? true,
    });
    setExperience((payload.experience || []).map((e) => ({
      role: e.role || "", company: e.company || "", duration: e.duration || "",
      bulletsText: (e.bullets || []).join("\n"),
    })));
    setProjects((payload.projects || []).map((p) => ({
      title: p.title || "", tech: p.tech || "",
      bulletsText: (p.bullets || []).join("\n"),
    })));
    setEducation((payload.education || []).map((ed) => ({
      degree: ed.degree || "", institution: ed.institution || "",
      duration: ed.duration || "", score: ed.score || "",
    })));
    setResult(null);
    setError("");
    setLoadedFrom(resumeRow.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateList = (list, setList, idx, key, value) => {
    const copy = [...list];
    copy[idx] = { ...copy[idx], [key]: value };
    setList(copy);
  };

  const [savedListVersion, setSavedListVersion] = useState(0);

  // Warn before an accidental tab close / reload while there's meaningful
  // unsaved form content — this form can get long (multiple experience/
  // project entries), and closing the tab used to lose it silently.
  const isDirty = !result && (
    form.full_name.trim() || form.target_role.trim() || form.skillsText.trim() ||
    experience.length > 0 || projects.length > 0 || education.length > 0
  );
  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const submit = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const body = {
        full_name: form.full_name, email: form.email, phone: form.phone, location: form.location,
        linkedin: form.linkedin, github: form.github, target_role: form.target_role,
        years_context: form.years_context, use_ai: form.use_ai,
        skills: form.skillsText.split(",").map((s) => s.trim()).filter(Boolean),
        certifications: form.certificationsText.split("\n").map((s) => s.trim()).filter(Boolean),
        experience: experience.map((e) => ({
          role: e.role, company: e.company, duration: e.duration,
          bullets: e.bulletsText.split("\n").map((s) => s.trim()).filter(Boolean),
        })),
        projects: projects.map((p) => ({
          title: p.title, tech: p.tech,
          bullets: p.bulletsText.split("\n").map((s) => s.trim()).filter(Boolean),
        })),
        education,
      };
      const data = await apiPost("/resume/build", body);
      setResult(data);
      setLoadedFrom(data.resume_id ?? null);
      setSavedListVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong generating the resume.");
    } finally {
      setLoading(false);
    }
  };

  const startNew = () => {
    setForm(emptyForm());
    setExperience([]);
    setProjects([]);
    setEducation([]);
    setResult(null);
    setError("");
    setLoadedFrom(null);
  };

  return (
    <div className="space-y-6">
      <SavedResumes refreshKey={savedListVersion} onLoad={loadDraft} onDeleted={() => setSavedListVersion((v) => v + 1)} />

      {loadedFrom && (
        <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <span>✏️ Editing a saved draft — generating again will save it as a new version.</span>
          <button className="btn-ghost text-brand-700" onClick={startNew}>Start a blank resume instead</button>
        </div>
      )}

      <div className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">Basic details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" value={form.full_name} onChange={set("full_name")} />
          <Field label="Target role" value={form.target_role} onChange={set("target_role")} placeholder="Backend Software Engineer" />
          <Field label="Email" value={form.email} onChange={set("email")} />
          <Field label="Phone" value={form.phone} onChange={set("phone")} />
          <Field label="Location" value={form.location} onChange={set("location")} placeholder="City, Country" />
          <Field label="LinkedIn URL (optional)" value={form.linkedin} onChange={set("linkedin")} />
          <Field label="GitHub URL (optional)" value={form.github} onChange={set("github")} />
          <Field label="Context" value={form.years_context} onChange={set("years_context")} placeholder="final-year CS student" />
        </div>
        <div className="mt-4">
          <label className="label" htmlFor="resume-skills">Skills (comma-separated)</label>
          <textarea id="resume-skills" className="input" rows={2} value={form.skillsText} onChange={set("skillsText")} placeholder="Python, Java, SQL, React, Git, DSA" />
        </div>
      </div>

      <ListSection
        title="Experience / Internships"
        items={experience}
        setItems={setExperience}
        makeEmpty={emptyExperience}
        renderItem={(item, idx) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Role/title" value={item.role} onChange={(e) => updateList(experience, setExperience, idx, "role", e.target.value)} />
              <Field label="Company" value={item.company} onChange={(e) => updateList(experience, setExperience, idx, "company", e.target.value)} />
            </div>
            <Field label="Duration" value={item.duration} onChange={(e) => updateList(experience, setExperience, idx, "duration", e.target.value)} placeholder="Jun 2025 - Aug 2025" />
            <div>
              <label className="label" htmlFor={`experience-bullets-${idx}`}>What did you do? (one point per line)</label>
              <textarea id={`experience-bullets-${idx}`} className="input" rows={3} value={item.bulletsText} onChange={(e) => updateList(experience, setExperience, idx, "bulletsText", e.target.value)} />
            </div>
          </>
        )}
      />

      <ListSection
        title="Projects"
        items={projects}
        setItems={setProjects}
        makeEmpty={emptyProject}
        renderItem={(item, idx) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Project title" value={item.title} onChange={(e) => updateList(projects, setProjects, idx, "title", e.target.value)} />
              <Field label="Tech stack" value={item.tech} onChange={(e) => updateList(projects, setProjects, idx, "tech", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor={`project-bullets-${idx}`}>What did it do / your contribution? (one point per line)</label>
              <textarea id={`project-bullets-${idx}`} className="input" rows={3} value={item.bulletsText} onChange={(e) => updateList(projects, setProjects, idx, "bulletsText", e.target.value)} />
            </div>
          </>
        )}
      />

      <ListSection
        title="Education"
        items={education}
        setItems={setEducation}
        makeEmpty={emptyEducation}
        renderItem={(item, idx) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Degree/program" value={item.degree} onChange={(e) => updateList(education, setEducation, idx, "degree", e.target.value)} />
            <Field label="Institution" value={item.institution} onChange={(e) => updateList(education, setEducation, idx, "institution", e.target.value)} />
            <Field label="Duration" value={item.duration} onChange={(e) => updateList(education, setEducation, idx, "duration", e.target.value)} />
            <Field label="CGPA / percentage (optional)" value={item.score} onChange={(e) => updateList(education, setEducation, idx, "score", e.target.value)} />
          </div>
        )}
      />

      <div className="card p-5">
        <label className="label" htmlFor="resume-certifications">Certifications (one per line, optional)</label>
        <textarea id="resume-certifications" className="input" rows={2} value={form.certificationsText} onChange={set("certificationsText")} />
        <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={form.use_ai} onChange={(e) => setForm((f) => ({ ...f, use_ai: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600" />
          <Sparkles size={15} className="text-brand-600" /> Enhance my summary & bullet points with AI before generating
        </label>
      </div>

      {error && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</div>}

      <button className="btn-primary" onClick={submit} disabled={loading || !form.full_name}>
        {loading ? <Spinner label="Generating..." /> : <>🚀 Generate resume</>}
      </button>

      {result && (
        <div className="card animate-slide-up p-5">
          <p className="mb-3 font-semibold text-emerald-700 dark:text-emerald-400">✅ Resume generated!</p>
          {result.ai_warning && <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">⚠️ {result.ai_warning}</p>}
          {result.summary && (
            <div className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
              <strong>AI-written summary:</strong> {result.summary}
            </div>
          )}
          <div className="flex gap-3">
            <a href={result.download_docx} className="btn-secondary" download>
              <Download size={16} /> Download .docx
            </a>
            <a href={result.download_pdf} className="btn-secondary" download>
              <Download size={16} /> Download .pdf
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function SavedResumes({ refreshKey, onLoad, onDeleted }) {
  const [resumes, setResumes] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);

  const refresh = () => apiGet("/resume/list").then(setResumes).catch(() => {});

  useEffect(() => {
    refresh();
  }, [refreshKey]);

  const handleLoad = async (row) => {
    setLoadingId(row.id);
    setError("");
    try {
      const full = await apiGet(`/resume/${row.id}`);
      onLoad(row, full.payload || {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load that draft.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.full_name || "Untitled"} — ${row.target_role || "no target role set"}"? This can't be undone.`)) {
      return;
    }
    try {
      await apiDelete(`/resume/${row.id}`);
      setResumes((prev) => prev.filter((r) => r.id !== row.id));
      onDeleted?.();
    } catch {
      /* non-fatal */
    }
  };

  if (resumes.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex w-full items-center justify-between gap-2">
        <button className="flex min-w-0 flex-1 items-center justify-between text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
            <FolderOpen size={16} className="text-brand-600" /> My saved resumes ({resumes.length})
          </h3>
        </button>
        <button
          type="button"
          className="shrink-0 rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400"
          onClick={refresh}
          aria-label="Refresh saved resumes"
          title="Refresh saved resumes"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {resumes.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{r.full_name || "Untitled"} — {r.target_role || "no target role set"}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(r.created_at * 1000).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button className="btn-ghost" onClick={() => handleLoad(r)} disabled={loadingId === r.id}>
                  {loadingId === r.id ? <Spinner label="Loading..." /> : "Load & edit"}
                </button>
                <button className="btn-ghost text-red-500" onClick={() => handleDelete(r)} aria-label={`Delete resume ${r.full_name || "Untitled"}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ListSection({ title, items, setItems, makeEmpty, renderItem }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <button className="btn-ghost" onClick={() => setItems([...items, makeEmpty()])} aria-label={`Add ${title} entry`}>
          <Plus size={15} /> Add entry
        </button>
      </div>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex justify-end">
              <button
                className="btn-ghost text-red-500"
                onClick={() => { if (window.confirm("Remove this entry?")) setItems(items.filter((_, i) => i !== idx)); }}
                aria-label={`Remove ${title} entry ${idx + 1}`}
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
            {renderItem(item, idx)}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No entries yet — click "Add entry" to add one.</p>}
      </div>
    </div>
  );
}

function AnalyzeTab() {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);

  const submit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setAnalysis(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("job_description", jobDescription);
      const data = await apiPostForm("/resume/analyze", formData);
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong analyzing this resume.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <label className="label" htmlFor="resume-file-input">Resume file (PDF, DOCX, or TXT)</label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 px-4 py-8 text-sm text-slate-500 dark:text-slate-400 transition-colors hover:border-brand-400 hover:bg-brand-50/50">
          <Upload size={18} />
          {file ? file.name : "Click to choose a file"}
          <input id="resume-file-input" type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <label className="label mt-4" htmlFor="resume-job-description">Target job description (optional, improves accuracy)</label>
        <textarea id="resume-job-description" className="input" rows={5} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
        <button className="btn-primary mt-4" onClick={submit} disabled={!file || loading}>
          {loading ? <Spinner label="Analyzing..." /> : <><Search size={16} /> Analyze resume</>}
        </button>
        {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</div>}
      </div>

      {analysis && (
        <div className="card animate-slide-up space-y-5 p-5">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-300">
              <span>ATS Compatibility Score</span>
              <span>{analysis.ats_score}/100</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700" style={{ width: `${Math.min(100, Math.max(0, analysis.ats_score))}%` }} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">✅ Strengths</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
                {(analysis.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">⚠️ Weaknesses</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
                {(analysis.weaknesses || []).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </div>

          {analysis.missing_keywords?.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">🔑 Missing keywords vs. the job description</p>
              <div className="flex flex-wrap gap-2">
                {analysis.missing_keywords.map((k, i) => (
                  <span key={i} className="badge bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">{k}</span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">📋 Section-by-section feedback</p>
            <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
              {Object.entries(analysis.section_feedback || {}).map(([k, v]) => (
                <li key={k}><strong className="text-slate-800 dark:text-slate-200">{k.replaceAll("_", " ")}:</strong> {v}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">🎯 Top action items</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
              {(analysis.top_action_items || []).map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
