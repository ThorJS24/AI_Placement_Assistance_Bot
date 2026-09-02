import { useEffect, useState } from "react";
import { Map, Sparkles, ChevronDown, Flag, Download, Image as ImageIcon, Wand2 } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Spinner from "../components/Spinner.jsx";
import { apiGet, apiPost, ApiError } from "../api/client.js";

export default function RoadmapGenerator() {
  const [templates, setTemplates] = useState([]);
  const [targetRole, setTargetRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [timeframe, setTimeframe] = useState("3 months");
  const [currentLevel, setCurrentLevel] = useState("");
  const [focusNotes, setFocusNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roadmap, setRoadmap] = useState(null);
  const [openPhase, setOpenPhase] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfFallbackUrl, setPdfFallbackUrl] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState("");
  const [imgFallbackUrl, setImgFallbackUrl] = useState("");
  const [aiImageAvailable, setAiImageAvailable] = useState(false);
  const [aiImgLoading, setAiImgLoading] = useState(false);
  const [aiImgError, setAiImgError] = useState("");
  const [aiImgFallbackUrl, setAiImgFallbackUrl] = useState("");

  useEffect(() => {
    apiGet("/roadmap/templates").then((t) => {
      setTemplates(t);
      if (t.length) setTargetRole(t[0]);
    }).catch(() => {});
  }, []);

  // The AI-illustrated image is an optional extra - only shown if this
  // deployment has configured an image-gen API key (see .env.example's
  // IMAGE_GEN_API_KEY). Stays hidden entirely otherwise, so a fully offline
  // deployment never sees a button for a feature it can't use.
  useEffect(() => {
    apiGet("/roadmap/image/ai-available").then((s) => setAiImageAvailable(!!s.available)).catch(() => {});
  }, []);

  // Pre-fill "current level" from the student's saved academic profile, if
  // they've set one - one less thing to type, and a more grounded starting
  // point for the AI than a blank box. Only touches the field while it's
  // still empty, so it never overwrites something the student already typed.
  useEffect(() => {
    apiGet("/profile").then((p) => {
      setCurrentLevel((prev) => {
        if (prev) return prev;
        const parts = [];
        if (p.semester) parts.push(`Semester ${p.semester}`);
        if (p.stream) parts.push(p.stream);
        let line = parts.join(" ");
        if (p.specialization) line += line ? `, specializing in ${p.specialization}` : `Specializing in ${p.specialization}`;
        if (p.subjects?.length) line += `${line ? ". " : ""}Currently studying: ${p.subjects.join(", ")}.`;
        return line;
      });
    }).catch(() => {});
  }, []);

  const effectiveRole = targetRole === "__other__" ? customRole : targetRole;

  const generate = async () => {
    if (!effectiveRole) return;
    setLoading(true);
    setError("");
    setRoadmap(null);
    try {
      const data = await apiPost("/roadmap/generate", {
        target_role: effectiveRole, current_level: currentLevel, timeframe, focus_notes: focusNotes,
      });
      setRoadmap(data);
      setOpenPhase(0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate a roadmap right now.");
    } finally {
      setLoading(false);
    }
  };

  const downloadText = () => {
    const lines = [`Roadmap: ${roadmap.target_role} (${roadmap.timeframe})`, "", roadmap.overview || "", ""];
    (roadmap.phases || []).forEach((p, i) => {
      lines.push(`Phase ${i + 1}: ${p.name}`);
      lines.push(`Goal: ${p.goal || ""}`);
      lines.push(`Topics: ${(p.topics || []).join("; ")}`);
      lines.push(`Resources: ${(p.resources || []).join("; ")}`);
      lines.push(`Milestone: ${p.milestone || ""}`);
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roadmap.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async () => {
    setPdfLoading(true);
    setPdfError("");
    setPdfFallbackUrl("");
    try {
      const { download_pdf } = await apiPost("/roadmap/pdf", { roadmap });
      // window.open returns null (no throw) when a popup blocker intercepts
      // it - that used to fail completely silently. Fall back to a visible
      // link the student can click themselves.
      const win = window.open(download_pdf, "_blank");
      if (!win) {
        setPdfFallbackUrl(download_pdf);
      }
    } catch (err) {
      setPdfError(err instanceof ApiError ? err.message : "Couldn't generate the PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadImage = async () => {
    setImgLoading(true);
    setImgError("");
    setImgFallbackUrl("");
    try {
      const { download_image } = await apiPost("/roadmap/image", { roadmap });
      const win = window.open(download_image, "_blank");
      if (!win) {
        setImgFallbackUrl(download_image);
      }
    } catch (err) {
      setImgError(err instanceof ApiError ? err.message : "Couldn't generate the image.");
    } finally {
      setImgLoading(false);
    }
  };

  const downloadAiImage = async () => {
    setAiImgLoading(true);
    setAiImgError("");
    setAiImgFallbackUrl("");
    try {
      const { download_image } = await apiPost("/roadmap/image/ai", { roadmap });
      const win = window.open(download_image, "_blank");
      if (!win) {
        setAiImgFallbackUrl(download_image);
      }
    } catch (err) {
      setAiImgError(err instanceof ApiError ? err.message : "Couldn't generate the AI illustration.");
    } finally {
      setAiImgLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        icon={Map}
        title="Personalized Roadmap Generator"
        subtitle="Tell us your target role and timeframe - get a week-by-week study plan grounded in real, free resources."
      />

      <div className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="roadmap-target-role">Target role</label>
            <select id="roadmap-target-role" className="input" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
              {templates.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="__other__">Other (type below)</option>
            </select>
            {targetRole === "__other__" && (
              <input aria-label="Type your target role" className="input mt-2" placeholder="Type your target role" value={customRole} onChange={(e) => setCustomRole(e.target.value)} />
            )}
          </div>
          <div>
            <label className="label" htmlFor="roadmap-timeframe">Timeframe</label>
            <select id="roadmap-timeframe" className="input" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
              {["6 weeks", "3 months", "6 months", "1 year"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="roadmap-current-level">Your current level (be specific - helps personalize the plan)</label>
          <textarea id="roadmap-current-level" className="input" rows={3} value={currentLevel} onChange={(e) => setCurrentLevel(e.target.value)}
            placeholder="e.g. Comfortable with Python basics, know arrays/strings, never done DP or system design." />
        </div>
        <div>
          <label className="label" htmlFor="roadmap-focus-notes">Anything specific to focus on or avoid? (optional)</label>
          <input id="roadmap-focus-notes" className="input" value={focusNotes} onChange={(e) => setFocusNotes(e.target.value)}
            placeholder="e.g. Prioritize interview-ready DSA over deep theory" />
        </div>
        <button className="btn-primary" onClick={generate} disabled={loading || !effectiveRole}>
          {loading ? <Spinner label="Building your personalized roadmap..." /> : <>🚀 Generate my roadmap</>}
        </button>
        {error && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</div>}
      </div>

      {roadmap && (
        <div className="mt-6 animate-slide-up space-y-4">
          <div className="card p-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              📍 {roadmap.target_role} - {roadmap.timeframe}
            </h2>
            {roadmap.overview && <p className="mt-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{roadmap.overview}</p>}
          </div>

          {(roadmap.phases || []).map((phase, i) => (
            <div key={i} className="card overflow-hidden">
              <button
                className="flex w-full items-center justify-between px-5 py-4 text-left"
                onClick={() => setOpenPhase(openPhase === i ? -1 : i)}
                aria-expanded={openPhase === i}
              >
                <div>
                  <span className="text-xs font-semibold text-brand-600">PHASE {i + 1}</span>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{phase.name}</h3>
                </div>
                <ChevronDown size={18} className={`text-slate-400 dark:text-slate-500 transition-transform ${openPhase === i ? "rotate-180" : ""}`} />
              </button>
              {openPhase === i && (
                <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 px-5 py-4">
                  {phase.goal && <p className="text-sm italic text-slate-500 dark:text-slate-400">{phase.goal}</p>}
                  <div>
                    <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">Topics to cover</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
                      {(phase.topics || []).map((t, j) => <li key={j}>{t}</li>)}
                    </ul>
                  </div>
                  {phase.resources?.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">Free resources</p>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
                        {phase.resources.map((r, j) => <li key={j}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                  {phase.milestone && (
                    <div className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-800 dark:text-emerald-300">
                      <Flag size={16} className="mt-0.5 shrink-0" />
                      <span><strong>Milestone:</strong> {phase.milestone}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {roadmap.weekly_checklist_tip && (
            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Sparkles size={14} /> Tip: {roadmap.weekly_checklist_tip}
            </p>
          )}

          {pdfError && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">{pdfError}</div>}
          {pdfFallbackUrl && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300">
              Your browser blocked the popup.{" "}
              <a href={pdfFallbackUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                Click here to open the PDF
              </a>
            </div>
          )}
          {imgError && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">{imgError}</div>}
          {imgFallbackUrl && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300">
              Your browser blocked the popup.{" "}
              <a href={imgFallbackUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                Click here to open the image
              </a>
            </div>
          )}
          {aiImgError && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">{aiImgError}</div>}
          {aiImgFallbackUrl && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300">
              Your browser blocked the popup.{" "}
              <a href={aiImgFallbackUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                Click here to open the illustration
              </a>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button className="btn-secondary" onClick={downloadText}>⬇️ Download as text</button>
            <button className="btn-secondary" onClick={downloadPdf} disabled={pdfLoading}>
              {pdfLoading ? <Spinner label="Preparing PDF..." /> : <><Download size={16} /> Download as PDF</>}
            </button>
            <button className="btn-secondary" onClick={downloadImage} disabled={imgLoading}>
              {imgLoading ? <Spinner label="Rendering image..." /> : <><ImageIcon size={16} /> Download as image</>}
            </button>
            {aiImageAvailable && (
              <button className="btn-secondary" onClick={downloadAiImage} disabled={aiImgLoading}>
                {aiImgLoading ? <Spinner label="Generating AI illustration..." /> : <><Wand2 size={16} /> AI-illustrated image</>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
