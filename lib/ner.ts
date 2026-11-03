import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// A trained clinical de-identification model, run inside this server (ONNX, int8). Patterns (lib/redact.ts) are exact
// for things with a shape: emails, phones, IDs after a label. They cannot tell "Maria Gonzalez Lopez" from a test
// name, or find a hospital address in free text. This model can: StanfordAIMI/stanford-deidentifier-base, trained on
// radiology and clinical notes for exactly this job (published F1 about 99 on the i2b2 benchmarks). Nothing is sent
// anywhere to run it. Patterns and the model are used together; either one is enough to flag something.
//
// The model is downloaded once by `npm run models` (scripts/fetch-models.mjs, pinned by SHA-256).

export type PhiKind = 'person' | 'place' | 'id' | 'phone' | 'date';
/** One identifier the model found. Offsets are into the text that was checked. The value itself is never stored here. */
export interface PhiSpan { start: number; end: number; kind: PhiKind; score: number }

/** Model label -> what it is. VENDOR (software or device makers) is not about a person, so it is not flagged. */
const KIND_OF: Record<string, PhiKind | undefined> = { PATIENT: 'person', HCW: 'person', HOSPITAL: 'place', ID: 'id', PHONE: 'phone', DATE: 'date' };
export const PHI_KIND_LABELS: Record<PhiKind, string> = { person: 'name', place: 'hospital or address', id: 'ID number', phone: 'phone number', date: 'date' };

/** A word counts when the model puts at least this much probability on "something other than O" (not an identifier). Lower = safer. */
const MIN_PHI_PROB = 0.4;
const WINDOW = 510; // BERT limit 512 minus [CLS] and [SEP]
const STRIDE = 384;
const MAX_CHARS = 120_000;
const TIMEOUT_MS = Number(process.env.NER_TIMEOUT_MS) || 20000;

const modelDir = () => process.env.NER_MODEL_DIR || join(process.cwd(), 'models', 'ner');
const MODEL_FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'model_int8.onnx'];

/** True when the model files are on disk. Callers that must not run without it check this first. */
export function nerAvailable(): boolean {
  return MODEL_FILES.every((f) => existsSync(join(modelDir(), f)));
}

// onnxruntime-node is native code and the tokenizer is an ES module: load both with a real dynamic import so neither
// the bundler nor the test transpiler rewrites them (same approach as lib/ocr.ts).
const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<Record<string, unknown>>;

interface Tok { tokenize: (s: string) => string[]; token_to_id: (t: string) => number | undefined }
interface OrtTensor { data: ArrayLike<number> }
interface OrtSession { inputNames: string[]; outputNames: string[]; run: (feeds: Record<string, unknown>) => Promise<Record<string, OrtTensor>> }
interface Ort { Tensor: new (type: string, data: BigInt64Array, dims: number[]) => unknown; InferenceSession: { create: (path: string, opts?: object) => Promise<OrtSession> } }
interface Engine { tok: Tok; ort: Ort; session: OrtSession; labels: string[]; cls: number; sep: number; unk: number }

const g = globalThis as { __labNer?: Promise<Engine>; __labNerChain?: Promise<unknown> };

