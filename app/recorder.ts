// Records one spoken question from the microphone and returns it as a mono 16-bit 16 kHz WAV, the format Muse Voice Transcribe takes.
// Nothing is stored: the audio exists in memory until it is sent to /api/transcribe, then it is dropped.

const TARGET_RATE = 16000;
const MAX_MS = 15000;          // a question never needs longer
const NO_SPEECH_MS = 6000;     // give up if nobody starts talking
const END_SILENCE_MS = 1400;   // this long a pause after speech ends the question
const SPEECH_RMS = 0.012;      // level (0 to 1) that counts as talking

export const canRecord = (): boolean =>
  typeof window !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && Boolean(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

export interface Recording { wav: Blob | null; heardSpeech: boolean }
export interface Recorder {
  /** Ends the recording now (the mic button, or the page cleaning up). Safe to call more than once. */
  stop(): void;
  /** Resolves once recording ended for any reason: stop(), a pause after speaking, silence, or the time limit. */
  done: Promise<Recording>;
}

/** Throws the browser's own error (NotAllowedError when the microphone is blocked). */
export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  const startedAt = Date.now();
  let heardSpeech = false, lastSpeechAt = 0, finished = false;
  let finish: (r: Recording) => void = () => {};
  const done = new Promise<Recording>((resolve) => { finish = resolve; });

  const end = () => {
    if (finished) return;
    finished = true;
    node.onaudioprocess = null;
    try { source.disconnect(); node.disconnect(); } catch { /* already disconnected */ }
    stream.getTracks().forEach((t) => t.stop());
    const rate = ctx.sampleRate;
    void ctx.close().catch(() => {});
    const total = chunks.reduce((n, c) => n + c.length, 0);
    if (!heardSpeech || total === 0) { finish({ wav: null, heardSpeech }); return; }
    const all = new Float32Array(total);
    let at = 0;
    for (const c of chunks) { all.set(c, at); at += c.length; }
    finish({ wav: encodeWav(downsample(all, rate, TARGET_RATE), TARGET_RATE), heardSpeech });
  };

  node.onaudioprocess = (e) => {
    if (finished) return;
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!;
    const now = Date.now();
    if (Math.sqrt(sum / input.length) > SPEECH_RMS) { heardSpeech = true; lastSpeechAt = now; }
    if (now - startedAt >= MAX_MS) end();
    else if (heardSpeech && now - lastSpeechAt >= END_SILENCE_MS) end();
    else if (!heardSpeech && now - startedAt >= NO_SPEECH_MS) end();
  };
  source.connect(node);
  node.connect(ctx.destination); // the node must be connected to run in every browser; it writes silence
  return { stop: end, done };
}

/** Average-pools to the target rate. Fine for speech; the endpoint only needs 16 kHz. */
function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = a; j < b; j++) s += input[j]!;
    out[i] = b > a ? s / (b - a) : 0;
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
