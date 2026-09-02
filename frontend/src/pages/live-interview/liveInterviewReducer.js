// Explicit state machine for the Live AI Interview screen — a useReducer
// instead of scattered `isX` booleans (multiple flags like `connecting`,
// `aiSpeaking`, `listening` can't represent invalid combinations away from
// each other; a single named state can). Kept as a plain, framework-free
// module (no React imports) so it's directly unit-testable without
// rendering anything — see liveInterviewReducer.test.js.

export const STATES = Object.freeze({
  IDLE: "IDLE",
  CONNECTING: "CONNECTING",
  READY: "READY",
  AI_SPEAKING: "AI_SPEAKING",
  LISTENING: "LISTENING",
  PROCESSING: "PROCESSING",
  ENDING: "ENDING",
  EVALUATING: "EVALUATING",
  COMPLETED: "COMPLETED",
  ERROR: "ERROR",
  RECONNECTING: "RECONNECTING",
  MIC_PERMISSION_REQUIRED: "MIC_PERMISSION_REQUIRED",
  MICROPHONE_ERROR: "MICROPHONE_ERROR",
  CONNECTION_ERROR: "CONNECTION_ERROR",
});

export const initialLiveInterviewState = {
  status: STATES.IDLE,
  sessionId: null,
  stage: null,
  transcript: [], // [{ speaker: "ai" | "candidate", text: string, final: boolean, id: string }]
  partialTranscript: "", // live-updating candidate speech-in-progress (text fallback typing, or a future streaming-STT hookup)
  activeResponseId: null,
  micMuted: false,
  textFallback: false, // true once mic/VAD is unavailable or the student opts into typed answers
  errorMessage: "",
  reconnectAttempts: 0,
  report: null,
  expiresAt: null,
  interruptCount: 0,
};

let _idCounter = 0;
function nextId() {
  _idCounter += 1;
  return `t${_idCounter}`;
}

export function liveInterviewReducer(state, action) {
  switch (action.type) {
    case "CONNECT_START":
      return { ...state, status: STATES.CONNECTING, errorMessage: "" };

    case "SESSION_CREATED":
      return { ...state, sessionId: action.sessionId, expiresAt: action.expiresAt ?? state.expiresAt };

    case "SOCKET_READY":
      return { ...state, status: STATES.READY, stage: action.stage ?? state.stage, expiresAt: action.expiresAt ?? state.expiresAt };

    case "AI_TURN_START":
      return { ...state, status: STATES.AI_SPEAKING, activeResponseId: action.responseId };

    case "AI_SENTENCE": {
      // Append to (or create) the in-progress AI transcript entry for this
      // response_id — sentences for the same response accumulate into one
      // bubble instead of one bubble per sentence.
      const transcript = [...state.transcript];
      const last = transcript[transcript.length - 1];
      if (last && last.speaker === "ai" && last.responseId === action.responseId && !last.final) {
        transcript[transcript.length - 1] = { ...last, text: `${last.text} ${action.text}`.trim() };
      } else {
        transcript.push({ id: nextId(), speaker: "ai", text: action.text, final: false, responseId: action.responseId });
      }
      return { ...state, transcript };
    }

    case "AI_TURN_END": {
      const transcript = state.transcript.map((t) =>
        t.speaker === "ai" && t.responseId === action.responseId ? { ...t, final: true } : t
      );
      return {
        ...state,
        transcript,
        status: state.textFallback ? STATES.READY : STATES.LISTENING,
        stage: action.stage ?? state.stage,
        activeResponseId: null,
        interruptCount: action.interrupted ? state.interruptCount + 1 : state.interruptCount,
      };
    }

    case "BARGE_IN":
      // Candidate started talking while the AI was still speaking — client
      // must already have stopped local audio playback BEFORE this action
      // is dispatched (see useLiveInterviewSession); this just updates the
      // state machine to reflect it and mark the interrupted AI bubble final.
      return {
        ...state,
        status: STATES.LISTENING,
        transcript: state.transcript.map((t) =>
          t.speaker === "ai" && t.responseId === state.activeResponseId ? { ...t, final: true, interrupted: true } : t
        ),
      };

    case "CANDIDATE_PARTIAL":
      return { ...state, partialTranscript: action.text };

    case "CANDIDATE_FINAL": {
      const transcript = [...state.transcript, { id: nextId(), speaker: "candidate", text: action.text, final: true }];
      return { ...state, transcript, partialTranscript: "", status: STATES.PROCESSING };
    }

    case "TOGGLE_MIC_MUTE":
      return { ...state, micMuted: !state.micMuted };

    case "USE_TEXT_FALLBACK":
      return { ...state, textFallback: true, status: state.status === STATES.MIC_PERMISSION_REQUIRED || state.status === STATES.MICROPHONE_ERROR ? STATES.READY : state.status };

    case "MIC_PERMISSION_REQUIRED":
      return { ...state, status: STATES.MIC_PERMISSION_REQUIRED };

    case "MICROPHONE_ERROR":
      return { ...state, status: STATES.MICROPHONE_ERROR, errorMessage: action.message || "Microphone error." };

    case "CONNECTION_LOST":
      return { ...state, status: STATES.RECONNECTING, reconnectAttempts: state.reconnectAttempts + 1 };

    case "CONNECTION_RESTORED":
      return { ...state, status: STATES.READY, reconnectAttempts: 0 };

    case "CONNECTION_FAILED":
      return { ...state, status: STATES.CONNECTION_ERROR, errorMessage: action.message || "Live connection could not be restored." };

    case "END_START":
      return { ...state, status: STATES.ENDING };

    case "EVALUATING":
      return { ...state, status: STATES.EVALUATING };

    case "COMPLETED":
      return { ...state, status: STATES.COMPLETED, report: action.report };

    case "ERROR":
      return { ...state, status: STATES.ERROR, errorMessage: action.message || "Something went wrong." };

    case "RESET":
      return { ...initialLiveInterviewState };

    default:
      return state;
  }
}

/** Pure helper: can the candidate currently barge in (i.e. is the AI the
 * one making sound right now)? Extracted so the VAD callback and any tests
 * can check this without duplicating the status list. */
export function canBargeIn(status) {
  return status === STATES.AI_SPEAKING;
}

/** Pure helper: is it currently valid to accept a new candidate utterance
 * (voice or text)? Guards against sending input while the AI response is
 * still being generated for a previous turn — the "never two AI responses
 * in flight" rule has a client-side mirror here. */
export function canAcceptInput(status) {
  return status === STATES.READY || status === STATES.LISTENING;
}
