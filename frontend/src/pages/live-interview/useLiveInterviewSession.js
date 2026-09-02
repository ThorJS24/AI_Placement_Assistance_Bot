import { useCallback, useEffect, useReducer, useRef } from "react";
import { apiPost, apiPostForm, ApiError } from "../../api/client.js";
import { liveInterviewReducer, initialLiveInterviewState, STATES, canBargeIn, canAcceptInput } from "./liveInterviewReducer.js";
import { createAudioQueueState, startResponse, enqueue, peekNext, advance, interrupt as interruptQueue, isDrained } from "./audioQueue.js";
import { startVad, stopVad, float32ToWavBlob, blobToBase64 } from "./vad.js";

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_ATTEMPTS = 5;

function wsUrlFor(path) {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}`;
}

/**
 * Orchestrates one Live AI Interview session: creates the session over
 * REST, opens the WS, wires up microphone + VAD (falling back to text if
 * either is unavailable), plays back streamed AI audio sentence-by-sentence
 * with real barge-in, and exposes a small imperative API (start, sendText,
 * toggleMute, endInterview, ...) plus the reducer's state for the page to
 * render. All cleanup (tracks, AudioContext, WS, VAD, timers/rAF) happens
 * in one place (`teardown`) so unmounting mid-interview never leaks.
 */
export default function useLiveInterviewSession() {
  const [state, dispatch] = useReducer(liveInterviewReducer, initialLiveInterviewState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null); // for the caller's canvas visualizer to read live amplitude from
  const vadRef = useRef(null);
  const playerElRef = useRef(null); // an <audio> element the page mounts and hands us via setAudioElement
  const audioQueueRef = useRef(createAudioQueueState());
  const isPlayingRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const configRef = useRef(null);
  const sessionIdRef = useRef(null);
  const manualEndRef = useRef(false);

  const setAudioElement = useCallback((el) => {
    playerElRef.current = el;
  }, []);

  // --- Playback --------------------------------------------------------
  const playNext = useCallback(() => {
    const q = audioQueueRef.current;
    const item = peekNext(q);
    const el = playerElRef.current;
    if (!item) {
      isPlayingRef.current = false; // nothing ready yet; more may still arrive, or the turn is done
      return;
    }
    audioQueueRef.current = advance(audioQueueRef.current);
    if (!item.url || !el) {
      playNext();
      return;
    }
    isPlayingRef.current = true;
    el.src = item.url;
    el.play().catch(() => playNext());
  }, []);

  const handleClipEnded = useCallback(() => {
    isPlayingRef.current = false;
    if (!isDrained(audioQueueRef.current)) playNext();
  }, [playNext]);

  // --- Sending helpers ---------------------------------------------------
  const sendRaw = useCallback((payload) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
  }, []);

  const sendClientEvent = useCallback((eventType, metadata) => {
    sendRaw({ type: "client_event", event_type: eventType, metadata });
  }, [sendRaw]);

  // --- Barge-in / interrupt ------------------------------------------------
  const bargeIn = useCallback(() => {
    if (!canBargeIn(stateRef.current.status)) return;
    const responseId = stateRef.current.activeResponseId;
    // Stop local playback FIRST, before sending anything over the wire or
    // updating any state - never a moment of overlapping AI+candidate audio.
    const el = playerElRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
      el.removeAttribute("src");
    }
    isPlayingRef.current = false;
    audioQueueRef.current = interruptQueue(audioQueueRef.current, responseId);
    dispatch({ type: "BARGE_IN" });
    if (responseId != null) sendRaw({ type: "interrupt", response_id: responseId });
    sendClientEvent("AI_INTERRUPTED", { response_id: responseId });
  }, [sendRaw, sendClientEvent]);

  // --- Candidate utterance (voice) ---------------------------------------
  const handleSpeechEnd = useCallback(async (audio) => {
    if (!canAcceptInput(stateRef.current.status)) return;
    try {
      const blob = float32ToWavBlob(audio);
      const audio_base64 = await blobToBase64(blob);
      sendRaw({ type: "audio_answer", audio_base64, mime: "audio/wav" });
    } catch {
      dispatch({ type: "ERROR", message: "Could not process your recording - try again or switch to typing." });
    }
  }, [sendRaw]);

  const handleSpeechStart = useCallback(() => {
    if (canBargeIn(stateRef.current.status)) {
      bargeIn();
    }
    // canAcceptInput case: nothing to do here - MicVAD itself buffers the
    // utterance and only calls onSpeechEnd once, no manual "start recording"
    // step is needed the way the older MediaRecorder-based flow required.
  }, [bargeIn]);

  // --- Mic + VAD setup -----------------------------------------------------
  const setupMicAndVad = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser); // not connected to destination - no echo
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
      }

      const vad = await startVad(stream, {
        onSpeechStart: handleSpeechStart,
        onSpeechEnd: handleSpeechEnd,
        onVadError: () => dispatch({ type: "MICROPHONE_ERROR", message: "Voice detection failed to start - you can still type your answers." }),
      });
      vadRef.current = vad;
      sendClientEvent("MIC_PERMISSION_GRANTED", {});
    } catch (err) {
      const isPermission = err && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      dispatch(isPermission ? { type: "MIC_PERMISSION_REQUIRED" } : { type: "MICROPHONE_ERROR", message: "Couldn't access your microphone or voice detection isn't supported in this browser." });
    }
  }, [handleSpeechStart, handleSpeechEnd, sendClientEvent]);

  const teardownMicAndVad = useCallback(() => {
    stopVad(vadRef.current);
    vadRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  // --- WS message handling --------------------------------------------------
  const handleServerMessage = useCallback((evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }
    switch (msg.type) {
      case "session_ready":
        dispatch({ type: "SOCKET_READY", stage: msg.stage, expiresAt: msg.expires_at });
        break;
      case "ai_turn_start":
        audioQueueRef.current = startResponse(audioQueueRef.current, msg.response_id);
        dispatch({ type: "AI_TURN_START", responseId: msg.response_id });
        sendClientEvent("AI_STARTED_SPEAKING", { response_id: msg.response_id });
        break;
      case "ai_audio_sentence": {
        audioQueueRef.current = enqueue(audioQueueRef.current, msg.response_id, msg.text, msg.audio_url);
        dispatch({ type: "AI_SENTENCE", responseId: msg.response_id, text: msg.text });
        if (!isPlayingRef.current) playNext();
        break;
      }
      case "ai_turn_end":
        dispatch({ type: "AI_TURN_END", responseId: msg.response_id, stage: msg.stage, interrupted: msg.interrupted });
        break;
      case "transcript_final":
        if (msg.speaker === "candidate") sendClientEvent("TRANSCRIPT_FINAL", {});
        break;
      case "error":
        dispatch({ type: "ERROR", message: msg.message });
        break;
      case "session_ending":
        dispatch({ type: "END_START" });
        break;
      case "session_closed":
        manualEndRef.current = true;
        finalizeSession();
        break;
      default:
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playNext, sendClientEvent]);

  // --- Session lifecycle -----------------------------------------------------
  const connectWs = useCallback((sessionId, wsUrl) => {
    const ws = new WebSocket(wsUrlFor(wsUrl));
    wsRef.current = ws;
    ws.onmessage = handleServerMessage;
    ws.onopen = () => {
      if (stateRef.current.status === STATES.RECONNECTING) dispatch({ type: "CONNECTION_RESTORED" });
    };
    ws.onclose = () => {
      if (manualEndRef.current || stateRef.current.status === STATES.COMPLETED) return;
      const attempts = stateRef.current.reconnectAttempts;
      if (attempts >= RECONNECT_MAX_ATTEMPTS) {
        dispatch({ type: "CONNECTION_FAILED", message: "Live audio couldn't be restored. Continue with text mode." });
        dispatch({ type: "USE_TEXT_FALLBACK" });
        return;
      }
      dispatch({ type: "CONNECTION_LOST" });
      const delay = RECONNECT_BASE_DELAY_MS * 2 ** attempts;
      reconnectTimerRef.current = setTimeout(() => connectWs(sessionId, wsUrl), delay);
    };
    ws.onerror = () => {
      // onclose fires right after in browsers - reconnect logic lives there.
    };
  }, [handleServerMessage]);

  const start = useCallback(async ({ role, interviewType, difficulty, style, durationSecs, voiceMode = true }) => {
    dispatch({ type: "CONNECT_START" });
    manualEndRef.current = false;
    try {
      const data = await apiPost("/live-interview/sessions", {
        role, interview_type: interviewType, difficulty, style, duration_secs: durationSecs,
      });
      sessionIdRef.current = data.session_id;
      configRef.current = { ...data.config, voice_mode: voiceMode };
      dispatch({ type: "SESSION_CREATED", sessionId: data.session_id });
      connectWs(data.session_id, data.ws_url);
      if (voiceMode) await setupMicAndVad();
      else dispatch({ type: "USE_TEXT_FALLBACK" });
    } catch (err) {
      dispatch({ type: "ERROR", message: err instanceof ApiError ? err.message : "Couldn't start the live interview." });
    }
  }, [connectWs, setupMicAndVad]);

  const sendText = useCallback((text) => {
    const clean = (text || "").trim();
    if (!clean || !canAcceptInput(stateRef.current.status)) return;
    dispatch({ type: "CANDIDATE_FINAL", text: clean });
    sendRaw({ type: "text_answer", text: clean });
  }, [sendRaw]);

  const sendControl = useCallback((action) => {
    if (!canAcceptInput(stateRef.current.status)) return;
    sendRaw({ type: "control", action });
  }, [sendRaw]);

  const toggleMute = useCallback(() => {
    dispatch({ type: "TOGGLE_MIC_MUTE" });
  }, []);

  // Without headphones, the AI's own speech comes back out of the
  // speakers and straight into the same open mic - browser echo
  // cancellation (see the getUserMedia constraints above) helps but can't
  // fully cancel real acoustic (speaker-to-mic-through-air) echo, which VAD
  // then mistakes for the candidate talking, transcribes, and feeds back
  // into the interview as if it were a real answer (a feedback loop). The
  // reliable fix is to stop *capturing* mic audio while the AI is the one
  // making sound - this trades automatic mid-sentence barge-in for a
  // manual "tap to interrupt" affordance (see bargeIn/LiveInterview.jsx)
  // that re-opens the mic the instant the candidate wants to jump in,
  // which is both more reliable without dedicated audio hardware and still
  // satisfies "the candidate can interrupt the AI" without a fake always-
  // listening indicator that isn't actually usable in a speaker setup.
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const shouldCapture = !state.micMuted && state.status !== STATES.AI_SPEAKING;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = shouldCapture;
    });
  }, [state.status, state.micMuted]);

  const useTextFallback = useCallback(() => {
    dispatch({ type: "USE_TEXT_FALLBACK" });
    teardownMicAndVad();
  }, [teardownMicAndVad]);

  function finalizeSession() {
    teardownMicAndVad();
    const ws = wsRef.current;
    wsRef.current = null;
    try {
      ws?.close();
    } catch {
      // ignore
    }
  }

  const endInterview = useCallback(async () => {
    dispatch({ type: "END_START" });
    manualEndRef.current = true;
    sendRaw({ type: "control", action: "end" });
    finalizeSession();
    if (!sessionIdRef.current) return;
    dispatch({ type: "EVALUATING" });
    try {
      const report = await apiPost(`/live-interview/sessions/${sessionIdRef.current}/end`, { reason: "ended_by_candidate" });
      dispatch({ type: "COMPLETED", report });
    } catch (err) {
      dispatch({ type: "ERROR", message: err instanceof ApiError ? err.message : "Couldn't finish evaluating the interview." });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendRaw]);

  const reset = useCallback(() => {
    finalizeSession();
    sessionIdRef.current = null;
    configRef.current = null;
    audioQueueRef.current = createAudioQueueState();
    dispatch({ type: "RESET" });
  }, []);

  // Full cleanup on unmount - no leaks, no zombie playback after navigating away.
  useEffect(() => () => {
    manualEndRef.current = true;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    teardownMicAndVad();
    const ws = wsRef.current;
    wsRef.current = null;
    try {
      ws?.close();
    } catch {
      // ignore
    }
    const el = playerElRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    analyser: analyserRef,
    setAudioElement,
    onClipEnded: handleClipEnded,
    start,
    sendText,
    sendControl,
    toggleMute,
    useTextFallback,
    bargeIn,
    endInterview,
    reset,
  };
}
