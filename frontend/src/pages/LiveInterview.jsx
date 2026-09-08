import { useEffect, useRef, useState } from "react";
import { Radio, Mic, MicOff, Send, PhoneOff, Keyboard, RotateCcw, SkipForward, Repeat, Hand, Video, VideoOff, MessageSquare, Shield, Bot, Sparkles, X, User } from "lucide-react";
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
  [STATES.CONNECTING]: "Connecting Zoom voice stream...",
  [STATES.READY]: "Connected - Interviewer host is starting",
  [STATES.AI_SPEAKING]: "Interviewer is speaking (Talk to interrupt)",
  [STATES.LISTENING]: "Listening to you... (Speak naturally)",
  [STATES.PROCESSING]: "Interviewer is processing your response...",
  [STATES.ENDING]: "Wrapping up Zoom call...",
  [STATES.EVALUATING]: "Generating evaluation report...",
  [STATES.COMPLETED]: "Interview complete",
  [STATES.ERROR]: "Live connection error",
  [STATES.RECONNECTING]: "Reconnecting video call audio...",
  [STATES.MIC_PERMISSION_REQUIRED]: "Microphone access required",
  [STATES.MICROPHONE_ERROR]: "Microphone unavailable",
  [STATES.CONNECTION_ERROR]: "Audio stream lost. Type answer in Zoom chat.",
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

  // Zoom Video Call state
  const webcamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(true);
  const [showChatDrawer, setShowChatDrawer] = useState(true);
  const [elapsedSecs, setElapsedSecs] = useState(0);

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
  }, [state.transcript.length, state.partialTranscript]);

  // Webcam video stream effect
  useEffect(() => {
    if (phase !== "interview" || !cameraOn) return;
    let stream = null;
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: false })
        .then((s) => {
          stream = s;
          if (webcamRef.current) webcamRef.current.srcObject = s;
        })
        .catch(() => {
          // Camera optional fallback
        });
    }
    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [phase, cameraOn]);

  // Zoom call timer interval
  useEffect(() => {
    if (phase !== "interview") return;
    const timer = setInterval(() => setElapsedSecs((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
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
    setElapsedSecs(0);
  };

  const isBusyConnecting = state.status === STATES.CONNECTING;
  const canInteract = state.status === STATES.READY || state.status === STATES.LISTENING || state.status === STATES.AI_SPEAKING;

  // Latest floating text for Zoom closed caption
  const lastTurn = state.transcript[state.transcript.length - 1];
  const floatingCaption = state.status === STATES.AI_SPEAKING && lastTurn?.speaker === "ai"
    ? lastTurn.text
    : state.partialTranscript
    ? state.partialTranscript
    : null;

  return (
    <div>
      <PageHeader
        icon={Radio}
        title="Live AI Interview"
        subtitle="A real-time Zoom video call mock interview with an AI interviewer host."
      />

      {/* Shared audio element for AI speech playback */}
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
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl text-slate-100 min-h-[640px]">
          {/* Zoom Top Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
            <div className="flex items-center gap-3">
              <Shield size={16} className="text-emerald-400" />
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-200">Zoom Call: {role || "Technical Role"}</span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400 uppercase tracking-wide">
                  {interviewType} • {difficulty}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 font-mono text-xs font-medium text-red-400 border border-red-500/20">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                REC {formatTimer(elapsedSecs)}
              </span>

              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {STATUS_LABEL[state.status] || state.status}
              </span>

              <button
                type="button"
                onClick={() => setShowChatDrawer(!showChatDrawer)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  showChatDrawer ? "bg-brand-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
                title="Toggle In-Meeting Chat"
              >
                <MessageSquare size={14} />
                Chat &amp; Captions
              </button>
            </div>
          </div>

          {/* Main Zoom Call Workspace */}
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row relative">
            {/* Video Tile Grid */}
            <div className="flex-1 p-4 grid gap-4 sm:grid-cols-2 relative bg-slate-950 items-center justify-center">
              {/* Tile 1: AI Interviewer (Host) */}
              <div className={`relative flex flex-col items-center justify-center rounded-2xl bg-slate-900/90 border border-slate-800 p-6 min-h-[260px] sm:min-h-[320px] transition-all ${
                state.status === STATES.AI_SPEAKING ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20" : ""
              }`}>
                {/* Host badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-slate-950/80 px-2 py-1 text-[11px] font-semibold text-slate-300 border border-slate-800">
                  <Bot size={13} className="text-brand-400" />
                  <span>AI Interviewer (Host)</span>
                </div>

                {/* Speaker indicator pulse ring */}
                <div className="relative flex items-center justify-center my-4">
                  {state.status === STATES.AI_SPEAKING && (
                    <span className="absolute h-28 w-28 rounded-full bg-emerald-500/20 animate-ping" />
                  )}
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-xl">
                    <Sparkles size={40} className={state.status === STATES.AI_SPEAKING ? "animate-bounce" : ""} />
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <p className="font-semibold text-sm text-slate-200">Senior Technical Interviewer</p>
                  <p className="text-xs text-slate-400">
                    {state.status === STATES.AI_SPEAKING ? "Speaking..." : state.status === STATES.PROCESSING ? "Thinking..." : "Listening"}
                  </p>
                </div>

                {/* Audio visualizer bar inside AI tile */}
                <div className="w-48 mt-3">
                  <Visualizer analyserRef={session.analyser} active={state.status === STATES.AI_SPEAKING} label="Interviewer Audio" />
                </div>
              </div>

              {/* Tile 2: Candidate (You) */}
              <div className={`relative flex flex-col items-center justify-center rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden min-h-[260px] sm:min-h-[320px] transition-all ${
                state.status === STATES.LISTENING ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20" : ""
              }`}>
                {/* Candidate badge */}
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-md bg-slate-950/80 px-2 py-1 text-[11px] font-semibold text-slate-300 border border-slate-800">
                  <User size={13} className="text-emerald-400" />
                  <span>You (Candidate)</span>
                </div>

                {cameraOn ? (
                  <video
                    ref={webcamRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover transform -scale-x-100"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 my-auto">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-800 text-slate-400 text-2xl font-bold border border-slate-700">
                      YOU
                    </div>
                    <p className="mt-3 text-xs text-slate-400">Camera turned off</p>
                  </div>
                )}

                {/* Microphone visualizer bar over Candidate tile */}
                <div className="absolute bottom-3 left-3 right-3 z-10 bg-slate-950/80 backdrop-blur-md rounded-xl p-2 border border-slate-800/80">
                  <Visualizer analyserRef={session.analyser} active={state.status === STATES.LISTENING} label="Your Microphone Level" />
                </div>
              </div>

              {/* Floating Closed Caption / Subtitle Overlay */}
              {floatingCaption && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 max-w-xl rounded-xl bg-black/85 backdrop-blur-md px-4 py-2.5 text-center text-sm font-medium text-white shadow-2xl border border-slate-700/60 animate-fade-in">
                  <span className="text-emerald-400 text-xs font-semibold uppercase mr-2">[Subtitles]</span>
                  {floatingCaption}
                </div>
              )}
            </div>

            {/* Zoom Right Side Chat & Transcript Drawer */}
            {showChatDrawer && (
              <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900 flex flex-col h-[380px] lg:h-auto">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">In-Meeting Transcript &amp; Chat</span>
                  <button onClick={() => setShowChatDrawer(false)} className="text-slate-400 hover:text-white lg:hidden">
                    <X size={16} />
                  </button>
                </div>

                <div role="log" aria-live="polite" className="flex-1 overflow-y-auto p-4 space-y-3">
                  {state.transcript.length === 0 && (
                    <p className="text-xs text-slate-500 italic">Conversation transcript will scroll here in real time...</p>
                  )}
                  {state.transcript.map((t) => (
                    <div key={t.id} className={`flex ${t.speaker === "ai" ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[90%] rounded-xl px-3 py-2 text-xs ${
                        t.speaker === "ai" ? "bg-slate-800 text-slate-200" : "bg-brand-600 text-white"
                      }`}>
                        <p className="mb-0.5 font-bold text-[10px] uppercase opacity-75">
                          {t.speaker === "ai" ? "Interviewer" : "You"}{t.interrupted ? " (interrupted)" : ""}
                        </p>
                        <p className="leading-relaxed">{t.text}</p>
                      </div>
                    </div>
                  ))}
                  {state.partialTranscript && (
                    <div className="flex justify-end">
                      <div className="max-w-[90%] rounded-xl bg-brand-900/50 px-3 py-2 text-xs text-brand-200 border border-brand-700/50 opacity-80">
                        <p className="mb-0.5 font-bold text-[10px] uppercase">You (speaking...)</p>
                        <p>{state.partialTranscript}</p>
                      </div>
                    </div>
                  )}
                  <div ref={transcriptEndRef} />
                </div>

                {/* Text Fallback Input inside Zoom Drawer */}
                <div className="border-t border-slate-800 p-3 bg-slate-950">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-brand-500"
                      placeholder="Type response in chat..."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitText()}
                      disabled={!canInteract}
                    />
                    <button
                      onClick={submitText}
                      disabled={!canInteract || !textInput.trim()}
                      className="rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Zoom Bottom Toolbar */}
          <div className="border-t border-slate-800 bg-slate-900 p-3 flex flex-wrap items-center justify-between gap-3 text-slate-200">
            {/* Left audio & video controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={session.toggleMute}
                disabled={state.textFallback}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  state.micMuted ? "bg-red-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                }`}
              >
                {state.micMuted ? <MicOff size={15} /> : <Mic size={15} />}
                <span>{state.micMuted ? "Unmute" : "Mute"}</span>
              </button>

              <button
                type="button"
                onClick={() => setCameraOn(!cameraOn)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                  !cameraOn ? "bg-red-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                }`}
              >
                {!cameraOn ? <VideoOff size={15} /> : <Video size={15} />}
                <span>{!cameraOn ? "Start Video" : "Stop Video"}</span>
              </button>
            </div>

            {/* Center Zoom call interaction buttons */}
            <div className="flex items-center gap-2">
              {state.status === STATES.AI_SPEAKING && (
                <button type="button" className="btn-primary !py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={session.bargeIn}>
                  <Hand size={15} /> Raise Hand / Interrupt
                </button>
              )}
              <button type="button" className="btn-secondary !py-1.5 text-xs bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700" onClick={() => session.sendControl("repeat")} disabled={!canInteract}>
                <Repeat size={14} /> Repeat
              </button>
              <button type="button" className="btn-secondary !py-1.5 text-xs bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700" onClick={() => session.sendControl("skip")} disabled={!canInteract}>
                <SkipForward size={14} /> Skip
              </button>
            </div>

            {/* Right End Call red button */}
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 shadow-md"
              onClick={() => setConfirmEnd(true)}
            >
              <PhoneOff size={15} />
              <span>End Call</span>
            </button>
          </div>

          {/* Zoom Leave Confirmation Dialog */}
          {confirmEnd && (
            <div role="alertdialog" aria-modal="true" aria-labelledby="end-confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="card w-full max-w-sm p-5 border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
                <h3 id="end-confirm-title" className="text-base font-semibold text-slate-100">Leave Zoom Interview Call?</h3>
                <p className="mt-2 text-sm text-slate-400">Your interview responses so far will be evaluated and scored into a performance report.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn-secondary !py-1.5 text-xs bg-slate-800 text-slate-300 border-slate-700" onClick={() => setConfirmEnd(false)}>Cancel</button>
                  <button className="btn-primary !py-1.5 text-xs bg-red-600 hover:bg-red-700" onClick={() => { setConfirmEnd(false); session.endInterview(); }}>
                    End &amp; Score Call
                  </button>
                </div>
              </div>
            </div>
          )}

          {(state.status === STATES.ENDING || state.status === STATES.EVALUATING) && (
            <div className="p-6 text-center bg-slate-900 border-t border-slate-800"><Spinner label={STATUS_LABEL[state.status]} /></div>
          )}

          {state.status === STATES.ERROR && (
            <div role="alert" className="p-4 text-sm text-red-400 bg-red-950/60 border-t border-red-800">{state.errorMessage}</div>
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
        whole time - start talking any time, even mid-question, to jump in. Turn this off to use typed answers only.
      </label>

      <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 text-sm text-slate-600 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-300">Before you start</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Use headphones in a quiet room for the most natural back-and-forth. Your mic is only listened to while it's your turn to speak - tap "Interrupt" any time to jump in while the interviewer is talking.</li>
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
