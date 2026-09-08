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

const sampleData = () => ({
  form: {
    full_name: "Alex Mercer",
    email: "alex.mercer@example.com",
    phone: "+91 98765 43210",
    location: "Bangalore, India",
    linkedin: "linkedin.com/in/alex-mercer",
    github: "github.com/alex-mercer",
    target_role: "Full Stack Engineer",
    years_context: "Final year B.Tech CSE student with internship experience in React and FastAPI",
    skillsText: "Python, JavaScript, React, Node.js, FastAPI, PostgreSQL, Docker, Git, REST APIs, Tailwind CSS",
    certificationsText: "AWS Certified Developer Associate\nMeta Front-End Developer Certificate",
    use_ai: true,
  },
  experience: [
    {
      role: "Software Engineering Intern",
      company: "TechFlow Systems",
      duration: "Jun 2025 - Aug 2025",
      bulletsText: "Developed responsive React web applications serving 10,000+ daily active users\nOptimized FastAPI backend endpoints reducing average response latency by 35%\nImplemented JWT authentication and role-based access control across 12 microservices",
    },
  ],
  projects: [
    {
      title: "AI Placement Assistance Platform",
      tech: "React, FastAPI, SQLite, Ollama, Whisper",
      bulletsText: "Built an end-to-end placement preparation portal with AI chatbot, resume builder, and mock interviews\nIntegrated local LLM fallback mechanisms ensuring 100% offline functionality",
    },
    {
      title: "Real-Time Collaborative Code Editor",
      tech: "WebSockets, Node.js, Monaco Editor",
      bulletsText: "Architected a multi-user code editing tool supporting Operational Transformation (OT) for simultaneous editing",
    },
  ],
  education: [
    {
      degree: "B.Tech in Computer Science and Engineering",
      institution: "CHRIST (Deemed to be University)",
      duration: "2022 - 2026",
      score: "8.9 / 10.0 CGPA",
    },
  ],
});

