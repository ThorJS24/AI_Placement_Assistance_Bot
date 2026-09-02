import { describe, expect, it } from "vitest";
import {
  STATES,
  initialLiveInterviewState,
  liveInterviewReducer,
  canBargeIn,
  canAcceptInput,
} from "./liveInterviewReducer.js";

describe("liveInterviewReducer", () => {
  it("starts IDLE and moves to CONNECTING then READY", () => {
    let state = initialLiveInterviewState;
    state = liveInterviewReducer(state, { type: "CONNECT_START" });
    expect(state.status).toBe(STATES.CONNECTING);
    state = liveInterviewReducer(state, { type: "SOCKET_READY", stage: "opening", expiresAt: 123 });
    expect(state.status).toBe(STATES.READY);
    expect(state.stage).toBe("opening");
    expect(state.expiresAt).toBe(123);
  });

  it("AI_TURN_START moves to AI_SPEAKING and tracks the active response id", () => {
    const state = liveInterviewReducer(initialLiveInterviewState, { type: "AI_TURN_START", responseId: 1 });
    expect(state.status).toBe(STATES.AI_SPEAKING);
    expect(state.activeResponseId).toBe(1);
  });

  it("AI_SENTENCE accumulates multiple sentences of the same response into one transcript entry", () => {
    let state = liveInterviewReducer(initialLiveInterviewState, { type: "AI_TURN_START", responseId: 1 });
    state = liveInterviewReducer(state, { type: "AI_SENTENCE", responseId: 1, text: "Hello there." });
    state = liveInterviewReducer(state, { type: "AI_SENTENCE", responseId: 1, text: "Tell me about yourself." });
    expect(state.transcript).toHaveLength(1);
    expect(state.transcript[0].text).toBe("Hello there. Tell me about yourself.");
    expect(state.transcript[0].final).toBe(false);
  });

  it("AI_TURN_END finalizes the transcript entry and moves to LISTENING when not in text fallback", () => {
    let state = liveInterviewReducer(initialLiveInterviewState, { type: "AI_TURN_START", responseId: 1 });
    state = liveInterviewReducer(state, { type: "AI_SENTENCE", responseId: 1, text: "Hi." });
    state = liveInterviewReducer(state, { type: "AI_TURN_END", responseId: 1, stage: "background" });
    expect(state.status).toBe(STATES.LISTENING);
    expect(state.transcript[0].final).toBe(true);
    expect(state.activeResponseId).toBeNull();
    expect(state.stage).toBe("background");
  });

  it("AI_TURN_END moves to READY (not LISTENING) when text fallback is active", () => {
    let state = { ...initialLiveInterviewState, textFallback: true };
    state = liveInterviewReducer(state, { type: "AI_TURN_START", responseId: 1 });
    state = liveInterviewReducer(state, { type: "AI_TURN_END", responseId: 1 });
    expect(state.status).toBe(STATES.READY);
  });

  it("AI_TURN_END with interrupted:true increments interruptCount", () => {
    let state = liveInterviewReducer(initialLiveInterviewState, { type: "AI_TURN_START", responseId: 1 });
    state = liveInterviewReducer(state, { type: "AI_TURN_END", responseId: 1, interrupted: true });
    expect(state.interruptCount).toBe(1);
  });

  it("BARGE_IN moves to LISTENING and marks the active AI bubble interrupted+final", () => {
    let state = liveInterviewReducer(initialLiveInterviewState, { type: "AI_TURN_START", responseId: 1 });
    state = liveInterviewReducer(state, { type: "AI_SENTENCE", responseId: 1, text: "Let's talk about" });
    state = liveInterviewReducer(state, { type: "BARGE_IN" });
    expect(state.status).toBe(STATES.LISTENING);
    expect(state.transcript[0].final).toBe(true);
    expect(state.transcript[0].interrupted).toBe(true);
  });

  it("CANDIDATE_FINAL appends a candidate transcript entry and moves to PROCESSING", () => {
    const state = liveInterviewReducer(initialLiveInterviewState, { type: "CANDIDATE_FINAL", text: "I have 2 years of experience." });
    expect(state.status).toBe(STATES.PROCESSING);
    expect(state.transcript).toHaveLength(1);
    expect(state.transcript[0].speaker).toBe("candidate");
    expect(state.partialTranscript).toBe("");
  });

  it("TOGGLE_MIC_MUTE flips micMuted", () => {
    let state = liveInterviewReducer(initialLiveInterviewState, { type: "TOGGLE_MIC_MUTE" });
    expect(state.micMuted).toBe(true);
    state = liveInterviewReducer(state, { type: "TOGGLE_MIC_MUTE" });
    expect(state.micMuted).toBe(false);
  });

  it("USE_TEXT_FALLBACK recovers from MIC_PERMISSION_REQUIRED into READY", () => {
    let state = liveInterviewReducer(initialLiveInterviewState, { type: "MIC_PERMISSION_REQUIRED" });
    expect(state.status).toBe(STATES.MIC_PERMISSION_REQUIRED);
    state = liveInterviewReducer(state, { type: "USE_TEXT_FALLBACK" });
    expect(state.status).toBe(STATES.READY);
    expect(state.textFallback).toBe(true);
  });

  it("CONNECTION_LOST/RESTORED/FAILED transitions", () => {
    let state = { ...initialLiveInterviewState, status: STATES.READY };
    state = liveInterviewReducer(state, { type: "CONNECTION_LOST" });
    expect(state.status).toBe(STATES.RECONNECTING);
    expect(state.reconnectAttempts).toBe(1);
    state = liveInterviewReducer(state, { type: "CONNECTION_RESTORED" });
    expect(state.status).toBe(STATES.READY);
    expect(state.reconnectAttempts).toBe(0);

    state = liveInterviewReducer(state, { type: "CONNECTION_LOST" });
    state = liveInterviewReducer(state, { type: "CONNECTION_FAILED", message: "gave up" });
    expect(state.status).toBe(STATES.CONNECTION_ERROR);
    expect(state.errorMessage).toBe("gave up");
  });

  it("END_START -> EVALUATING -> COMPLETED carries the report", () => {
    let state = liveInterviewReducer(initialLiveInterviewState, { type: "END_START" });
    expect(state.status).toBe(STATES.ENDING);
    state = liveInterviewReducer(state, { type: "EVALUATING" });
    expect(state.status).toBe(STATES.EVALUATING);
    state = liveInterviewReducer(state, { type: "COMPLETED", report: { overall_score: 80 } });
    expect(state.status).toBe(STATES.COMPLETED);
    expect(state.report.overall_score).toBe(80);
  });

  it("RESET returns to the exact initial state", () => {
    let state = liveInterviewReducer(initialLiveInterviewState, { type: "CONNECT_START" });
    state = liveInterviewReducer(state, { type: "RESET" });
    expect(state).toEqual(initialLiveInterviewState);
  });

  it("unknown action types are a no-op", () => {
    const state = liveInterviewReducer(initialLiveInterviewState, { type: "NOT_A_REAL_ACTION" });
    expect(state).toBe(initialLiveInterviewState);
  });
});

describe("canBargeIn / canAcceptInput", () => {
  it("barge-in is only possible while the AI is speaking", () => {
    expect(canBargeIn(STATES.AI_SPEAKING)).toBe(true);
    expect(canBargeIn(STATES.LISTENING)).toBe(false);
    expect(canBargeIn(STATES.PROCESSING)).toBe(false);
  });

  it("input is only accepted in READY or LISTENING", () => {
    expect(canAcceptInput(STATES.READY)).toBe(true);
    expect(canAcceptInput(STATES.LISTENING)).toBe(true);
    expect(canAcceptInput(STATES.AI_SPEAKING)).toBe(false);
    expect(canAcceptInput(STATES.PROCESSING)).toBe(false);
  });
});
