// Pure sequencing logic for the AI's sentence-by-sentence audio playback
// queue — extracted out of the player component so it's directly
// unit-testable (see audioQueue.test.js) without a real <audio> element or
// browser. Mirrors the conceptual model MockInterview.jsx's LiveRunningPanel
// already uses (a growing array of {text, url} clips consumed in order),
// adapted for push-over-WebSocket instead of poll/stream-over-HTTP: clips
// for a response arrive one at a time as "ai_audio_sentence" events, and an
// "interrupt" can invalidate every clip for the CURRENTLY active response
// at any point, including ones not yet enqueued.

/** Creates a fresh queue state. One instance per session (not per turn) —
 * `responseId` scoping happens per-call, so stale clips from a
 * already-interrupted response are naturally ignored once a newer
 * response_id becomes current. */
export function createAudioQueueState() {
  return {
    items: [], // [{ responseId, text, url }]
    cursor: 0,
    currentResponseId: null, // the response_id this queue is currently playing/accepting clips for
    interruptedResponseIds: new Set(),
  };
}

/** A new AI turn started — clips for any OTHER response_id already in the
 * queue are dropped (they can only be stale leftovers). */
export function startResponse(state, responseId) {
  return { ...state, items: [], cursor: 0, currentResponseId: responseId };
}

/** A sentence clip arrived from the server. Silently ignored if it's for a
 * response_id that isn't the current one (a very-late clip for an
 * already-interrupted turn racing in after the interrupt was already
 * processed) or one already marked interrupted. */
export function enqueue(state, responseId, text, url) {
  if (responseId !== state.currentResponseId || state.interruptedResponseIds.has(responseId)) {
    return state;
  }
  return { ...state, items: [...state.items, { responseId, text, url }] };
}

/** Returns the next not-yet-played clip for the current response, or null
 * if the queue has been fully consumed so far (more may still arrive). */
export function peekNext(state) {
  if (state.cursor >= state.items.length) return null;
  return state.items[state.cursor];
}

/** Advances the cursor past the clip just finished playing (or skipped
 * because it had no audio_url — TTS unavailable for that sentence). */
export function advance(state) {
  return { ...state, cursor: state.cursor + 1 };
}

/** Barge-in: marks the given response_id as interrupted so any of its
 * clips still in flight (already enqueued but not yet played, or not yet
 * arrived) are never played — this is the queue-side half of "stop
 * playback first, before waiting for any server ack" the interrupt handler
 * performs; the caller is responsible for actually stopping the live
 * <audio>/AudioBufferSourceNode BEFORE calling this. */
export function interrupt(state, responseId) {
  return {
    ...state,
    interruptedResponseIds: new Set([...state.interruptedResponseIds, responseId]),
    items: state.currentResponseId === responseId ? state.items.slice(0, state.cursor) : state.items,
  };
}

/** Whether the queue for the current response is fully drained (nothing
 * left to play right now) — used to decide whether to move to LISTENING
 * or wait for more sentences of a still-streaming response. */
export function isDrained(state) {
  return state.cursor >= state.items.length;
}
