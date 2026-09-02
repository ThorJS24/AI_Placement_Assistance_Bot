import { describe, expect, it } from "vitest";
import {
  createAudioQueueState,
  startResponse,
  enqueue,
  peekNext,
  advance,
  interrupt,
  isDrained,
} from "./audioQueue.js";

describe("audioQueue", () => {
  it("plays clips back to back in arrival order", () => {
    let q = createAudioQueueState();
    q = startResponse(q, 1);
    q = enqueue(q, 1, "Hello.", "/a.mp3");
    q = enqueue(q, 1, "How are you?", "/b.mp3");

    expect(peekNext(q)).toEqual({ responseId: 1, text: "Hello.", url: "/a.mp3" });
    q = advance(q);
    expect(peekNext(q)).toEqual({ responseId: 1, text: "How are you?", url: "/b.mp3" });
    q = advance(q);
    expect(peekNext(q)).toBeNull();
    expect(isDrained(q)).toBe(true);
  });

  it("ignores clips for a response_id that isn't the current one (stale/late arrival)", () => {
    let q = createAudioQueueState();
    q = startResponse(q, 2);
    q = enqueue(q, 1, "Stale sentence.", "/stale.mp3"); // response 1 is not current
    expect(q.items).toHaveLength(0);
    q = enqueue(q, 2, "Current sentence.", "/cur.mp3");
    expect(q.items).toHaveLength(1);
  });

  it("starting a new response drops any leftover items from a previous one", () => {
    let q = createAudioQueueState();
    q = startResponse(q, 1);
    q = enqueue(q, 1, "First turn.", "/a.mp3");
    q = startResponse(q, 2);
    expect(q.items).toHaveLength(0);
    expect(q.currentResponseId).toBe(2);
  });

  it("interrupt truncates not-yet-played clips of the current response and blocks future ones", () => {
    let q = createAudioQueueState();
    q = startResponse(q, 1);
    q = enqueue(q, 1, "Played already.", "/a.mp3");
    q = advance(q); // simulate having already played clip 0
    q = enqueue(q, 1, "Not yet played.", "/b.mp3");

    q = interrupt(q, 1);
    expect(q.items).toHaveLength(1); // only the already-played (cursor=1) prefix remains
    expect(peekNext(q)).toBeNull();

    // A clip for the same (now-interrupted) response arriving late must never be queued.
    q = enqueue(q, 1, "Too late.", "/c.mp3");
    expect(q.items).toHaveLength(1);
  });

  it("interrupting a response that isn't current is a no-op on items, but still recorded", () => {
    let q = createAudioQueueState();
    q = startResponse(q, 2);
    q = enqueue(q, 2, "Current.", "/a.mp3");
    q = interrupt(q, 1); // some stale response_id, not the current one
    expect(q.items).toHaveLength(1);
    expect(q.interruptedResponseIds.has(1)).toBe(true);
  });

  it("isDrained is true on a fresh queue with nothing enqueued yet", () => {
    const q = createAudioQueueState();
    expect(isDrained(q)).toBe(true);
  });
});
