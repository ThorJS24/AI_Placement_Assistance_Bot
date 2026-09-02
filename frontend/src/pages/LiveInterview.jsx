import { useEffect, useRef, useState } from "react";
import { Radio, Mic, MicOff, Send, PhoneOff, Keyboard, RotateCcw, SkipForward, Repeat, Hand } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Spinner from "../components/Spinner.jsx";
import useLiveInterviewSession from "./live-interview/useLiveInterviewSession.js";
import { primeAudioPlayback } from "./live-interview/vad.js";
import { STATES } from "./live-interview/liveInterviewReducer.js";
import Visualizer from "./live-interview/Visualizer.jsx";

const INTERVIEW_TYPES = [
  { id: "behavioral", label: "Behavioral" },
  { id: "technical", label: "Technical" },
  { id: "hr", label: "HR / Culture fit" },
];
const DIFFICULTIES = ["easy", "medium", "hard"];
const STYLES = [
  { id: "friendly", label: "Friendly" },
  { id: "neutral", label: "Neutral" },
  { id: "strict", label: "Strict" },
];
const DURATIONS = [
  { secs: 300, label: "5 min" },
  { secs: 600, label: "10 min" },
  { secs: 900, label: "15 min" },
  { secs: 1800, label: "30 min" },
];

const STATUS_LABEL = {
  [STATES.IDLE]: "",
  [STATES.CONNECTING]: "Connecting...",
  [STATES.READY]: "Ready — waiting for the interviewer",
  [STATES.AI_SPEAKING]: "Interviewer is speaking — tap \"Interrupt\" if you want to jump in",
  [STATES.LISTENING]: "Listening for your answer...",
  [STATES.PROCESSING]: "Thinking about your answer...",
  [STATES.ENDING]: "Wrapping up the interview...",
  [STATES.EVALUATING]: "Scoring your performance...",
  [STATES.COMPLETED]: "Interview complete",
  [STATES.ERROR]: "Something went wrong",
  [STATES.RECONNECTING]: "Live connection lost — reconnecting...",
  [STATES.MIC_PERMISSION_REQUIRED]: "Microphone permission needed",
  [STATES.MICROPHONE_ERROR]: "Microphone unavailable",
  [STATES.CONNECTION_ERROR]: "Live audio couldn't be restored. Continue with text mode.",
};

