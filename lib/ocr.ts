import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { hasNumberToken } from './verify';
import type { ImageSourceBox } from './types';

// Where is a result on a photo? Not the language model's guess: OCR finds every printed word and its exact
// pixel box, and plain code matches each row to one line. A row is highlighted only when exactly one line
// carries both its test name and its value; otherwise it gets no highlight, never a wrong one.

export interface OcrWord { text: string; x0: number; y0: number; x1: number; y1: number }
export interface OcrLine { text: string; box: ImageSourceBox }
type RowKey = { test_name: string; value: number; unit?: string; ref_low: number | null; ref_high: number | null };

// --- image header facts (no image library needed) -----------------------------------------------

export interface ImageInfo { width: number; height: number; /** EXIF orientation, 1 = upright. */ orientation: number }

function jpegOrientation(buf: Buffer, app1Start: number, app1End: number): number {
  // APP1 "Exif\0\0" then a TIFF header; orientation is tag 0x0112 in the first IFD.
  const t = app1Start + 6;
  if (app1End - t < 8) return 1;
  const little = buf.toString('latin1', t, t + 2) === 'II';
  const u16 = (o: number) => (little ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o: number) => (little ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const ifd = t + u32(t + 4);
  if (ifd + 2 > app1End) return 1;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > app1End) break;
    if (u16(e) === 0x0112) return u16(e + 8);
  }
  return 1;
}

export function imageInfo(buf: Buffer): ImageInfo | null {
  try {
    if (buf.length > 24 && buf.subarray(1, 4).toString('latin1') === 'PNG') {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), orientation: 1 };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let o = 2, orientation = 1;
      while (o + 4 < buf.length) {
        if (buf[o] !== 0xff) { o++; continue; }
        const marker = buf[o + 1] as number;
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
        const len = buf.readUInt16BE(o + 2);
        if (marker === 0xe1 && buf.toString('latin1', o + 4, o + 8) === 'Exif') orientation = jpegOrientation(buf, o + 4, o + 2 + len);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: buf.readUInt16BE(o + 5), width: buf.readUInt16BE(o + 7), orientation };
        }
        o += 2 + len;
      }
      return null;
    }
    if (buf.length > 30 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
      const kind = buf.toString('latin1', 12, 16);
      if (kind === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, orientation: 1 };
      if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, orientation: 1 }; }
      if (kind === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1, orientation: 1 };
    }
  } catch { /* truncated or odd file: no facts */ }
  return null;
}

// --- words to lines ------------------------------------------------------------------------------

/** Groups OCR words that share a baseline into reading-order lines, like the PDF reader does for text items. */
export function groupWordsIntoLines(words: OcrWord[], width: number, height: number): OcrLine[] {
  const ok = words.filter((w) => w.text.trim() && w.x1 > w.x0 && w.y1 > w.y0 && w.x1 <= width + 2 && w.y1 <= height + 2);
  if (ok.length === 0) return [];
  const heights = ok.map((w) => w.y1 - w.y0).sort((a, b) => a - b);
  const tolerance = 0.5 * (heights[Math.floor(heights.length / 2)] as number);
  const sorted = [...ok].sort((a, b) => a.y0 + a.y1 - (b.y0 + b.y1));
  const lines: { cy: number; words: OcrWord[] }[] = [];
  for (const w of sorted) {
    const cy = (w.y0 + w.y1) / 2;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.cy - cy) <= tolerance) { last.words.push(w); last.cy = last.words.reduce((s, x) => s + (x.y0 + x.y1) / 2, 0) / last.words.length; }
    else lines.push({ cy, words: [w] });
  }
  const pad = 0.003;
  return lines.map((l) => {
    const ws = [...l.words].sort((a, b) => a.x0 - b.x0);
    const x0 = Math.min(...ws.map((w) => w.x0)), x1 = Math.max(...ws.map((w) => w.x1));
    const y0 = Math.min(...ws.map((w) => w.y0)), y1 = Math.max(...ws.map((w) => w.y1));
    const left = Math.max(0, x0 / width - pad), top = Math.max(0, y0 / height - pad);
    const right = Math.min(1, x1 / width + pad), bottom = Math.min(1, y1 / height + pad);
    const r = (n: number) => Math.round(n * 10000) / 10000;
    return { text: ws.map((w) => w.text).join(' '), box: { x: r(left), y: r(top), width: r(right - left), height: r(bottom - top) } };
  });
}

// --- matching a row to one line ------------------------------------------------------------------

