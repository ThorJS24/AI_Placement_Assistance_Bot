// Thin wrapper around @ricky0123/vad-web's MicVAD — real, browser-side
// Voice Activity Detection (ONNX Silero VAD running via WASM, entirely
// client-side, zero server cost) used for both turn detection ("the
// candidate started answering") and barge-in ("the candidate started
// talking while the AI's audio is still playing").
//
// Asset wiring: MicVAD needs three kinds of runtime assets that Vite's
// bundler never sees (they're fetched by absolute URL at runtime, not
// imported as JS) — the Silero ONNX model, the onnxruntime-web WASM
// binary, and its AudioWorklet processor script. These are checked into
// frontend/public/vad/ (see that folder + vite.config.js's comment) so
// both `npm run dev` (served straight from public/) and the production
// build (Vite copies public/ into dist/ automatically) resolve them at
// the same /vad/ path with no separate build step required.
const ASSET_BASE_PATH = "/vad/";

let _vadModulePromise = null;
function loadVadModule() {
  if (!_vadModulePromise) {
    _vadModulePromise = import("@ricky0123/vad-web");
  }
  return _vadModulePromise;
}

/**
 * Starts a MicVAD instance on the given already-acquired MediaStream.
 * Deliberately takes a stream rather than acquiring its own, so the caller
 * (useLiveInterviewSession) can share ONE getUserMedia grant across the
 * whole interview and also feed the same stream into an AnalyserNode for
 * the audio-reactive visualization, instead of prompting for the
 * microphone twice or running two redundant capture pipelines.
 *
 * onSpeechStart fires the moment VAD detects the candidate began talking
 * (used for both "start listening" and "barge in" depending on the
 * current interview state — see the hook). onSpeechEnd fires with the
 * captured Float32Array audio for that utterance once VAD detects the
 * candidate stopped.
 */
export async function startVad(stream, { onSpeechStart, onSpeechEnd, onVadError }) {
  const vadModule = await loadVadModule();
  const vad = await vadModule.MicVAD.new({
    stream,
    baseAssetPath: ASSET_BASE_PATH,
    onnxWASMBasePath: ASSET_BASE_PATH,
    onSpeechStart: () => onSpeechStart?.(),
    onSpeechEnd: (audio) => onSpeechEnd?.(audio),
    onVADMisfire: () => {}, // a speech segment that turned out too short to count — not an error, just ignored
  });
  try {
    vad.start();
  } catch (err) {
    onVadError?.(err);
    throw err;
  }
  return vad;
}

export function stopVad(vad) {
  try {
    vad?.pause();
    vad?.destroy();
  } catch {
    // best-effort cleanup — nothing useful to do if teardown itself throws
  }
}

/** Encodes a Float32Array of mono 16kHz PCM samples (what MicVAD's
 * onSpeechEnd hands back) into a 16-bit PCM WAV Blob, matching what
 * core/stt.transcribe() on the backend already expects (the same shape
 * MockInterview.jsx's MediaRecorder-based flow sends, just built directly
 * from raw samples here since VAD gives us samples, not a container). */
export function float32ToWavBlob(float32Audio, sampleRate = 16000) {
  const numSamples = float32Audio.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, float32Audio[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Chrome/Safari/Firefox all restrict the FIRST programmatic `.play()` call
 * on a page to ones that happen synchronously inside a user-gesture event
 * handler (a click) — anything that only fires later, after an `await`
 * (session creation, WS connect, mic permission, LLM+TTS generation), is
 * "user activation" that has already expired by the time it runs, so the
 * very first AI response's audio silently fails to play (`.play()` rejects)
 * even though every later one works fine once the browser has seen ANY
 * successful play() on the element. Playing (and immediately pausing) one
 * silent sample synchronously inside the "Start live interview" click
 * handler "unlocks" that same <audio> element for every subsequent
 * programmatic play() for the rest of the session — call this directly
 * from the click handler, before any `await`.
 */
export function primeAudioPlayback(audioEl) {
  if (!audioEl) return;
  const url = URL.createObjectURL(float32ToWavBlob(new Float32Array(1)));
  audioEl.src = url;
  const done = () => URL.revokeObjectURL(url);
  audioEl.play().then(() => {
    audioEl.pause();
    done();
  }).catch(done);
}

/** base64-encodes a Blob for embedding in a WS JSON text frame — the
 * simplest reliable transport for a FastAPI `WebSocket` endpoint reading
 * JSON messages (see routers/live_interview.py's protocol docstring);
 * binary WS frames would be marginally more efficient but would require a
 * second receive path on the server for no real benefit at this audio
 * volume (short, VAD-segmented utterances, not continuous streaming). */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || "";
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