async function load(): Promise<Engine> {
  const dir = modelDir();
  if (!nerAvailable()) throw new Error('Privacy model not found. Run: npm run models');
  const tokMod = (await dynamicImport('@huggingface/tokenizers')) as { Tokenizer: new (t: object, c: object) => Tok };
  const ortRaw = (await dynamicImport('onnxruntime-node')) as Record<string, unknown>;
  const ort = ((ortRaw.InferenceSession ? ortRaw : ortRaw.default) as unknown) as Ort;
  const tok = new tokMod.Tokenizer(JSON.parse(readFileSync(join(dir, 'tokenizer.json'), 'utf8')), JSON.parse(readFileSync(join(dir, 'tokenizer_config.json'), 'utf8')));
  const id2label = (JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')) as { id2label: Record<string, string> }).id2label;
  const labels = Object.keys(id2label).sort((a, b) => Number(a) - Number(b)).map((k) => id2label[k] as string);
  const session = await ort.InferenceSession.create(join(dir, 'model_int8.onnx'), { executionProviders: ['cpu'], logSeverityLevel: 3 });
  const cls = tok.token_to_id('[CLS]'), sep = tok.token_to_id('[SEP]'), unk = tok.token_to_id('[UNK]');
  if (cls === undefined || sep === undefined || unk === undefined) throw new Error('Privacy model tokenizer is missing special tokens');
  return { tok, ort, session, labels, cls, sep, unk };
}

function engine(): Promise<Engine> {
  g.__labNer ??= load();
  return g.__labNer;
}

interface Word { text: string; start: number; end: number }
/** Splits like BERT's basic tokenizer: runs of letters or digits, and each punctuation mark on its own. */
function splitWords(text: string): Word[] {
  return [...text.matchAll(/[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu)].map((m) => ({ text: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

/**
 * Runs the model over `text` and returns every identifier it finds, merged into spans. Long text is read in
 * overlapping windows, and each word keeps the prediction from the window where it sat furthest from an edge.
 * Throws if the model cannot run: callers decide whether that means "refuse" or "fall back to patterns".
 */
export async function detectPhi(text: string): Promise<PhiSpan[]> {
  if (text.trim() === '') return [];
  if (text.length > MAX_CHARS) throw new Error('Text too long for the privacy model');
  const job = (g.__labNerChain ?? Promise.resolve()).then(async () => {
    const e = await engine();
    const words = splitWords(text);
    const ids: number[] = [], owner: number[] = [];
    words.forEach((w, i) => {
      for (const piece of e.tok.tokenize(w.text)) { ids.push(e.tok.token_to_id(piece) ?? e.unk); owner.push(i); }
    });
    // Per word: probability of "not O" and which identifier label leads, from the best-placed window.
    const best: ({ margin: number; pPhi: number; label: string } | undefined)[] = words.map(() => undefined);
    for (let from = 0; from < ids.length || from === 0; from += STRIDE) {
      const to = Math.min(ids.length, from + WINDOW);
      const slice = ids.slice(from, to);
      const n = slice.length + 2;
      const t64 = (a: number[]) => new e.ort.Tensor('int64', BigInt64Array.from(a.map(BigInt)), [1, n]);
      const input = [e.cls, ...slice, e.sep];
      const out = await e.session.run({ input_ids: t64(input), attention_mask: t64(input.map(() => 1)), token_type_ids: t64(input.map(() => 0)) });
      const logits = (out[e.session.outputNames[0] as string] as OrtTensor).data;
      const K = e.labels.length;
      const oIndex = e.labels.indexOf('O');
      const seen = new Set<number>();
      for (let i = 0; i < slice.length; i++) {
        const wi = owner[from + i] as number;
        if (seen.has(wi)) continue; // the first word piece speaks for the word
        seen.add(wi);
        const base = (i + 1) * K;
        let mx = -Infinity;
        for (let k = 0; k < K; k++) mx = Math.max(mx, logits[base + k] as number);
        let sum = 0;
        const ex: number[] = [];
        for (let k = 0; k < K; k++) { const v = Math.exp((logits[base + k] as number) - mx); ex.push(v); sum += v; }
        let lead = -1, leadP = -1;
        for (let k = 0; k < K; k++) if (k !== oIndex && KIND_OF[e.labels[k] as string] && (ex[k] as number) > leadP) { lead = k; leadP = ex[k] as number; }
        const pPhi = lead < 0 ? 0 : ex.reduce((s, v, k) => (k !== oIndex && KIND_OF[e.labels[k] as string] ? s + v : s), 0) / sum;
        const margin = Math.min(i, slice.length - 1 - i);
        const cur = best[wi];
        if (!cur || margin > cur.margin) best[wi] = { margin, pPhi, label: lead < 0 ? 'O' : (e.labels[lead] as string) };
      }
      if (to >= ids.length) break;
    }
    // Merge neighbouring flagged words of the same kind (only whitespace or punctuation between them) into one span.
    const spans: PhiSpan[] = [];
    words.forEach((w, i) => {
      const b = best[i];
      const kind = b ? KIND_OF[b.label] : undefined;
      if (!b || !kind || b.pPhi < MIN_PHI_PROB) return;
      const last = spans[spans.length - 1];
      if (last && last.kind === kind && /^[\s.,/:;()'\-–@#]*$/.test(text.slice(last.end, w.start))) { last.end = w.end; last.score = Math.min(last.score, b.pPhi); }
      else spans.push({ start: w.start, end: w.end, kind, score: b.pPhi });
    });
    // The model reads a repeated reference range such as "70-99" as a date in long documents. Painting a range out
    // would destroy a result, so a date span must look like a date: a month name, a four-digit year, or d/m/y parts.
    return spans.filter((s) => s.kind !== 'date' || plausibleDate(text.slice(s.start, s.end)));
  });
  g.__labNerChain = job.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([job, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Privacy model timed out')), TIMEOUT_MS); })]);
  } catch (err) {
    g.__labNer = undefined; // a broken or stuck engine must not poison later requests
    throw err;
  } finally { if (timer) clearTimeout(timer); }
}

const MONTH = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\b/i;
export function plausibleDate(s: string): boolean {
  return MONTH.test(s) || /\b(19|20)\d{2}\b/.test(s) || /\d{1,2}\s*([/.\-])\s*\d{1,2}\s*\1\s*\d{2,4}/.test(s);
}

/** True if any span overlaps [start, end). */
export const overlaps = (spans: PhiSpan[], start: number, end: number) => spans.some((s) => s.start < end && s.end > start);
