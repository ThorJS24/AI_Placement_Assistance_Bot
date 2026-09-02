import { useEffect, useId, useState } from "react";
import { Plus, Pencil, Trash2, X, Code2, BookOpen } from "lucide-react";
import Spinner from "./Spinner.jsx";
import { apiAdminGet, apiAdminPost, apiAdminPatch, apiAdminDelete, ApiError } from "../api/client.js";

const DIFFICULTIES = ["Easy", "Medium", "Hard"];

function TextListEditor({ label, items, onChange, placeholder }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v) onChange([...items, v]);
    setInput("");
  };
  const inputId = useId();
  return (
    <div>
      <label className="label" htmlFor={inputId}>{label}</label>
      <div className="flex gap-2">
        <input
          id={inputId}
          className="input"
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={add}>Add</button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span key={i} className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {it}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100"
                aria-label={`Remove ${it}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY_DSA = {
  id: "", topic: "", difficulty: "Easy", companies: [], title: "", description: "",
  input_format: "", output_format: "", starter_code: "", hints: [],
  test_cases: [{ input: "", expected: "" }],
};

function DsaForm({ initial, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(initial ? { ...EMPTY_DSA, ...initial } : EMPTY_DSA);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const updateTestCase = (i, patch) => set({ test_cases: form.test_cases.map((tc, j) => (j === i ? { ...tc, ...patch } : tc)) });
  const addTestCase = () => set({ test_cases: [...form.test_cases, { input: "", expected: "" }] });
  const removeTestCase = (i) => set({ test_cases: form.test_cases.filter((_, j) => j !== i) });

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="dsa-form-id">ID (unique, e.g. "arr-005")</label>
          <input id="dsa-form-id" className="input" value={form.id} onChange={(e) => set({ id: e.target.value.trim() })} disabled={!!initial} />
        </div>
        <div>
          <label className="label" htmlFor="dsa-form-topic">Topic</label>
          <input id="dsa-form-topic" className="input" value={form.topic} onChange={(e) => set({ topic: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="dsa-form-difficulty">Difficulty</label>
          <select id="dsa-form-difficulty" className="input" value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
            {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dsa-form-title">Title</label>
          <input id="dsa-form-title" className="input" value={form.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
      </div>

      <TextListEditor label="Companies (optional)" items={form.companies} onChange={(v) => set({ companies: v })} placeholder="e.g. Amazon" />

      <div>
        <label className="label" htmlFor="dsa-form-description">Description</label>
        <textarea id="dsa-form-description" className="input min-h-[90px]" value={form.description} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="dsa-form-input-format">Input format</label>
          <textarea id="dsa-form-input-format" className="input min-h-[70px]" value={form.input_format} onChange={(e) => set({ input_format: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="dsa-form-output-format">Output format</label>
          <textarea id="dsa-form-output-format" className="input min-h-[70px]" value={form.output_format} onChange={(e) => set({ output_format: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="dsa-form-starter-code">Starter code</label>
        <textarea id="dsa-form-starter-code" className="input min-h-[90px] font-mono text-xs" value={form.starter_code} onChange={(e) => set({ starter_code: e.target.value })} />
      </div>

      <TextListEditor label="Hints (optional)" items={form.hints} onChange={(v) => set({ hints: v })} placeholder="Add a hint" />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label mb-0">Test cases (stdin the student's code reads, and the exact stdout expected)</label>
          <button type="button" className="btn-secondary" onClick={addTestCase}>+ Add test case</button>
        </div>
        <div className="space-y-2">
          {form.test_cases.map((tc, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-[1fr_1fr_auto]">
              <textarea
                aria-label={`Test case ${i + 1} stdin`}
                className="input min-h-[60px] font-mono text-xs"
                placeholder="stdin"
                value={tc.input}
                onChange={(e) => updateTestCase(i, { input: e.target.value })}
              />
              <textarea
                aria-label={`Test case ${i + 1} expected stdout`}
                className="input min-h-[60px] font-mono text-xs"
                placeholder="expected stdout"
                value={tc.expected}
                onChange={(e) => updateTestCase(i, { expected: e.target.value })}
              />
              <button
                type="button"
                className="btn-ghost self-start"
                onClick={() => removeTestCase(i)}
                disabled={form.test_cases.length <= 1}
                aria-label="Remove test case"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
          Tip: this isn't auto-verified here - run the exact test inputs through a correct reference solution before saving, the
          same way the DSA bank added in this app was verified.
        </p>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn-primary" onClick={() => onSave(form)} disabled={saving}>
          {saving ? <Spinner label="Saving..." /> : "Save question"}
        </button>
      </div>
    </div>
  );
}

const EMPTY_QUIZ = { id: "", topic: "", type: "mcq", difficulty: "Easy", question: "", options: ["", ""], answer: "", explanation: "" };

function QuizForm({ initial, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(initial ? { ...EMPTY_QUIZ, ...initial, options: initial.options || ["", ""] } : EMPTY_QUIZ);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const updateOption = (i, val) => {
    const prevVal = form.options[i];
    set({
      options: form.options.map((o, j) => (j === i ? val : o)),
      answer: form.answer === prevVal ? val : form.answer,
    });
  };
  const addOption = () => set({ options: [...form.options, ""] });
  const removeOption = (i) => set({ options: form.options.filter((_, j) => j !== i) });

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="quiz-form-id">ID (unique, e.g. "oop-008")</label>
          <input id="quiz-form-id" className="input" value={form.id} onChange={(e) => set({ id: e.target.value.trim() })} disabled={!!initial} />
        </div>
        <div>
          <label className="label" htmlFor="quiz-form-topic">Topic</label>
          <input id="quiz-form-topic" className="input" value={form.topic} onChange={(e) => set({ topic: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="quiz-form-type">Type</label>
          <select
            id="quiz-form-type"
            className="input"
            value={form.type}
            onChange={(e) => set({ type: e.target.value, options: form.options.length ? form.options : ["", ""] })}
          >
            <option value="mcq">Multiple choice</option>
            <option value="short_answer">Short answer</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="quiz-form-difficulty">Difficulty</label>
          <select id="quiz-form-difficulty" className="input" value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
            {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="quiz-form-question">Question</label>
        <textarea id="quiz-form-question" className="input min-h-[70px]" value={form.question} onChange={(e) => set({ question: e.target.value })} />
      </div>

      {form.type === "mcq" ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="label mb-0">Options (select the correct one)</label>
            <button type="button" className="btn-secondary" onClick={addOption}>+ Add option</button>
          </div>
          <div className="space-y-2">
            {form.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct-option"
                  checked={!!opt && form.answer === opt}
                  onChange={() => set({ answer: opt })}
                  aria-label={`Mark option ${i + 1} as correct`}
                />
                <input aria-label={`Option ${i + 1} text`} className="input" value={opt} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => removeOption(i)}
                  disabled={form.options.length <= 2}
                  aria-label="Remove option"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="quiz-form-answer">Model answer</label>
          <textarea id="quiz-form-answer" className="input min-h-[70px]" value={form.answer} onChange={(e) => set({ answer: e.target.value })} />
        </div>
      )}

      <div>
        <label className="label" htmlFor="quiz-form-explanation">Explanation (optional)</label>
        <textarea id="quiz-form-explanation" className="input min-h-[60px]" value={form.explanation} onChange={(e) => set({ explanation: e.target.value })} />
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn-primary" onClick={() => onSave(form)} disabled={saving}>
          {saving ? <Spinner label="Saving..." /> : "Save question"}
        </button>
      </div>
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-modal-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl animate-slide-up dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id="question-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <button
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function QuestionBankEditor() {
  const [bank, setBank] = useState("dsa"); // "dsa" | "quiz"
  const [dsaQuestions, setDsaQuestions] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState(null);
  const [editing, setEditing] = useState(null); // { mode: "new" | "edit", question? }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const load = () => {
    setError("");
    apiAdminGet("/admin/questions/dsa").then(setDsaQuestions).catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load questions."));
    apiAdminGet("/admin/questions/quiz").then(setQuizQuestions).catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load questions."));
  };
  useEffect(load, []);

  const openNew = () => {
    setFormError("");
    setEditing({ mode: "new" });
  };
  const openEdit = (q) => {
    setFormError("");
    setEditing({ mode: "edit", question: q });
  };

  const bankPath = bank === "dsa" ? "/admin/questions/dsa" : "/admin/questions/quiz";

  const save = async (form) => {
    setSaving(true);
    setFormError("");
    try {
      if (editing.mode === "new") {
        await apiAdminPost(bankPath, form);
      } else {
        await apiAdminPatch(`${bankPath}/${editing.question.id}`, form);
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't save this question - check the required fields.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (q) => {
    const label = bank === "dsa" ? q.title : q.question;
    if (!window.confirm(`Delete "${label}"? This can't be undone.`)) return;
    setDeletingId(q.id);
    setError("");
    try {
      await apiAdminDelete(`${bankPath}/${q.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete this question.");
    } finally {
      setDeletingId("");
    }
  };

  const list = bank === "dsa" ? dsaQuestions : quizQuestions;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            className={`btn-secondary ${bank === "dsa" ? "border-brand-500 text-brand-700 dark:text-brand-300" : ""}`}
            onClick={() => setBank("dsa")}
          >
            <Code2 size={15} /> DSA questions {dsaQuestions ? `(${dsaQuestions.length})` : ""}
          </button>
          <button
            className={`btn-secondary ${bank === "quiz" ? "border-brand-500 text-brand-700 dark:text-brand-300" : ""}`}
            onClick={() => setBank("quiz")}
          >
            <BookOpen size={15} /> Quiz questions {quizQuestions ? `(${quizQuestions.length})` : ""}
          </button>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> Add question
        </button>
      </div>

      {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{error}</div>}

      {!list ? (
        <div className="card p-8 text-center"><Spinner label="Loading questions..." /></div>
      ) : list.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400 dark:text-slate-500">No questions yet - add the first one.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-700 dark:text-slate-500">
                <th className="py-2 pl-4 pr-3">ID</th>
                <th className="py-2 pr-3">Topic</th>
                <th className="py-2 pr-3">Difficulty</th>
                <th className="py-2 pr-3">{bank === "dsa" ? "Title" : "Question"}</th>
                <th className="py-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((q) => (
                <tr key={q.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="py-2 pl-4 pr-3 font-mono text-xs text-slate-500 dark:text-slate-400">{q.id}</td>
                  <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{q.topic}</td>
                  <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{q.difficulty}</td>
                  <td className="max-w-xs truncate py-2 pr-3 text-slate-700 dark:text-slate-200">{bank === "dsa" ? q.title : q.question}</td>
                  <td className="py-2 pr-4 text-right">
                    <button className="btn-ghost" onClick={() => openEdit(q)} aria-label={`Edit ${q.id}`}>
                      <Pencil size={15} />
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => remove(q)}
                      disabled={deletingId === q.id}
                      aria-label={`Delete ${q.id}`}
                    >
                      {deletingId === q.id ? <Spinner label="" /> : <Trash2 size={15} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal
          title={editing.mode === "new" ? `Add ${bank === "dsa" ? "DSA" : "quiz"} question` : "Edit question"}
          onClose={() => setEditing(null)}
        >
          {bank === "dsa" ? (
            <DsaForm
              initial={editing.mode === "edit" ? editing.question : null}
              onSave={save}
              onCancel={() => setEditing(null)}
              saving={saving}
              error={formError}
            />
          ) : (
            <QuizForm
              initial={editing.mode === "edit" ? editing.question : null}
              onSave={save}
              onCancel={() => setEditing(null)}
              saving={saving}
              error={formError}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
