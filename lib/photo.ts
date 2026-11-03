import { detectPhi, nerAvailable, nerEnabled, overlaps, PHI_KIND_LABELS, type PhiSpan } from './ner';
import { scanImage, type OcrLine, type OcrScan, type OcrWord } from './ocr';
import { parseLabText } from './parse';
import { isIdentifyingLine, redactWithAudit, unexplainedWords } from './redact';
import type { RedactedPhoto } from './types';

// Layer 3 of the privacy design, done properly: a photo cannot be turned into rows without sending a picture to the
// vision model, so the picture is cleaned first, and the cleaning is checked.
//
//   1. Redraw the photo upright, on white, at a readable size (this also drops EXIF and GPS data).
//   2. Read every text box on it with the local OCR engine (nothing leaves this server).
//   3. Flag a box when the patterns (lib/redact.ts) say it holds an identifier. (An opt-in evaluation model, lib/ner.ts,
//      can add to this when PRIVACY_MODEL=1; it is off in the running app.) A line that is only a label ("Patient Name")
//      also takes the line under it, where the value sits.
//   4. Paint every flagged box solid black, on the pixels.
//   5. Read the painted picture again. If any flagged text can still be read, or the second read finds anything new,
//      paint again; if that does not settle in three rounds, refuse the photo. Refusing is always the safe answer.
//
// Only the painted picture is given to the vision model (it is the only thing typed `RedactedPhoto`).

export type PhotoRefusal =
  | 'no_ocr'        // the local reader could not run
  | 'no_model'      // PRIVACY_MODEL=1 was set (evaluation) but the model is not installed
  | 'model_failed'  // the privacy model failed while checking
  | 'too_little_text' // too few text boxes to be sure nothing is hiding in the picture
  | 'unsettled'     // painting did not remove everything within three rounds
  | 'bad_image';
export type PhotoResult =
  | { ok: true; photo: RedactedPhoto; lines: OcrLine[]; engine: 'patterns+model' | 'patterns' }
  | { ok: false; reason: PhotoRefusal };

export const PHOTO_REFUSAL_MESSAGES: Record<PhotoRefusal, string> = {
  no_ocr: 'The photo privacy check could not run, so the photo was not sent anywhere. Please upload a digital PDF instead, or try again.',
  no_model: 'The optional photo privacy model was switched on but is not installed on this server, so the photo was not sent anywhere. Please upload a digital PDF instead.',
  model_failed: 'The photo privacy check failed, so the photo was not sent anywhere. Please try again, or upload a digital PDF.',
  too_little_text: 'Not enough printed text could be read on this photo to check it for personal details, so it was not sent anywhere. Try a flatter, brighter, closer photo, or upload a digital PDF.',
  unsettled: 'Some personal details on this photo could not be covered reliably, so it was not sent anywhere. Crop your name and ID out of the photo and try again, or upload a digital PDF.',
  bad_image: 'That image could not be read. Please try another photo, or upload a digital PDF.',
};

const MAX_EDGE = 2400;
const MIN_BOXES = 3;
const ROUNDS = 3;

// sharp is native code: load it with a real dynamic import (same reason as lib/ocr.ts).
const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<{ default: Sharp }>;
interface Img {
  rotate: () => Img; flatten: (o: object) => Img; resize: (o: object) => Img; jpeg: (o: object) => Img; png: () => Img; ensureAlpha: () => Img;
  composite: (l: { input: Buffer; top: number; left: number; blend?: string }[]) => Img; toBuffer: () => Promise<Buffer>;
}
type Sharp = (input: Buffer) => Img;
const sharpOf = async () => (await dynamicImport('sharp')).default;

/** Upright, flat on white, bounded size, metadata stripped. */
async function normalise(raw: Buffer): Promise<Buffer> {
  const sharp = await sharpOf();
  return sharp(raw).rotate().flatten({ background: '#ffffff' }).resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 95 }).toBuffer();
}

interface Found { words: Set<OcrWord>; kinds: Set<string> }