function BuildTab() {
  const [form, setForm] = useState(emptyForm);
  const [experience, setExperience] = useState([]);
  const [projects, setProjects] = useState([]);
  const [education, setEducation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [loadedFrom, setLoadedFrom] = useState(null);
  const [accentColor, setAccentColor] = useState("#1F4E79");
  const [fontFamily, setFontFamily] = useState("Calibri, sans-serif");
  const [savedListVersion, setSavedListVersion] = useState(0);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const fillSample = () => {
    const s = sampleData();
    setForm(s.form);
    setExperience(s.experience);
    setProjects(s.projects);
    setEducation(s.education);
    setError("");
  };

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
    if (!form.full_name.trim()) {
      setError("Please enter your Full Name before generating.");
      return;
    }
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

  const skillsList = form.skillsText.split(",").map((s) => s.trim()).filter(Boolean);
  const certsList = form.certificationsText.split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-6">
      <SavedResumes refreshKey={savedListVersion} onLoad={loadDraft} onDeleted={() => setSavedListVersion((v) => v + 1)} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-soft">
        <div className="flex items-center gap-3">
          {loadedFrom ? (
            <span className="text-sm font-semibold text-brand-700 dark:text-brand-400">✏️ Editing saved draft</span>
          ) : (
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Drafting ATS Resume</span>
          )}
          <button className="btn-secondary text-xs" onClick={fillSample}>✨ Fill Sample Data</button>
          {loadedFrom && <button className="btn-ghost text-xs text-brand-700" onClick={startNew}>Start Blank</button>}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-400">
            Font:
            <select className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
              <option value="Calibri, sans-serif">Calibri</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
              <option value="Georgia, serif">Georgia</option>
            </select>
          </label>

          <div className="flex items-center gap-1">
            <span className="font-medium text-slate-600 dark:text-slate-400">Theme:</span>
            {["#1F4E79", "#334155", "#047857", "#4338CA", "#991B1B"].map((c) => (
              <button
                key={c}
                type="button"
                className={`h-5 w-5 rounded-full border border-white shadow-xs transition-transform ${accentColor === c ? "scale-125 ring-2 ring-brand-500" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => setAccentColor(c)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column: Form controls */}
        <div className="space-y-6 lg:col-span-6">
          <div className="card p-5">
            <h3 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">Basic details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name *" value={form.full_name} onChange={set("full_name")} placeholder="e.g. Alex Mercer" />
              <Field label="Target role" value={form.target_role} onChange={set("target_role")} placeholder="Backend Software Engineer" />
              <Field label="Email" value={form.email} onChange={set("email")} placeholder="alex@example.com" />
              <Field label="Phone" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
              <Field label="Location" value={form.location} onChange={set("location")} placeholder="Bangalore, India" />
              <Field label="LinkedIn URL" value={form.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/alex" />
              <Field label="GitHub URL" value={form.github} onChange={set("github")} placeholder="github.com/alex" />
              <Field label="Context" value={form.years_context} onChange={set("years_context")} placeholder="final-year CS student" />
            </div>
            <div className="mt-4">
              <label className="label" htmlFor="resume-skills">Skills (comma-separated)</label>
              <textarea id="resume-skills" className="input" rows={2} value={form.skillsText} onChange={set("skillsText")} placeholder="Python, Java, SQL, React, Git, DSA" />
            </div>
          </div>

          <ListSection
            title="Work Experience / Internships"
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
                  <label className="label" htmlFor={`experience-bullets-${idx}`}>Key achievements (one bullet per line)</label>
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
                  <label className="label" htmlFor={`project-bullets-${idx}`}>Key features / contribution (one bullet per line)</label>
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
                <Field label="CGPA / Percentage" value={item.score} onChange={(e) => updateList(education, setEducation, idx, "score", e.target.value)} />
              </div>
            )}
          />

          <div className="card p-5">
            <label className="label" htmlFor="resume-certifications">Certifications (one per line)</label>
            <textarea id="resume-certifications" className="input" rows={2} value={form.certificationsText} onChange={set("certificationsText")} />
            <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={form.use_ai} onChange={(e) => setForm((f) => ({ ...f, use_ai: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600" />
              <Sparkles size={15} className="text-brand-600" /> Enhance summary & bullet points with AI when generating
            </label>
          </div>

          {error && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</div>}

          <div className="flex gap-3">
            <button className="btn-primary flex-1 !py-3 text-base" onClick={submit} disabled={loading}>
              {loading ? <Spinner label="Generating ATS Resume..." /> : <>🚀 Generate &amp; Save Resume</>}
            </button>
            <button className="btn-secondary" onClick={() => window.print()} title="Print Canvas">
              🖨️ Print
            </button>
          </div>

          {result && (
            <div className="card animate-slide-up space-y-3 p-5 border border-emerald-200 dark:border-emerald-800">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">✅ Resume generated &amp; saved!</p>
              {result.ai_warning && <p className="text-sm text-amber-600 dark:text-amber-400">⚠️ {result.ai_warning}</p>}
              <div className="flex flex-wrap gap-3">
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

        {/* Right column: Interactive Live A4 Resume Canvas Preview */}
        <div className="lg:col-span-6">
          <div className="sticky top-6 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 px-1">
              <span>LIVE ATS CANVAS PREVIEW</span>
              <span>Real-time Rendering</span>
            </div>

            <div
              id="resume-canvas"
              className="rounded-xl bg-white p-8 text-slate-900 shadow-xl border border-slate-200 transition-all duration-300 min-h-[750px]"
              style={{ fontFamily, color: "#1F2937" }}
            >
              {/* Header */}
              <div className="text-center pb-4 border-b border-slate-200">
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: accentColor }}>
                  {form.full_name.trim() || "YOUR FULL NAME"}
                </h1>
                <p className="mt-0.5 text-xs font-medium text-slate-600">
                  {[form.email, form.phone, form.location, form.linkedin, form.github].filter(Boolean).join("  |  ") || "email@example.com | +91 98765 43210 | Location"}
                </p>
              </div>

              {/* Summary */}
              {form.target_role.trim() && (
                <div className="mt-4">
                  <h2 className="text-xs font-bold tracking-wider uppercase border-b pb-1 mb-1.5" style={{ color: accentColor, borderColor: accentColor }}>
                    PROFESSIONAL SUMMARY
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-700">
                    {result?.summary || `Motivated ${form.target_role} targeting entry-level tech opportunities. Skilled in ${form.skillsText || "software development"}. ${form.years_context}`}
                  </p>
                </div>
              )}

              {/* Skills */}
              {skillsList.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-xs font-bold tracking-wider uppercase border-b pb-1 mb-1.5" style={{ color: accentColor, borderColor: accentColor }}>
                    TECHNICAL SKILLS
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-800 font-medium">
                    {skillsList.join("  •  ")}
                  </p>
                </div>
              )}

              {/* Work Experience */}
              {experience.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-xs font-bold tracking-wider uppercase border-b pb-1 mb-2" style={{ color: accentColor, borderColor: accentColor }}>
                    WORK EXPERIENCE
                  </h2>
                  <div className="space-y-3">
                    {experience.map((exp, i) => (
                      <div key={i} className="text-xs">
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>{exp.role || "Role"} {exp.company ? `- ${exp.company}` : ""}</span>
                          <span className="font-normal text-slate-500">{exp.duration}</span>
                        </div>
                        {exp.bulletsText.split("\n").filter(Boolean).map((bullet, bi) => (
                          <p key={bi} className="mt-1 pl-3 relative text-slate-700 before:content-['•'] before:absolute before:left-0 before:text-slate-400">
                            {bullet}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {projects.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-xs font-bold tracking-wider uppercase border-b pb-1 mb-2" style={{ color: accentColor, borderColor: accentColor }}>
                    PROJECTS
                  </h2>
                  <div className="space-y-3">
                    {projects.map((proj, i) => (
                      <div key={i} className="text-xs">
                        <div className="font-bold text-slate-800">
                          {proj.title || "Project Title"} {proj.tech && <span className="font-normal text-slate-500">[{proj.tech}]</span>}
                        </div>
                        {proj.bulletsText.split("\n").filter(Boolean).map((bullet, bi) => (
                          <p key={bi} className="mt-1 pl-3 relative text-slate-700 before:content-['•'] before:absolute before:left-0 before:text-slate-400">
                            {bullet}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {education.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-xs font-bold tracking-wider uppercase border-b pb-1 mb-2" style={{ color: accentColor, borderColor: accentColor }}>
                    EDUCATION
                  </h2>
                  <div className="space-y-2">
                    {education.map((edu, i) => (
                      <div key={i} className="text-xs flex justify-between">
                        <div>
                          <p className="font-bold text-slate-800">{edu.degree || "Degree"} - {edu.institution || "Institution"}</p>
                          {edu.score && <p className="text-slate-600">Score: {edu.score}</p>}
                        </div>
                        <span className="text-slate-500">{edu.duration}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {certsList.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-xs font-bold tracking-wider uppercase border-b pb-1 mb-1.5" style={{ color: accentColor, borderColor: accentColor }}>
                    CERTIFICATIONS
                  </h2>
                  <div className="space-y-1 text-xs text-slate-700">
                    {certsList.map((c, i) => (
                      <p key={i} className="pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-slate-400">
                        {c}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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
    if (!window.confirm(`Delete "${row.full_name || "Untitled"} - ${row.target_role || "no target role set"}"? This can't be undone.`)) {
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
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{r.full_name || "Untitled"} - {r.target_role || "no target role set"}</p>
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
        {items.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No entries yet - click "Add entry" to add one.</p>}
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
              <span>Overall ATS Compatibility Score</span>
              <span className="text-lg font-bold text-brand-600 dark:text-brand-400">{analysis.ats_score}/100</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, analysis.ats_score))}%` }} />
            </div>
          </div>

          {(analysis.formatting_score !== undefined || analysis.keyword_score !== undefined || analysis.impact_score !== undefined || analysis.structure_score !== undefined) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4">
              {[
                { label: "Formatting", score: analysis.formatting_score ?? analysis.ats_score },
                { label: "Keywords", score: analysis.keyword_score ?? analysis.ats_score },
                { label: "Impact", score: analysis.impact_score ?? analysis.ats_score },
                { label: "Structure", score: analysis.structure_score ?? analysis.ats_score },
              ].map((sub, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span>{sub.label}</span>
                    <span>{sub.score}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${Math.min(100, Math.max(0, sub.score))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {analysis.ats_checklist?.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">📌 ATS Compliance Checklist</p>
              <div className="space-y-2">
                {analysis.ats_checklist.map((chk, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-xs">
                    <span className={`mt-0.5 font-bold ${chk.passed ? "text-emerald-600" : "text-amber-600"}`}>{chk.passed ? "✓" : "✗"}</span>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{chk.label}</p>
                      <p className="text-slate-500 dark:text-slate-400">{chk.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
