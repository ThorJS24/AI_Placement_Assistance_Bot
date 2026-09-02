import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Send, SkipForward, Volume2, Download, Lock } from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Spinner from "../components/Spinner.jsx";
import useLockdown from "../components/useLockdown.js";
import LockdownBanner from "../components/LockdownBanner.jsx";
import useNotifications from "../components/useNotifications.js";
import NotificationStack from "../components/NotificationStack.jsx";
import { apiGet, apiPost, apiPostForm, apiPostStreamLines, ApiError } from "../api/client.js";

const LEVELS = ["Fresher / Final-year student", "0-1 years experience", "1-3 years experience", "3+ years experience"];

export default function MockInterview() {
  const [stage, setStage] = useState("setup"); // setup | running | done | history
  const [role, setRole] = useState("");
  const [level, setLevel] = useState(LEVELS[0]);
  const [numQuestions, setNumQuestions] = useState(5);
  const [voiceMode, setVoiceMode] = useState(true);
  const [autoStopEnabled, setAutoStopEnabled] = useState(true);
  const [liveMode, setLiveMode] = useState(true);

  const [sessionId, setSessionId] = useState(null);
  // Mirrors sessionId synchronously for live mode: a fast barge-in can
  // submit an answer before React has applied the setSessionId() state
  // update from the streaming "session" event, so advance() reads this ref
  // (always current) rather than the `sessionId` state closure (which can
  // still be null/stale in that window).
  const sessionIdRef = useRef(null);
  const [question, setQuestion] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);
  // Live mode: the question text builds up sentence by sentence as it
  // streams in, each with its own already-synthesized audio clip queued for
  // gapless playback - see LiveRunningPanel. `questionStreaming` is true
  // while more sentences may still arrive for the CURRENT question.
  const [audioQueue, setAudioQueue] = useState([]);
  const [questionStreaming, setQuestionStreaming] = useState(false);
  // Increments exactly once per turn, right alongside the setQuestion("")
  // that starts it. LiveRunningPanel's per-turn reset effect depends on
  // THIS instead of a derived `questionText === ""` boolean: on a fast
  // connection, every chunk for a short question can arrive within the same
  // JS tick, and React batches them into one commit that jumps straight
  // from "previous question" to "next question fully loaded" - the
  // transient "" state never gets its own render, so a derived boolean
  // dependency never observes a change and the reset silently never fires.
  // A monotonically-incrementing counter has no such transient value to
  // lose: each turn's committed value is simply different from the last.
  const [turnSeq, setTurnSeq] = useState(0);
  const [qna, setQna] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  // If advancing the interview fails after an answer was already recorded
  // (network hiccup, LLM timeout), this holds what's needed to retry just
  // that step - the student's answer isn't lost, they just need one click
  // instead of being stuck with a submit button that requires a transcript
  // they already cleared.
  const [retryState, setRetryState] = useState(null);
  const [lockdownEnabled, setLockdownEnabled] = useState(true);
  const [endedEarly, setEndedEarly] = useState(false);
  const qnaRef = useRef(qna);
  qnaRef.current = qna;
  const notifications = useNotifications();

  const endInterviewEarly = async (violations) => {
    setBusy(true);
    setEndedEarly(true);
    lockdown.exitFullscreen();
    notifications.push({
      tone: "danger",
      title: "Assessment ended",
      message: "Too many proctoring violations were detected - your interview was submitted automatically.",
      durationMs: 8000,
    });
    try {
      const rep = await apiPost("/mock/finish", { session_id: sessionIdRef.current, role, level, qna: qnaRef.current, violations });
      setReport(rep);
      setStage("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong ending the interview.");
    } finally {
      setBusy(false);
    }
  };

  const lockdown = useLockdown({
    active: lockdownEnabled && stage === "running",
    maxStrikes: 2,
    onViolation: (v) => {
      notifications.push({
        tone: v.severe ? "danger" : "warning",
        title: v.severe ? "Serious violation detected" : "Violation detected",
        message: v.label,
      });
    },
    onLimitExceeded: (violations) => endInterviewEarly(violations),
  });

  const start = async () => {
    setBusy(true);
    setError("");
    setQna([]);
    setTranscript("");
    setEndedEarly(false);
    try {
      if (liveMode) {
        setQuestion("");
        setAudioQueue([]);
        setQuestionStreaming(true);
        setTurnSeq((s) => s + 1);
        setStage("running");
        if (lockdownEnabled) await lockdown.enterFullscreen();
        let fullQuestion = "";
        let streamError = null;
        await apiPostStreamLines("/mock/start/stream", { role, level, num_questions: numQuestions, voice_mode: voiceMode }, (evt) => {
          if (evt.type === "session") {
            sessionIdRef.current = evt.session_id;
            setSessionId(evt.session_id);
          } else if (evt.type === "sentence") {
            setAudioQueue((q) => [...q, { text: evt.text, url: evt.audio_url }]);
            setQuestion((prev) => (prev ? `${prev} ${evt.text}` : evt.text));
          } else if (evt.type === "done") {
            fullQuestion = evt.question;
          } else if (evt.type === "error") {
            streamError = evt.message;
          }
        });
        if (streamError) throw new ApiError(streamError, 503);
        setQuestion(fullQuestion);
        setQuestionStreaming(false);
      } else {
        const data = await apiPost("/mock/start", { role, level, num_questions: numQuestions, voice_mode: voiceMode });
        sessionIdRef.current = data.session_id;
        setSessionId(data.session_id);
        setQuestion(data.question);
        setAudioUrl(data.audio_url);
        setStage("running");
        if (lockdownEnabled) await lockdown.enterFullscreen();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the interview.");
      setStage("setup");
    } finally {
      setBusy(false);
    }
  };

  const advance = async (newQna, finalAnswer) => {
    setBusy(true);
    setError("");
    try {
      if (newQna.length >= numQuestions) {
        lockdown.exitFullscreen();
        const rep = await apiPost("/mock/finish", { session_id: sessionIdRef.current, role, level, qna: newQna });
        setReport(rep);
        setStage("done");
      } else if (liveMode) {
        setQuestion("");
        setAudioQueue([]);
        setQuestionStreaming(true);
        setTurnSeq((s) => s + 1);
        let feedbackText = "";
        let fullQuestion = "";
        let streamError = null;
        await apiPostStreamLines("/mock/next/stream", {
          session_id: sessionIdRef.current, role, level, qna_so_far: newQna, last_answer: finalAnswer, voice_mode: voiceMode,
        }, (evt) => {
          if (evt.type === "feedback") {
            feedbackText = evt.text;
          } else if (evt.type === "sentence") {
            setAudioQueue((q) => [...q, { text: evt.text, url: evt.audio_url }]);
            setQuestion((prev) => (prev ? `${prev} ${evt.text}` : evt.text));
          } else if (evt.type === "done") {
            feedbackText = evt.feedback || feedbackText;
            fullQuestion = evt.next_question;
          } else if (evt.type === "error") {
            streamError = evt.message;
          }
        });
        if (streamError) throw new ApiError(streamError, 503);
        newQna[newQna.length - 1].feedback = feedbackText;
        setQna([...newQna]);
        setQuestion(fullQuestion);
        setQuestionStreaming(false);
      } else {
        const turn = await apiPost("/mock/next", {
          session_id: sessionIdRef.current, role, level, qna_so_far: newQna, last_answer: finalAnswer, voice_mode: voiceMode,
        });
        newQna[newQna.length - 1].feedback = turn.feedback;
        setQna([...newQna]);
        setQuestion(turn.next_question);
        setAudioUrl(turn.audio_url);
      }
      setRetryState(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong preparing the next question.");
      setRetryState({ newQna, finalAnswer });
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (answerText, skip = false) => {
    const finalAnswer = skip ? "(skipped)" : (answerText || "").trim();
    if (!finalAnswer) return;
    const newQna = [...qna, { question, answer: finalAnswer, feedback: "" }];
    setQna(newQna);
    setTranscript("");
    await advance(newQna, finalAnswer);
  };

  const retryAdvance = () => {
    if (retryState) advance(retryState.newQna, retryState.finalAnswer);
  };

  const restart = () => {
    setStage("setup");
    sessionIdRef.current = null;
    setSessionId(null);
    setQuestion("");
    setAudioUrl(null);
    setAudioQueue([]);
    setQuestionStreaming(false);
    setQna([]);
    setTranscript("");
    setReport(null);
    setError("");
    setRetryState(null);
    setEndedEarly(false);
  };

  return (
    <div>
      <NotificationStack notifications={notifications.notifications} onDismiss={notifications.dismiss} />
      <PageHeader
        icon={Mic}
        title="Mock Interview - Speech to Speech"
        subtitle="The interviewer asks out loud, you answer by voice, it adapts in real time. Ends with a full performance report."
      />

      {(stage === "setup" || stage === "history") && (
        <div className="mb-5 inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          {[
            { id: "setup", label: "🎤 New interview" },
            { id: "history", label: "📈 Past attempts" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setStage(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                stage === t.id ? "bg-white dark:bg-slate-800 text-brand-700 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {stage === "setup" && (
        <SetupPanel
          role={role} setRole={setRole} level={level} setLevel={setLevel}
          numQuestions={numQuestions} setNumQuestions={setNumQuestions}
          voiceMode={voiceMode} setVoiceMode={setVoiceMode}
          autoStopEnabled={autoStopEnabled} setAutoStopEnabled={setAutoStopEnabled}
          liveMode={liveMode} setLiveMode={setLiveMode}
          lockdownEnabled={lockdownEnabled} setLockdownEnabled={setLockdownEnabled}
          busy={busy} error={error} onStart={start}
        />
      )}

      {stage === "history" && <HistoryPanel />}

      {stage === "running" && liveMode && (
        <LiveRunningPanel
          idx={qna.length} total={numQuestions} questionText={question} audioQueue={audioQueue}
          questionStreaming={questionStreaming} voiceMode={voiceMode} turnSeq={turnSeq}
          busy={busy} error={error}
          onSubmit={(text) => submitAnswer(text, false)} onSkip={() => submitAnswer(null, true)} qna={qna}
          onRetry={retryState ? retryAdvance : null}
          lockdownEnabled={lockdownEnabled} lockdown={lockdown}
        />
      )}

      {stage === "running" && !liveMode && (
        <RunningPanel
          idx={qna.length} total={numQuestions} question={question} audioUrl={audioUrl} voiceMode={voiceMode}
          autoStopEnabled={autoStopEnabled} liveMode={liveMode}
          transcript={transcript} setTranscript={setTranscript} busy={busy} error={error}
          onSubmit={(text) => submitAnswer(text ?? transcript, false)} onSkip={() => submitAnswer(null, true)} qna={qna}
          onRetry={retryState ? retryAdvance : null}
          lockdownEnabled={lockdownEnabled} lockdown={lockdown}
        />
      )}

      {stage === "done" && report && (
        <ReportPanel report={report} qna={qna} role={role} onRestart={restart} endedEarly={endedEarly} />
      )}
    </div>
  );
}

function ScoreTrend({ sessions }) {
  const scored = [...sessions].filter((s) => s.score != null).reverse(); // oldest -> newest
  if (scored.length < 2) return <p className="text-sm text-slate-400 dark:text-slate-500">Complete at least 2 interviews to see a trend.</p>;
  const w = 320, h = 64, pad = 6;
  const coords = scored.map((s, i) => {
    const x = pad + (i / (scored.length - 1)) * (w - pad * 2);
    const y = h - pad - (Math.min(100, Math.max(0, s.score)) / 100) * (h - pad * 2);
    return [x, y];
  });
  const points = coords.map(([x, y]) => `${x},${y}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="text-brand-600" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="currentColor" />)}
    </svg>
  );
}

function HistoryPanel() {
  const [sessions, setSessions] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    apiGet("/mock/history").then(setSessions).catch(() => setSessions([]));
  }, []);

  if (sessions === null) {
    return <div className="card p-8 text-center"><Spinner label="Loading your history..." /></div>;
  }
  if (sessions.length === 0) {
    return <div className="card p-8 text-center text-sm text-slate-400 dark:text-slate-500">No past attempts yet - start your first mock interview above.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Overall score trend (oldest → newest)</p>
        <ScoreTrend sessions={sessions} />
      </div>
      <div className="space-y-2">
        {sessions.map((s) => (
          <div key={s.id} className="card p-4">
            <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{s.topic || "Mock interview"}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(s.created_at * 1000).toLocaleString()}</p>
              </div>
              <span className="shrink-0 text-lg font-bold text-brand-700">{s.score != null ? Math.round(s.score) : "-"}</span>
            </button>
            {expanded === s.id && s.summary && (
              <div className="mt-3 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm text-slate-600 dark:text-slate-400">
                {s.summary.summary && <p>{s.summary.summary}</p>}
                {s.summary.strengths?.length > 0 && (
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">✅ Strengths</p>
                    <ul className="list-disc space-y-0.5 pl-5">{s.summary.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                )}
                {s.summary.areas_to_improve?.length > 0 && (
                  <div>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">⚠️ Areas to improve</p>
                    <ul className="list-disc space-y-0.5 pl-5">{s.summary.areas_to_improve.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                )}
              </div>
            )}
            {expanded === s.id && !s.summary && (
              <p className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm text-slate-400 dark:text-slate-500">No detailed report was saved for this attempt.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupPanel({
  role, setRole, level, setLevel, numQuestions, setNumQuestions, voiceMode, setVoiceMode,
  autoStopEnabled, setAutoStopEnabled, liveMode, setLiveMode, lockdownEnabled, setLockdownEnabled, busy, error, onStart,
}) {
  return (
    <div className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="mock-role">Role you're interviewing for</label>
          <input id="mock-role" className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Backend Software Engineer" />
        </div>
        <div>
          <label className="label" htmlFor="mock-level">Your experience level</label>
          <select id="mock-level" className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="mock-num-questions">Number of questions: {numQuestions}</label>
          <input id="mock-num-questions" type="range" min={3} max={8} value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} className="w-full accent-brand-600" />
        </div>
        <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={voiceMode} onChange={(e) => setVoiceMode(e.target.checked)} className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600" />
          <Volume2 size={16} /> Speak questions aloud (TTS)
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={liveMode}
          onChange={(e) => setLiveMode(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600"
        />
        <Mic size={15} className="text-brand-600" /> Live conversation mode. The mic listens as soon as each question
        finishes playing, and your answer submits on its own a few seconds after you stop talking. No clicking
        "start recording" or "submit" between turns.
      </label>
      <label className="flex items-center gap-2 pl-6 text-sm text-slate-500 dark:text-slate-400">
        <input
          type="checkbox"
          checked={autoStopEnabled}
          onChange={(e) => setAutoStopEnabled(e.target.checked)}
          disabled={!liveMode}
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 disabled:opacity-50"
        />
        Auto-detect when you stop talking (turns off if you'd rather stop recording manually)
      </label>
      <p className="text-xs text-slate-400 dark:text-slate-500">Tip: use headphones/a quiet room. Every answer is still transcribed to text you can review - nothing submits without you seeing it first.</p>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={lockdownEnabled}
          onChange={(e) => setLockdownEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600"
        />
        <Lock size={15} className="text-brand-600" /> Enable proctoring - blocks copy/paste, right-click &amp;
        dev-tools shortcuts; flags tab switches &amp; leaving fullscreen (browsers don't let a page fully prevent
        those two). Auto-submits after 2 violations.
      </label>
      {error && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</div>}
      <button className="btn-primary" onClick={onStart} disabled={busy || !role}>
        {busy ? <Spinner label="Preparing your first question..." /> : <>🚀 Start mock interview</>}
      </button>
    </div>
  );
}

// Voice-activity-detection tuning for auto-stop recording - see startRecording
// below. Deliberately conservative (a long silence window, a minimum speech
// requirement before it can trigger) so a normal thoughtful pause mid-answer
// never gets mistaken for "done talking".
const VAD_SILENCE_MS = 2200;       // sustained quiet before auto-stopping
const VAD_MIN_SPEECH_MS = 500;     // must hear real speech first, or an auto-stop could fire before the student starts
const VAD_SPEECH_RMS_THRESHOLD = 10; // 0-128 scale from getByteTimeDomainData
const VAD_MAX_RECORDING_MS = 120000; // hard safety cap regardless of VAD state
const AUTO_SUBMIT_COUNTDOWN_SECS = 3; // editable grace window before a transcribed answer submits itself

/**
 * Live conversation mode: a single continuously-open microphone stream for
 * the whole interview (acquired once, not re-requested every turn), with
 * one always-running voice-activity monitor whose behavior depends on the
 * current phase:
 *   - "playing"/"waiting_more" (question audio queued/playing): speech
 *     detected -> barge in, stop the audio, start recording immediately -
 *     the student can interrupt mid-question exactly like a real
 *     conversation, instead of having to wait the AI out.
 *   - "listening" (question finished, mic idle): speech detected -> start
 *     recording - no "Start recording" click needed.
 *   - "recording": existing silence-based auto-stop (when autoStopEnabled).
 * Sentences (each with its own audio clip) arrive incrementally in
 * `audioQueue` and play back to back with no gap, so the student starts
 * hearing the question before the model has finished writing all of it.
 */
function LiveRunningPanel({
  idx, total, questionText, audioQueue, questionStreaming, voiceMode, turnSeq, busy, error, onSubmit, onSkip, qna, onRetry,
  lockdownEnabled, lockdown,
}) {
  const [phase, setPhase] = useState("connecting"); // connecting | playing | waiting_more | listening | recording | transcribing
  const [micError, setMicError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [autoSubmitIn, setAutoSubmitIn] = useState(null);
  const [autoStopEnabled] = useState(true); // live mode always auto-stops on silence; manual "Stop recording" remains available as an override

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const vadRef = useRef({ hasSpoken: false, speechStartedAt: null, silenceStartedAt: null });
  const audioElRef = useRef(null);
  const queueIndexRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const autoSubmitTimerRef = useRef(null);
  const idxRef = useRef(idx);
  idxRef.current = idx;

  const setPhaseBoth = (p) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const cancelAutoSubmit = () => {
    if (autoSubmitTimerRef.current) {
      clearInterval(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    setAutoSubmitIn(null);
  };

  const startAutoSubmitCountdown = (text) => {
    cancelAutoSubmit();
    setAutoSubmitIn(AUTO_SUBMIT_COUNTDOWN_SECS);
    autoSubmitTimerRef.current = setInterval(() => {
      setAutoSubmitIn((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(autoSubmitTimerRef.current);
          autoSubmitTimerRef.current = null;
          onSubmit(text);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const editTranscript = (value) => {
    cancelAutoSubmit();
    setTranscript(value);
  };

  // --- Mic + VAD lifecycle: acquired once for the whole interview -----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser); // not connected to destination -- no echo
          audioCtxRef.current = audioCtx;
          analyserRef.current = analyser;
        }
        // Playback of the opening question may already be underway by the
        // time mic permission resolves (it doesn't wait on this) -- only
        // move off "connecting", never clobber an in-progress phase.
        if (phaseRef.current === "connecting") setPhaseBoth("waiting_more");
      } catch {
        setMicError("Couldn't access your microphone. Check browser permissions, or switch off live mode and type your answers instead.");
      }
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
      cancelAutoSubmit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginRecording = () => {
    const stream = streamRef.current;
    if (!stream || phaseRef.current === "recording") return;
    setPhaseBoth("recording");
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      setPhaseBoth("transcribing");
      try {
        const formData = new FormData();
        formData.append("audio", blob, "answer.webm");
        const { transcript: text } = await apiPostForm("/mock/transcribe", formData);
        setTranscript((prev) => {
          const merged = prev ? `${prev} ${text}` : text;
          if (merged.trim()) startAutoSubmitCountdown(merged);
          return merged;
        });
      } catch (err) {
        setMicError(err instanceof ApiError ? err.message : "Transcription failed.");
      } finally {
        setPhaseBoth("listening");
      }
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
  };

  const bargeIn = () => {
    const el = audioElRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
    }
    queueIndexRef.current = Infinity; // stop consuming any further queued clips for this turn
    beginRecording();
  };

  const stopRecordingManually = () => mediaRecorderRef.current?.stop();

  // The VAD tick loop below is set up once (see its effect's deps: it only
  // needs to (re)start when the analyser first becomes available, not on
  // every render) and then runs indefinitely across every turn for the rest
  // of the interview. bargeIn/beginRecording close over onSubmit/qna/etc,
  // which DO change every turn -- calling them directly from that long-lived
  // closure would freeze turn 3's answer submission against turn 1's stale
  // props. Refs updated on every render fix that: the tick loop calls
  // `.current()`, always reaching whichever version was assigned most recently.
  const beginRecordingRef = useRef(beginRecording);
  beginRecordingRef.current = beginRecording;
  const bargeInRef = useRef(bargeIn);
  bargeInRef.current = bargeIn;

  // --- Voice-activity tick loop: behavior depends on the current phase ------
  useEffect(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const centered = data[i] - 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      const speaking = rms > VAD_SPEECH_RMS_THRESHOLD;
      const now = Date.now();
      const vad = vadRef.current;
      const currentPhase = phaseRef.current;

      if (speaking) {
        if (!vad.hasSpoken) {
          vad.speechStartedAt = vad.speechStartedAt || now;
          if (now - vad.speechStartedAt >= VAD_MIN_SPEECH_MS) {
            vad.hasSpoken = true;
            if (currentPhase === "playing" || currentPhase === "waiting_more") bargeInRef.current();
            else if (currentPhase === "listening") beginRecordingRef.current();
          }
        }
        vad.silenceStartedAt = null;
      } else if (vad.hasSpoken && currentPhase === "recording" && autoStopEnabled) {
        if (!vad.silenceStartedAt) vad.silenceStartedAt = now;
        else if (now - vad.silenceStartedAt >= VAD_SILENCE_MS) {
          stopRecordingManually();
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === "connecting"]); // starts once the analyser exists; phase itself is read live via phaseRef

  // --- Audio queue player -----------------------------------------------
  const playNextInQueue = () => {
    const i = queueIndexRef.current;
    if (i >= audioQueue.length) {
      setPhaseBoth(questionStreaming ? "waiting_more" : "listening");
      return;
    }
    const item = audioQueue[i];
    if (!item.url) {
      // TTS unavailable for this sentence -- skip straight to the next one
      queueIndexRef.current += 1;
      playNextInQueue();
      return;
    }
    const el = audioElRef.current;
    if (!el) return;
    setPhaseBoth("playing");
    el.src = item.url;
    el.play().catch(() => {
      // Autoplay/interruption failure -- move on rather than get stuck
      queueIndexRef.current += 1;
      playNextInQueue();
    });
  };

  const handleClipEnded = () => {
    if (phaseRef.current !== "playing") return; // a barge-in already redirected this turn
    queueIndexRef.current += 1;
    playNextInQueue();
  };

  // New turn started -- reset per-turn state and vad tracking, then let the
  // queue effect below start playback as sentences arrive. Keyed on
  // `turnSeq` (an explicit counter the parent bumps once per turn) rather
  // than on `questionText === ""`: on a fast connection every chunk for a
  // short question can arrive within the same JS tick, and React batches
  // them into a single commit that jumps straight from "previous question"
  // to "next question fully loaded" -- the transient "" state never gets
  // its own render, so a dependency derived from it can silently miss the
  // transition. A monotonically-incrementing counter has no such transient
  // value to lose: each turn's committed value simply differs from the last.
  useEffect(() => {
    queueIndexRef.current = 0;
    vadRef.current = { hasSpoken: false, speechStartedAt: null, silenceStartedAt: null };
    setTranscript("");
    cancelAutoSubmit();
    setMicError("");
    if (streamRef.current) setPhaseBoth("waiting_more");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnSeq]);

  // Fires whenever a new sentence (or a whole new turn's first sentence)
  // arrives -- if we're idle waiting for audio, start playing it.
  useEffect(() => {
    if ((phaseRef.current === "waiting_more" || phaseRef.current === "connecting") && queueIndexRef.current < audioQueue.length) {
      playNextInQueue();
    } else if (!questionStreaming && audioQueue.length === 0 && phaseRef.current === "waiting_more") {
      // voice_mode was off, or TTS failed for every sentence -- nothing to
      // play at all, go straight to listening rather than waiting forever.
      setPhaseBoth("listening");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioQueue.length, questionStreaming]);

  const statusLabel = {
    connecting: "Connecting your microphone...",
    playing: "Speaking - start talking any time to jump in",
    waiting_more: "Thinking...",
    listening: "Listening for your answer...",
    recording: "Recording your answer...",
    transcribing: "Transcribing...",
  }[phase];

  return (
    <div className="space-y-5">
      {lockdownEnabled && lockdown && (
        <LockdownBanner strikes={lockdown.strikes} maxStrikes={lockdown.maxStrikes} />
      )}
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>Question {idx + 1} of {total}</span>
          <span role="status" className="inline-flex items-center gap-1.5 font-medium">
            <span className={`h-2 w-2 rounded-full ${phase === "recording" || phase === "playing" ? "animate-pulse bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
            {statusLabel}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${(idx / total) * 100}%` }} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          🎙️ {questionText || <span className="text-slate-400 dark:text-slate-500">···</span>}
        </h3>
        <audio ref={audioElRef} onEnded={handleClipEnded} className="hidden" />

        {phase === "recording" && (
          <button className="btn-secondary mb-3" onClick={stopRecordingManually} aria-label="Stop recording your answer">
            <Square size={16} /> Stop recording
          </button>
        )}
        {micError && <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">{micError}</p>}

        <label className="label" htmlFor="mock-transcript-live">Your answer (fills in as you speak - edit any time)</label>
        <textarea id="mock-transcript-live" className="input" rows={5} value={transcript} onChange={(e) => editTranscript(e.target.value)} />

        {autoSubmitIn !== null && (
          <div role="status" aria-live="polite" className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
            <span>Submitting automatically in {autoSubmitIn}s. Start typing to edit instead.</span>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-secondary !px-3 !py-1 text-xs" onClick={cancelAutoSubmit}>Cancel</button>
              <button type="button" className="btn-primary !px-3 !py-1 text-xs" onClick={() => { cancelAutoSubmit(); onSubmit(transcript); }}>
                Submit now
              </button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">
            {error}
            {onRetry && <p className="mt-1 font-medium">Your answer was saved - just retry to get the next question.</p>}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          {onRetry ? (
            <button className="btn-primary" onClick={onRetry} disabled={busy}>
              {busy ? <Spinner label="Retrying..." /> : <><RotateCcw size={16} /> Retry</>}
            </button>
          ) : (
            <>
              <button className="btn-primary" onClick={() => { cancelAutoSubmit(); onSubmit(transcript); }} disabled={busy || !transcript.trim()}>
                {busy ? <Spinner label="Preparing next question..." /> : <><Send size={16} /> Submit answer</>}
              </button>
              <button className="btn-secondary" onClick={() => { cancelAutoSubmit(); onSkip(); }} disabled={busy}>
                <SkipForward size={16} /> Skip this question
              </button>
            </>
          )}
        </div>
      </div>

      {qna.length > 0 && (
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200">📝 Feedback so far</summary>
          <div className="mt-3 space-y-3">
            {qna.map((t, i) => (
              <div key={i} className="border-t border-slate-100 dark:border-slate-800 pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Q{i + 1}: {t.question}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your answer: {t.answer}</p>
                {t.feedback && <p className="mt-1 rounded-lg bg-brand-50 p-2 text-sm text-brand-900">{t.feedback}</p>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function RunningPanel({
  idx, total, question, audioUrl, voiceMode, autoStopEnabled, liveMode, transcript, setTranscript, busy, error, onSubmit, onSkip, qna, onRetry,
  lockdownEnabled, lockdown,
}) {
  const [recState, setRecState] = useState("idle"); // idle | recording | transcribing
  const [micError, setMicError] = useState("");
  const [listening, setListening] = useState(false); // true once VAD has detected the student is actively speaking
  const [autoSubmitIn, setAutoSubmitIn] = useState(null); // seconds remaining, or null when no auto-submit is pending
  const autoSubmitTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const vadRef = useRef(null); // { audioCtx, analyser, raf, hasSpoken, speechStartedAt, silenceStartedAt, maxTimer }

  const cancelAutoSubmit = () => {
    if (autoSubmitTimerRef.current) {
      clearInterval(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
    setAutoSubmitIn(null);
  };

  // Live mode's hands-free loop: once an answer is transcribed, submit it
  // automatically after a short, visibly-counting-down grace window rather
  // than waiting for a manual click - but editing the transcript during that
  // window (see the textarea's onChange below) cancels the countdown and
  // hands control back, so nothing is ever sent without the student seeing
  // it first.
  const startAutoSubmitCountdown = (text) => {
    cancelAutoSubmit();
    setAutoSubmitIn(AUTO_SUBMIT_COUNTDOWN_SECS);
    autoSubmitTimerRef.current = setInterval(() => {
      setAutoSubmitIn((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(autoSubmitTimerRef.current);
          autoSubmitTimerRef.current = null;
          onSubmit(text);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    setRecState("idle");
    setMicError("");
    cancelAutoSubmit();
    // Live mode with no audio to wait for (TTS off, or unavailable for this
    // question) - nothing will fire the <audio onEnded> handler below, so
    // start listening for the answer right away instead of leaving the
    // student to click "Start recording" themselves.
    if (liveMode && (!voiceMode || !audioUrl)) {
      const id = setTimeout(() => startRecording(), 300);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  const teardownVad = () => {
    const vad = vadRef.current;
    if (!vad) return;
    if (vad.raf) cancelAnimationFrame(vad.raf);
    if (vad.maxTimer) clearTimeout(vad.maxTimer);
    vad.audioCtx?.close().catch(() => {});
    vadRef.current = null;
    setListening(false);
  };

  // Monitors mic volume via the Web Audio API so recording can stop itself
  // the moment the student finishes talking - a real interviewer doesn't
  // need to be told "stop recording", they just notice you've finished.
  // Manual "Stop recording" stays available as an override for anyone who
  // prefers it (or in a noisy room where auto-detection isn't reliable).
  const startVad = (stream, onSilenceDetected) => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return; // VAD is a nice-to-have; unsupported browsers just keep manual stop
    const audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser); // intentionally NOT connected to audioCtx.destination - no echo/feedback
    const data = new Uint8Array(analyser.frequencyBinCount);

    const vad = { audioCtx, analyser, raf: null, hasSpoken: false, silenceStartedAt: null };
    vadRef.current = vad;

    const tick = () => {
      if (!vadRef.current) return;
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const centered = data[i] - 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      const speaking = rms > VAD_SPEECH_RMS_THRESHOLD;
      const now = Date.now();

      if (speaking) {
        if (!vad.hasSpoken) {
          vad.speechStartedAt = vad.speechStartedAt || now;
          if (now - vad.speechStartedAt >= VAD_MIN_SPEECH_MS) {
            vad.hasSpoken = true;
            setListening(true);
          }
        }
        vad.silenceStartedAt = null;
      } else if (vad.hasSpoken) {
        if (!vad.silenceStartedAt) vad.silenceStartedAt = now;
        else if (now - vad.silenceStartedAt >= VAD_SILENCE_MS) {
          onSilenceDetected();
          return; // stop the loop - recorder.onstop will tear VAD down
        }
      }
      vad.raf = requestAnimationFrame(tick);
    };
    vad.raf = requestAnimationFrame(tick);
  };

  const startRecording = async () => {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        teardownVad();
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecState("transcribing");
        try {
          const formData = new FormData();
          formData.append("audio", blob, "answer.webm");
          const { transcript: text } = await apiPostForm("/mock/transcribe", formData);
          let merged = "";
          setTranscript((prev) => {
            merged = prev ? `${prev} ${text}` : text;
            return merged;
          });
          if (liveMode && merged.trim()) startAutoSubmitCountdown(merged);
        } catch (err) {
          setMicError(err instanceof ApiError ? err.message : "Transcription failed.");
        } finally {
          setRecState("idle");
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecState("recording");
      if (autoStopEnabled) {
        startVad(stream, () => mediaRecorderRef.current?.stop());
        vadRef.current.maxTimer = setTimeout(() => mediaRecorderRef.current?.stop(), VAD_MAX_RECORDING_MS);
      }
    } catch {
      setMicError("Couldn't access your microphone. Check browser permissions, or just type your answer below.");
    }
  };

  const stopRecording = () => mediaRecorderRef.current?.stop();

  // Live mode: once the question audio finishes playing, start listening
  // right away instead of waiting for a manual click. No-op when live mode
  // is off, or when there's no audio to wait for (that case is handled by
  // the [question] effect above instead).
  const handleAudioEnded = () => {
    if (liveMode && recState === "idle") startRecording();
  };

  const editTranscript = (value) => {
    cancelAutoSubmit(); // typing takes back manual control for this turn
    setTranscript(value);
  };

  useEffect(() => () => { teardownVad(); cancelAutoSubmit(); }, []); // safety net if the component unmounts mid-turn

  return (
    <div className="space-y-5">
      {lockdownEnabled && lockdown && (
        <LockdownBanner strikes={lockdown.strikes} maxStrikes={lockdown.maxStrikes} />
      )}
      <div>
        <div className="mb-2 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>Question {idx + 1} of {total}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${(idx / total) * 100}%` }} />
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">🎙️ {question}</h3>
        {voiceMode && audioUrl && (
          <audio key={audioUrl} src={audioUrl} autoPlay controls className="mb-4 w-full" onEnded={handleAudioEnded} />
        )}

        <div className="mb-3 flex items-center gap-3">
          {recState === "recording" ? (
            <button className="btn-primary bg-red-600 hover:bg-red-700" onClick={stopRecording} aria-label="Stop recording your answer">
              <Square size={16} /> Stop recording
            </button>
          ) : (
            <button className="btn-secondary" onClick={startRecording} disabled={recState === "transcribing"} aria-label="Start recording your answer">
              <Mic size={16} /> {recState === "transcribing" ? "Transcribing..." : "Start recording"}
            </button>
          )}
          {recState === "transcribing" && <Spinner label="Transcribing your answer..." />}
          {recState === "recording" && autoStopEnabled && (
            <span role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className={`h-2 w-2 rounded-full ${listening ? "animate-pulse bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`} />
              {listening ? "Listening, will stop on its own once you finish" : "Waiting for you to start speaking..."}
            </span>
          )}
        </div>
        {micError && <p className="mb-3 text-sm text-amber-600 dark:text-amber-400">{micError}</p>}

        {!onRetry && (
          <>
            <label className="label" htmlFor="mock-transcript">Transcript (edit if needed, or type your answer directly)</label>
            <textarea id="mock-transcript" className="input" rows={5} value={transcript} onChange={(e) => editTranscript(e.target.value)} />
          </>
        )}

        {autoSubmitIn !== null && (
          <div role="status" aria-live="polite" className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
            <span>Submitting automatically in {autoSubmitIn}s. Start typing to edit instead.</span>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-secondary !px-3 !py-1 text-xs" onClick={cancelAutoSubmit}>Cancel</button>
              <button type="button" className="btn-primary !px-3 !py-1 text-xs" onClick={() => { cancelAutoSubmit(); onSubmit(transcript); }}>
                Submit now
              </button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">
            {error}
            {onRetry && <p className="mt-1 font-medium">Your answer was saved - just retry to get the next question.</p>}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          {onRetry ? (
            <button className="btn-primary" onClick={onRetry} disabled={busy}>
              {busy ? <Spinner label="Retrying..." /> : <><RotateCcw size={16} /> Retry</>}
            </button>
          ) : (
            <>
              <button className="btn-primary" onClick={() => { cancelAutoSubmit(); onSubmit(transcript); }} disabled={busy || !transcript.trim()}>
                {busy ? <Spinner label="Preparing next question..." /> : <><Send size={16} /> Submit answer</>}
              </button>
              <button className="btn-secondary" onClick={() => { cancelAutoSubmit(); onSkip(); }} disabled={busy}>
                <SkipForward size={16} /> Skip this question
              </button>
            </>
          )}
        </div>
      </div>

      {qna.length > 0 && (
        <details className="card p-5">
          <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200">📝 Feedback so far</summary>
          <div className="mt-3 space-y-3">
            {qna.map((t, i) => (
              <div key={i} className="border-t border-slate-100 dark:border-slate-800 pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Q{i + 1}: {t.question}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your answer: {t.answer}</p>
                {t.feedback && <p className="mt-1 rounded-lg bg-brand-50 p-2 text-sm text-brand-900">{t.feedback}</p>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ReportPanel({ report, qna, role, onRestart, endedEarly }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfFallbackUrl, setPdfFallbackUrl] = useState("");

  const downloadPdf = async () => {
    setPdfLoading(true);
    setPdfError("");
    setPdfFallbackUrl("");
    try {
      const { download_pdf } = await apiPost("/mock/report/pdf", { report, role, qna });
      const win = window.open(download_pdf, "_blank");
      if (!win) setPdfFallbackUrl(download_pdf);
    } catch (err) {
      setPdfError(err instanceof ApiError ? err.message : "Couldn't generate the PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const metrics = [
    ["Overall", report.overall_score],
    ["Communication", report.communication_score],
    ["Content depth", report.content_depth_score],
    ["Structure (STAR)", report.structure_score],
  ];
  return (
    <div className="animate-slide-up space-y-5">
      <div className="card p-5">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">📊 Performance Report - {role}</h2>
        {endedEarly && (
          <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
            🔒 Ended early - too many proctoring violations were detected.
          </div>
        )}
        {!report.insufficient_data && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map(([label, val]) => (
              <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-center">
                <p className="text-2xl font-bold text-brand-700">{val ?? "-"}</p>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        )}
        {report.summary && <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{report.summary}</p>}
        {!report.insufficient_data && (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">✅ Strengths</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
                  {(report.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">⚠️ Areas to improve</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
                  {(report.areas_to_improve || []).map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>
            {report.filler_word_note && <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">🗣️ {report.filler_word_note}</p>}
          </>
        )}
      </div>

      <details className="card p-5">
        <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200">📜 Full transcript</summary>
        <div className="mt-3 space-y-3">
          {qna.map((t, i) => (
            <div key={i} className="border-t border-slate-100 dark:border-slate-800 pt-3 first:border-t-0 first:pt-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Q{i + 1}: {t.question}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t.answer}</p>
              {t.feedback && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Feedback: {t.feedback}</p>}
            </div>
          ))}
        </div>
      </details>

      {pdfError && <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-700 dark:text-red-400">{pdfError}</div>}
      {pdfFallbackUrl && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-300">
          Your browser blocked the popup.{" "}
          <a href={pdfFallbackUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
            Click here to open the PDF
          </a>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" onClick={onRestart}>
          <RotateCcw size={16} /> Start a new mock interview
        </button>
        <button className="btn-secondary" onClick={downloadPdf} disabled={pdfLoading}>
          {pdfLoading ? <Spinner label="Preparing PDF..." /> : <><Download size={16} /> Download report as PDF</>}
        </button>
      </div>
    </div>
  );
}