/** OCR often drops the spaces in a table row ("Sodium138mmol/L135-145"). This puts them back at letter/digit joins. For checking only. */
export function respace(text: string): string {
  return text.replace(/(\p{L})(\d)/gu, '$1 $2').replace(/(\d)(\p{L})/gu, '$1 $2').replace(/\s+/g, ' ').trim();
}

/**
 * True for an ordinary result row read with its spaces dropped: once the spaces are back it parses as a result, every
 * word on it is the test name, its unit or result vocabulary, and no pattern fires on it. A pattern that fires only on
 * the glued form (a long letters-and-digits run that looks like an ID) is then a false alarm, not an identifier.
 */
export function isGluedResultRow(text: string): boolean {
  const spaced = respace(text);
  if (spaced === text.trim() || redactWithAudit(spaced).removed.length > 0) return false;
  const row = parseLabText(spaced)[0];
  return !!row && unexplainedWords(spaced, row).length === 0;
}

/** A label with nothing after it ("Patient Name", "MRN:"), whose value is on the line below. "Collected: 21/09/2026" is not. */
export function labelOnly(text: string): boolean {
  const i = text.lastIndexOf(':');
  if (i >= 0) return text.slice(i + 1).trim() === '';
  return !/\d/.test(text) && text.trim().split(/\s+/).length <= 3;
}

/** Offsets of each word inside `line.text` (words are joined with one space, as lib/ocr.ts builds the line). */
function wordOffsets(line: OcrLine): { word: OcrWord; start: number; end: number }[] {
  let pos = 0;
  return (line.words ?? []).map((word) => { const start = pos; pos += word.text.length + 1; return { word, start, end: start + word.text.length }; });
}

/** Which text boxes on this scan hold an identifier. Throws only if the privacy model is needed and fails. */
async function flag(lines: OcrLine[], useModel: boolean): Promise<Found> {
  const found: Found = { words: new Set(), kinds: new Set() };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as OcrLine;
    const boxes = wordOffsets(line);
    if (boxes.length === 0) continue;
    const addAll = (kind: string) => { for (const b of boxes) found.words.add(b.word); found.kinds.add(kind); };

    // Patterns. A label line takes every box in it; a label with nothing after it also takes the line below.
    if (isIdentifyingLine(line.text)) {
      addAll('name or ID line');
      if (labelOnly(line.text)) {
        const next = lines[i + 1];
        if (next) { for (const w of next.words ?? []) found.words.add(w); }
      }
      continue;
    }
    const audit = redactWithAudit(line.text).removed;
    if (audit.length > 0 && !isGluedResultRow(line.text)) {
      const own = boxes.filter((b) => redactWithAudit(b.word.text).removed.length > 0);
      for (const b of own.length > 0 ? own : boxes) found.words.add(b.word);
      for (const r of audit) found.kinds.add(r.kind);
    }

    // The privacy model, with the line above as context so a label line and its value line are read together.
    if (useModel) {
      const prev = i > 0 ? (lines[i - 1] as OcrLine).text : '';
      const text = prev ? `${prev}\n${line.text}` : line.text;
      const offset = prev ? prev.length + 1 : 0;
      const spans: PhiSpan[] = (await detectPhi(text)).filter((s) => s.end > offset).map((s) => ({ ...s, start: Math.max(0, s.start - offset), end: s.end - offset }))
        .filter((s) => !((s.kind === 'id' || s.kind === 'phone') && isBareResultNumber(line.text.slice(s.start, s.end))));
      for (const b of boxes) {
        if (!overlaps(spans, b.start, b.end)) continue;
        found.words.add(b.word);
      }
      for (const s of spans) found.kinds.add(PHI_KIND_LABELS[s.kind]);
    }
  }
  return found;
}

/**
 * A short bare number ("3599", "15.6 H") that the model took for an ID. On a lab report that is a result in its box.
 * A real ID is labelled (the patterns catch those and the line under a bare label), or long (7+ digits), or mixes
 * letters with digits ("AC-993201"), and none of those match this.
 */
export function isBareResultNumber(s: string): boolean {
  const t = s.trim();
  return /^[<>≤≥]?\s*\d[\d.,]*\s*[A-Za-z]{0,2}$/.test(t) && t.replace(/\D/g, '').length <= 6;
}

