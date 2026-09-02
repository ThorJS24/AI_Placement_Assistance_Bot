import { useEffect, useState } from "react";
import { GraduationCap, MessageSquare, FileText, Map, Mic, Code2, ArrowRight, BookOpen, X } from "lucide-react";
import { apiGet, apiPost } from "../api/client.js";

const STEPS = [
  { icon: MessageSquare, title: "AI Chatbot", desc: "Ask anything about placements — your history is saved so you can pick up where you left off." },
  { icon: FileText, title: "Resume Builder", desc: "Build an ATS-friendly resume, and revisit or edit saved drafts anytime." },
  { icon: Map, title: "Roadmap Generator", desc: "A personalized, week-by-week study plan for your target role." },
  { icon: Mic, title: "Mock Interview", desc: "A spoken interview simulation — review your past attempts and score trend." },
  { icon: Code2, title: "Technical Interview", desc: "DSA problems + a CS quiz, with a personal stats dashboard of your weak spots." },
];

export default function Onboarding({ onDone, isEdit = false }) {
  const [stream, setStream] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [semester, setSemester] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [subjectInput, setSubjectInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    apiGet("/profile")
      .then((p) => {
        setStream(p.stream || "");
        setSpecialization(p.specialization || "");
        setSemester(p.semester || "");
        setSubjects(p.subjects || []);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addSubject = () => {
    const clean = subjectInput.trim();
    if (clean && !subjects.includes(clean)) setSubjects((s) => [...s, clean]);
    setSubjectInput("");
  };

  const removeSubject = (s) => setSubjects((prev) => prev.filter((x) => x !== s));

  const finish = async () => {
    setSaving(true);
    try {
      await apiPost("/profile", { stream, specialization, semester, subjects });
    } catch {
      // profile save is a nice-to-have, not critical — don't block onboarding on it
    } finally {
      setSaving(false);
    }
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="onboarding-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white dark:bg-slate-800 p-6 shadow-2xl animate-slide-up sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-white">
            <GraduationCap size={22} />
          </div>
          <div>
            <h2 id="onboarding-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">{isEdit ? "Your profile" : "Welcome 👋"}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Free, runs locally, no accounts — your data stays on this PC.</p>
          </div>
        </div>

        {!isEdit && (
          <div className="mb-6 grid gap-2.5 sm:grid-cols-2">
            {STEPS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <Icon size={16} className="mt-0.5 shrink-0 text-brand-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <BookOpen size={14} className="text-brand-600" /> Your program (optional — used to personalize advice)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="onboarding-stream">Stream / branch</label>
              <input id="onboarding-stream" className="input" placeholder="e.g. Computer Science and Engineering" value={stream} onChange={(e) => setStream(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="onboarding-specialization">Specialization / honours</label>
              <input id="onboarding-specialization" className="input" placeholder="e.g. AI & ML (leave blank if none)" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
            </div>
          </div>
          <div className="mt-3">
            <label className="label" htmlFor="onboarding-semester">Current semester</label>
            <input
              id="onboarding-semester"
              className="input sm:w-40"
              type="number"
              min={1}
              max={12}
              placeholder="e.g. 6"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <label className="label" htmlFor="onboarding-subject-input">Subjects this semester</label>
            <div className="flex gap-2">
              <input
                id="onboarding-subject-input"
                className="input"
                placeholder="Type a subject and press Enter"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addSubject();
                  }
                }}
              />
              <button type="button" className="btn-secondary shrink-0" onClick={addSubject}>Add</button>
            </div>
            {subjects.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {subjects.map((s) => (
                  <span key={s} className="badge inline-flex items-center gap-1 bg-brand-50 text-brand-700">
                    {s}
                    <button type="button" onClick={() => removeSubject(s)} className="text-brand-400 hover:text-brand-700" aria-label={`Remove subject ${s}`}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <button className="btn-primary mt-5 w-full justify-center" onClick={finish} disabled={saving}>
          {isEdit ? "Save" : "Get started"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