const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Smallest edit distance between `needle` and any part of `hay` (Sellers). */
function bestSubstringDistance(hay: string, needle: string): number {
  if (needle.length === 0) return 0;
  let prev = Array.from({ length: needle.length + 1 }, (_, i) => i);
  let best = prev[needle.length] as number;
  for (let j = 1; j <= hay.length; j++) {
    const cur = [0];
    for (let i = 1; i <= needle.length; i++) {
      cur[i] = Math.min((prev[i] as number) + 1, (cur[i - 1] as number) + 1, (prev[i - 1] as number) + (hay[j - 1] === needle[i - 1] ? 0 : 1));
    }
    best = Math.min(best, cur[needle.length] as number);
    prev = cur;
  }
  return best;
}

const carriesBounds = (row: RowKey, text: string) =>
  (row.ref_low === null || hasNumberToken(text, row.ref_low)) && (row.ref_high === null || hasNumberToken(text, row.ref_high));

/**
 * The box of the single line that shows this row, or null. A line qualifies when it holds the test name
 * (exactly, or within a typo or two) and the row's value as a whole number token. If exactly one line
 * qualifies it is used; if several do, the printed range bounds may break the tie; otherwise: no answer.
 */
export function matchRowToLine(row: RowKey, lines: OcrLine[]): ImageSourceBox | null {
  const name = alnum(row.test_name.replace(/\s*\(\d+\)$/, ''));
  if (name.length < 2) return null;
  const withValue = lines.filter((l) => hasNumberToken(l.text.replace(/[–—−]/g, '-'), row.value));
  const tolerance = name.length >= 12 ? 2 : name.length >= 6 ? 1 : 0;
  const pick = (cands: OcrLine[]): ImageSourceBox | null => {
    if (cands.length === 1) return (cands[0] as OcrLine).box;
    if (cands.length > 1) {
      const tied = cands.filter((l) => carriesBounds(row, l.text.replace(/[–—−]/g, '-')));
      if (tied.length === 1) return (tied[0] as OcrLine).box;
    }
    return null;
  };
  const exact = withValue.filter((l) => alnum(l.text).includes(name));
  if (exact.length > 0) return pick(exact);
  return pick(withValue.filter((l) => bestSubstringDistance(alnum(l.text), name) <= tolerance));
}

// --- OCR itself (Tesseract, running inside this server; the photo goes nowhere else) -------------

type Worker = { recognize: (img: Buffer, opts?: object, out?: object) => Promise<{ data: { blocks?: { paragraphs: { lines: { words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] }[] } }>; terminate: () => Promise<unknown>; setParameters: (p: object) => Promise<unknown> };
const g = globalThis as { __labOcrWorker?: Promise<Worker>; __labOcrChain?: Promise<unknown> };
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 30000;

const langPath = () => join(process.cwd(), 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int');

function worker(): Promise<Worker> {
  g.__labOcrWorker ??= (async () => {
    // A missing language file makes the engine throw from inside its thread, which would take the whole server down. Check first.
    if (!existsSync(join(langPath(), 'eng.traineddata.gz'))) throw new Error('OCR language data not found');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createWorker, PSM } = require('tesseract.js');
    const w = await createWorker('eng', 1, { langPath: langPath(), cacheMethod: 'none' }) as Worker;
    // Sparse text keeps table cells that sit far apart from being merged or dropped.
    await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    return w;
  })();
  return g.__labOcrWorker;
}

async function recognizeWords(buffer: Buffer): Promise<OcrWord[]> {
  const w = await worker();
  const { data } = await w.recognize(buffer, {}, { blocks: true });
  return (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words.map((x) => ({ text: x.text, x0: x.bbox.x0, y0: x.bbox.y0, x1: x.bbox.x1, y1: x.bbox.y1 })))));
}

/**
 * Lines of text on the photo with their boxes, or [] when the photo cannot be located safely. Never throws:
 * a photo without citations is still a fully readable report.
 */
export async function ocrLines(buffer: Buffer): Promise<OcrLine[]> {
  const info = imageInfo(buffer);
  // Stored rotation is not applied by the OCR engine, so boxes would not line up with what the browser shows.
  if (!info || info.orientation !== 1 || info.width < 50 || info.height < 50) return [];
  const job = (g.__labOcrChain ?? Promise.resolve()).then(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const words = await Promise.race([
        recognizeWords(buffer),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('OCR timed out')), OCR_TIMEOUT_MS); }),
      ]);
      return groupWordsIntoLines(words, info.width, info.height);
    } catch (e) {
      console.error('OCR failed:', e instanceof Error ? e.message : e);
      // A stuck or broken worker must not poison later uploads.
      const stale = g.__labOcrWorker; g.__labOcrWorker = undefined;
      void stale?.then((w) => w.terminate()).catch(() => {});
      return [] as OcrLine[];
    } finally { if (timer) clearTimeout(timer); }
  });
  g.__labOcrChain = job.catch(() => undefined);
  return job;
}