const quadOf = (w: OcrWord): number[][] => (w.quad && w.quad.length >= 4 ? w.quad : [[w.x0, w.y0], [w.x1, w.y0], [w.x1, w.y1], [w.x0, w.y1]]);
const pts = (q: number[][]) => q.map((p) => `${(p[0] as number).toFixed(1)},${(p[1] as number).toFixed(1)}`).join(' ');

/**
 * What to black out for one flagged text box. The engine's boxes are tight around letter bodies (they miss ascenders
 * and descenders) and, on a tilted photo, can merge two lines into one oddly angled box. So two generous shapes are
 * painted: a rectangle in the text's own tilted frame, grown more above than below, and the axis-aligned bounds of
 * the box with a margin. `scale` widens both for a retry. Whatever this covers that belongs to an unflagged box is
 * restored afterwards (see paint), so a result on a neighbouring line is not lost.
 */
function polygonsFor(w: OcrWord, scale = 1): string[] {
  const q = quadOf(w);
  const P = (i: number) => q[i] as number[];
  const len = (dx: number, dy: number) => Math.hypot(dx, dy) || 1;
  const L = len(P(1)[0]! - P(0)[0]!, P(1)[1]! - P(0)[1]!), H = len(P(3)[0]! - P(0)[0]!, P(3)[1]! - P(0)[1]!);
  const ux = (P(1)[0]! - P(0)[0]!) / L, uy = (P(1)[1]! - P(0)[1]!) / L;
  const vx = -uy, vy = ux; // perpendicular to the text direction, pointing down the page
  const cx = q.reduce((t, p) => t + (p[0] as number), 0) / q.length, cy = q.reduce((t, p) => t + (p[1] as number), 0) / q.length;
  const up = H / 2 + 0.9 * H * scale, down = H / 2 + 0.7 * H * scale, hl = L / 2 + Math.max(8, 0.6 * H * scale);
  const corner = (su: number, sv: number) => [cx + ux * su * hl + vx * sv, cy + uy * su * hl + vy * sv];
  const rect = [corner(-1, -up), corner(1, -up), corner(1, down), corner(-1, down)];
  const m = Math.max(6, 0.35 * H * scale);
  const box = [[w.x0 - m, w.y0 - m], [w.x1 + m, w.y0 - m], [w.x1 + m, w.y1 + m], [w.x0 - m, w.y1 + m]];
  return [pts(rect), pts(box)];
}

/**
 * Paints black over `polys`, then puts the original pixels back inside `protect` (the tight boxes of text that is
 * not being painted). Result rows next to a flagged line therefore stay readable, while a flagged line is covered
 * by the generous shapes everywhere that is not someone else's text.
 */