export default function LiveInterview() {
  const session = useLiveInterviewSession();
  const { state } = session;
  const [phase, setPhase] = useState("lobby"); // lobby | interview | report
  const [role, setRole] = useState("");
  const [interviewType, setInterviewType] = useState("behavioral");
  const [difficulty, setDifficulty] = useState("medium");
  const [style, setStyle] = useState("neutral");
  const [durationSecs, setDurationSecs] = useState(600);
  const [voiceMode, setVoiceMode] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [textInput, setTextInput] = useState("");
  const audioElRef = useRef(null);
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    session.setAudioElement(audioElRef.current);
  }, [session]);

  useEffect(() => {
    if (state.status === STATES.CONNECTING || state.status === STATES.READY) setPhase("interview");
    if (state.status === STATES.COMPLETED) setPhase("report");
  }, [state.status]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [state.transcript.length]);

  const handleStart = () => {
    // Must happen synchronously inside this click handler, before any
    // await in session.start — see primeAudioPlayback's docstring.
    primeAudioPlayback(audioElRef.current);
    session.start({ role, interviewType, difficulty, style, durationSecs, voiceMode });
  };

  const submitText = () => {
    if (!textInput.trim()) return;
    session.sendText(textInput);
    setTextInput("");
  };

  const restart = () => {
    session.reset();
    setPhase("lobby");
    setConfirmEnd(false);
  };

  const isBusyConnecting = state.status === STATES.CONNECTING;
  const canInteract = state.status === STATES.READY || state.status === STATES.LISTENING || state.status === STATES.AI_SPEAKING;

  return (
    <div>
      <PageHeader
        icon={Radio}
        title="Live AI Interview"
        subtitle="A real-time, voice-first mock interview — the interviewer speaks, you can jump in any time, just like a real conversation."
      />

      {/* Shared audio element for AI speech playback — hidden, controlled by the hook */}
      <audio ref={audioElRef} onEnded={session.onClipEnded} className="hidden" />

      {phase === "lobby" && (
        <Lobby
          role={role} setRole={setRole}
          interviewType={interviewType} setInterviewType={setInterviewType}
          difficulty={difficulty} setDifficulty={setDifficulty}
          style={style} setStyle={setStyle}
          durationSecs={durationSecs} setDurationSecs={setDurationSecs}
          voiceMode={voiceMode} setVoiceMode={setVoiceMode}
          busy={isBusyConnecting}
          errorMessage={state.status === STATES.ERROR ? state.errorMessage : ""}
          onStart={handleStart}
        />
      )}

      {phase === "interview" && (
        <div className="space-y-5">
          <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-800 px-4 py-3 shadow-soft">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <span className={`h-2.5 w-2.5 rounded-full ${state.status === STATES.AI_SPEAKING || state.status === STATES.LISTENING ? "animate-pulse bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
              {STATUS_LABEL[state.status] || state.status}
            </span>
            {state.stage && <span className="text-xs text-slate-400 dark:text-slate-500">Stage: {state.stage}</span>}
          </div>

          {(state.status === STATES.MIC_PERMISSION_REQUIRED || state.status === STATES.MICROPHONE_ERROR || state.status === STATES.CONNECTION_ERROR) && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300">
              <p>{STATUS_LABEL[state.status]}. You can keep going by typing your answers below.</p>
              {state.status !== STATES.CONNECTION_ERROR && (
                <button className="btn-secondary mt-2 !py-1.5 text-xs" onClick={session.useTextFallback}>
                  <Keyboard size={14} /> Continue with text
                </button>
              )}
            </div>
          )}

          {state.status === STATES.RECONNECTING && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
              Live connection lost — reconnecting...
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Visualizer analyserRef={session.analyser} active={state.status === STATES.AI_SPEAKING} label="Interviewer audio level" />
            <Visualizer analyserRef={session.analyser} active={state.status === STATES.LISTENING} label="Your microphone level" />
          </div>

          <TranscriptPanel transcript={state.transcript} partialTranscript={state.partialTranscript} endRef={transcriptEndRef} />

          <div className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={session.toggleMute}
                disabled={state.textFallback}
                aria-pressed={state.micMuted}
                aria-label={state.micMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {state.micMuted ? <MicOff size={16} /> : <Mic size={16} />} {state.micMuted ? "Unmute" : "Mute"}
              </button>
              {state.status === STATES.AI_SPEAKING && (
                <button type="button" className="btn-primary" onClick={session.bargeIn}>
                  <Hand size={16} /> Interrupt
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={() => session.sendControl("repeat")} disabled={!canInteract}>
                <Repeat size={16} /> Repeat question
              </button>
              <button type="button" className="btn-secondary" onClick={() => session.sendControl("skip")} disabled={!canInteract}>
                <SkipForward size={16} /> Skip
              </button>
              <button type="button" className="btn-primary ml-auto bg-red-600 hover:bg-red-700" onClick={() => setConfirmEnd(true)}>
                <PhoneOff size={16} /> End interview
              </button>
            </div>

            <div className="flex gap-2">
              <label htmlFor="live-text-fallback" className="sr-only">Type your answer</label>
              <input
                id="live-text-fallback"
                className="input"
                placeholder={state.textFallback ? "Type your answer..." : "Type instead of speaking (always available)..."}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitText()}
                disabled={!canInteract}
              />
              <button className="btn-primary" onClick={submitText} disabled={!canInteract || !textInput.trim()} aria-label="Send typed answer">
                <Send size={16} />
              </button>
            </div>
          </div>

          {confirmEnd && (
            <div role="alertdialog" aria-modal="true" aria-labelledby="end-confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="card w-full max-w-sm p-5">
                <h3 id="end-confirm-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">End this interview?</h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Your responses so far will be scored. This can't be undone.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn-secondary" onClick={() => setConfirmEnd(false)}>Cancel</button>
                  <button className="btn-primary bg-red-600 hover:bg-red-700" onClick={() => { setConfirmEnd(false); session.endInterview(); }}>
                    End &amp; score it
                  </button>
                </div>
              </div>
            </div>
          )}

          {(state.status === STATES.ENDING || state.status === STATES.EVALUATING) && (
            <div className="card p-6 text-center"><Spinner label={STATUS_LABEL[state.status]} /></div>
          )}

          {state.status === STATES.ERROR && (
            <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">{state.errorMessage}</div>
          )}
        </div>
      )}

      {phase === "report" && state.report && (
        <EvaluationReport report={state.report} transcript={state.transcript} onRestart={restart} />
      )}
    </div>
  );
}

function Lobby({
  role, setRole, interviewType, setInterviewType, difficulty, setDifficulty,
  style, setStyle, durationSecs, setDurationSecs, voiceMode, setVoiceMode,
  busy, errorMessage, onStart,
}) {
  return (
    <div className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="live-role">Role you're interviewing for</label>
        <input id="live-role" className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Backend Software Engineer" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="live-type">Interview type</label>
          <select id="live-type" className="input" value={interviewType} onChange={(e) => setInterviewType(e.target.value)}>
            {INTERVIEW_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="live-difficulty">Difficulty</label>
          <select id="live-difficulty" className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="live-style">Interviewer style</label>
          <select id="live-style" className="input" value={style} onChange={(e) => setStyle(e.target.value)}>
            {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="live-duration">Duration</label>
        <div className="flex flex-wrap gap-2" id="live-duration">
          {DURATIONS.map((d) => (
            <button
              type="button" key={d.secs}
              onClick={() => setDurationSecs(d.secs)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                durationSecs === d.secs ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={voiceMode} onChange={(e) => setVoiceMode(e.target.checked)} className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600" />
        <Mic size={15} className="text-brand-600" /> Voice mode. The interviewer speaks out loud and your mic stays open the
        whole time — start talking any time, even mid-question, to jump in. Turn this off to use typed answers only.
      </label>

      <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-300">Before you start</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Use headphones in a quiet room for the most natural back-and-forth. Your mic is only listened to while it's your turn to speak — tap "Interrupt" any time to jump in while the interviewer is talking.</li>
          <li>If your mic isn't available, you can always type your answers instead.</li>
          <li>The interview ends automatically after your chosen duration, or you can end it any time.</li>
        </ul>
      </div>

      {errorMessage && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{errorMessage}</div>}

      <button className="btn-primary" onClick={onStart} disabled={busy || !role.trim()}>
        {busy ? <Spinner label="Connecting..." /> : <><Radio size={16} /> Start live interview</>}
      </button>
    </div>
  );
}

function TranscriptPanel({ transcript, partialTranscript, endRef }) {
  return (
    <div className="card p-4">
      <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Live transcript</p>
      <div role="log" aria-live="polite" aria-relevant="additions" className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
        {transcript.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">The conversation will appear here as it happens.</p>}
        {transcript.map((t) => (
          <div key={t.id} className={`flex ${t.speaker === "ai" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
              t.speaker === "ai"
                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                : "bg-brand-600 text-white"
            } ${!t.final ? "opacity-70" : ""}`}
            >
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                {t.speaker === "ai" ? "AI Interviewer" : "You"}{t.interrupted ? " (interrupted)" : ""}
              </p>
              {t.text}
            </div>
          </div>
        ))}
        {partialTranscript && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl bg-brand-50 px-3.5 py-2 text-sm text-brand-900 opacity-70">
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide">You (typing...)</p>
              {partialTranscript}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

const EVAL_METRICS = [
  ["Overall", "overall_score"],
  ["Technical", "technical_score"],
  ["Communication", "communication_score"],
  ["Confidence", "confidence_score"],
  ["Problem solving", "problem_solving_score"],
  ["Role fit", "role_fit_score"],
];

function EvaluationReport({ report, transcript, onRestart }) {
  return (
    <div className="animate-slide-up space-y-5">
      <div className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Live Interview Report {report.rubric ? `(${report.rubric} rubric)` : ""}</h2>
        {!report.insufficient_data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {EVAL_METRICS.map(([label, key]) => (
              <div key={key} className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-center">
                <p className="text-2xl font-bold text-brand-700">{report[key] ?? "-"}</p>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        )}
        {report.summary && <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{report.summary}</p>}
        {!report.insufficient_data && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">Strengths</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
                {(report.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">Weaknesses</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
                {(report.weaknesses || []).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </div>
        )}
        {report.recommendations?.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-brand-700">Recommendations</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
              {report.recommendations.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
      </div>

      {report.question_notes?.length > 0 && (
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200">Question-by-question notes</summary>
          <div className="mt-3 space-y-3">
            {report.question_notes.map((q, i) => (
              <div key={i} className="border-t border-slate-100 dark:border-slate-800 pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{q.question}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{q.note}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      <details className="card p-5">
        <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200">Full transcript</summary>
        <div className="mt-3 space-y-3">
          {transcript.map((t) => (
            <div key={t.id} className="border-t border-slate-100 dark:border-slate-800 pt-3 first:border-t-0 first:pt-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.speaker === "ai" ? "AI Interviewer" : "You"}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.text}</p>
            </div>
          ))}
        </div>
      </details>

      <button className="btn-primary" onClick={onRestart}>
        <RotateCcw size={16} /> Start a new live interview
      </button>
    </div>
  );
}
