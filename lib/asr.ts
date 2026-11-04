import { sanitizeTestName } from './safety';

// Speech-to-text helpers for Muse Voice Transcribe. Pure code, no network: the one call to Meta lives in lib/muse.ts.
//
// AI transcribes, code decides: the transcript is only text. It goes through the same classifyVoiceQuestion keyword
// matcher as typed or browser-recognised speech, so a mis-heard word can at worst produce the fixed redirect line.

export const ASR_LANGUAGES = { en: 'English', te: 'Telugu', hi: 'Hindi', es: 'Spanish' } as const;
export type AsrLang = keyof typeof ASR_LANGUAGES;
export const isAsrLang = (v: unknown): v is AsrLang => typeof v === 'string' && Object.prototype.hasOwnProperty.call(ASR_LANGUAGES, v);

/** Hard ceiling on one spoken question: 20 s of 16 kHz mono 16-bit audio is about 640 KB. The page stops recording at 15 s. */
export const MAX_AUDIO_MS = 20000;
export const MAX_AUDIO_BYTES = 700_000;
const MIN_AUDIO_MS = 300;
export const MAX_KEYWORDS = 40;

/** The language the model should expect. Measured on Telugu clips: adding English to the bias turned "నా" into "Na" or "Now"; the model already handles English test names said inside a Telugu or Hindi sentence on its own. */
export const languageBiasFor = (lang: AsrLang): string[] => [ASR_LANGUAGES[lang]];

/** Test names from the report, to help the model spell "Hemoglobin" and "Creatinine". Names only, never values; the same names Muse already gets. */
export function cleanKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const k of raw) {
    if (typeof k !== 'string') continue;
    const name = sanitizeTestName(k);
    if (name.length >= 2 && !/\d{4,}/.test(name) && !out.includes(name)) out.push(name);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

export type WavCheck = { ok: true; sampleRate: number; ms: number } | { ok: false; error: string };

/** The endpoint takes only a RIFF/WAVE container of mono 16-bit PCM at 16 or 24 kHz. Anything else is refused before it is sent. */
export function checkWav(b: Uint8Array): WavCheck {
  const bad = (error: string): WavCheck => ({ ok: false, error });
  if (b.length > MAX_AUDIO_BYTES) return bad('That recording is too long. Please ask a shorter question.');
  if (b.length < 44) return bad('The recording was empty.');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return bad('The recording was not a WAV file.');
  let fmt: { format: number; channels: number; rate: number; bits: number } | null = null;
  let dataBytes = -1;
  for (let o = 12; o + 8 <= b.length;) {
    const id = tag(o), size = dv.getUint32(o + 4, true);
    if (id === 'fmt ' && o + 8 + 16 <= b.length) {
      fmt = { format: dv.getUint16(o + 8, true), channels: dv.getUint16(o + 10, true), rate: dv.getUint32(o + 12, true), bits: dv.getUint16(o + 22, true) };
    } else if (id === 'data') {
      dataBytes = Math.min(size, b.length - (o + 8));
      break;
    }
    o += 8 + size + (size % 2);
  }
  if (!fmt || dataBytes < 0) return bad('The recording was not a valid WAV file.');
  if (fmt.format !== 1 || fmt.channels !== 1 || fmt.bits !== 16 || (fmt.rate !== 16000 && fmt.rate !== 24000)) return bad('The recording must be mono 16-bit audio at 16 or 24 kHz.');
  const ms = Math.round((dataBytes / 2 / fmt.rate) * 1000);
  if (ms < MIN_AUDIO_MS) return bad('The recording was too short.');
  if (ms > MAX_AUDIO_MS) return bad('That recording is too long. Please ask a shorter question.');
  return { ok: true, sampleRate: fmt.rate, ms };
}

/** What the API returned, reduced to one short line of plain text (the voice question limit is 300 characters). */
export function cleanTranscript(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/<\|[^|]*\|>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}