async function paint(base: Buffer, width: number, height: number, polys: string[], protect: string[]): Promise<Buffer> {
  if (polys.length === 0) return base;
  const sharp = await sharpOf();
  const svg = (fill: string, shapes: string[], bg = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${bg}<g fill="${fill}">${shapes.map((p) => `<polygon points="${p}"/>`).join('')}</g></svg>`;
  let out = await sharp(base).composite([{ input: Buffer.from(svg('#000000', polys)), top: 0, left: 0 }]).png().toBuffer();
  if (protect.length > 0) {
    // The original picture, kept only where `protect` is white (the mask shape is the alpha channel).
    const keep = await sharp(base).ensureAlpha().composite([{ input: Buffer.from(svg('#ffffff', protect)), top: 0, left: 0, blend: 'dest-in' }]).png().toBuffer();
    out = await sharp(out).composite([{ input: keep, top: 0, left: 0 }]).png().toBuffer();
  }
  return sharp(out).jpeg({ quality: 92 }).toBuffer();
}

/** How much of the smaller box lies inside the other (0 to 1). */
function overlapShare(a: OcrWord, b: OcrWord): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
}

const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Cleans a photo for the vision model, or says why it cannot. Also returns the lines read from the ORIGINAL (unpainted)
 * photo, which the caller uses to place source citations; those lines stay on the server.
 */
export async function redactPhoto(raw: Buffer): Promise<PhotoResult> {
  // Patterns only, unless the opt-in evaluation model was switched on (PRIVACY_MODEL=1). Asked for but missing: refuse.
  let useModel = nerEnabled();
  if (useModel && !nerAvailable()) return { ok: false, reason: 'no_model' };

  let base: Buffer;
  try { base = await normalise(raw); } catch { return { ok: false, reason: 'bad_image' }; }
  const first: OcrScan | null = await scanImage(base);
  if (!first) return { ok: false, reason: 'no_ocr' };
  if (first.words.length < MIN_BOXES) return { ok: false, reason: 'too_little_text' };

  const run = async (lines: OcrLine[]): Promise<Found | 'failed'> => {
    try { return await flag(lines, useModel); } catch (e) {
      console.error('Privacy model failed:', e instanceof Error ? e.message : e);
      return 'failed'; // the model was explicitly switched on, so a failure is not silently skipped
    }
  };

  const firstFound = await run(first.lines);
  if (firstFound === 'failed') return { ok: false, reason: 'model_failed' };
  let found: Found = firstFound;
  const engine: 'patterns+model' | 'patterns' = useModel ? 'patterns+model' : 'patterns';
  const kinds = new Set(found.kinds);
  // Text that must not be readable afterwards (words of at least 4 letters or digits, squashed).
  const mustVanish = [...found.words].map((w) => squash(w.text)).filter((t) => t.length >= 4);
  // Text boxes that are not being painted keep their own pixels (see paint).
  const protect = first.words.filter((w) => !firstFound.words.has(w)).map((w) => pts(quadOf(w)));
  const polys = [...firstFound.words].flatMap((w) => polygonsFor(w));
  let regions = firstFound.words.size;

  let painted = await paint(base, first.width, first.height, polys, protect);
  for (let round = 1; round <= ROUNDS; round++) {
    // Nothing to cover and nothing to prove: a photo with no identifiers is sent as redrawn.
    if (mustVanish.length === 0 && polys.length === 0 && round === 1) {
      // Still read it once more through the checks below? The first scan already found nothing, so it is clean.
      break;
    }
    const again = await scanImage(painted);
    if (!again) return { ok: false, reason: 'no_ocr' };
    const joined = squash(again.lines.map((l) => l.text).join(' '));
    const leaked = mustVanish.filter((t) => joined.includes(t));
    const nextAll = await run(again.lines);
    if (nextAll === 'failed') return { ok: false, reason: 'model_failed' };
    // A box that sits where the first read found clean text was judged on a clean read, with its real context. A later
    // flag there is almost always the painted neighbours confusing the reader (glued digits, merged lines), so it is
    // not painted. What was flagged is still held to the strict "no longer readable" check above.
    const cleanBefore = first.words.filter((w) => !firstFound.words.has(w));
    const next: Found = { kinds: nextAll.kinds, words: new Set([...nextAll.words].filter((w) => !cleanBefore.some((c) => overlapShare(w, c) >= 0.5))) };
    if (leaked.length === 0 && next.words.size === 0) { found = next; break; }
    if (round === ROUNDS) return { ok: false, reason: 'unsettled' };
    for (const w of next.words) { polys.push(...polygonsFor(w)); mustVanish.push(squash(w.text)); regions++; }
    for (const k of next.kinds) kinds.add(k);
    // Text that is still readable although its box was painted: cover the original boxes with a wider margin.
    if (leaked.length > 0) {
      const flaggedFirst = new Set([...first.words].filter((w) => leaked.some((t) => squash(w.text).includes(t) || t.includes(squash(w.text)))));
      for (const w of flaggedFirst) polys.push(...polygonsFor(w, 1 + round));
    }
    painted = await paint(base, first.width, first.height, polys, protect);
  }

  const sharp = await sharpOf();
  const small = await sharp(painted).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 60 }).toBuffer();
  const photo = {
    buffer: painted, mime: 'image/jpeg', regions, kinds: [...kinds],
    preview: `data:image/jpeg;base64,${small.toString('base64')}`,
  } as unknown as RedactedPhoto;
  return { ok: true, photo, lines: first.lines, engine };
}
