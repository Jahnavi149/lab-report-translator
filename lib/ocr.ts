import type { ImageSourceBox } from './types';

// Where is a result on a photo? Not the language model's guess: a local OCR engine (PaddleOCR, run through ONNX
// inside this server) finds every printed text box and its exact pixel position, and plain code matches each row to one line. A row is highlighted only when exactly one line
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

/**
 * True if the number appears in the text as a whole number: not glued to other digits, a decimal point or a thousands
 * comma. Works on text with or without spaces, because PaddleOCR often joins a table row into one run
 * ("Hemoglobin11.2g/dL12.0-15.5"), where a word-boundary check would wrongly fail.
 */
export function hasNumberLoose(text: string, n: number): boolean {
  const forms = new Set([String(n), n.toFixed(1), n.toFixed(2)].filter((f) => Number(f) === n));
  return [...forms].some((f) => new RegExp(`(?<![\\d.,])${f.replace('.', '\\.')}(?!\\d|[.,]\\d)`).test(text));
}

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
  (row.ref_low === null || hasNumberLoose(text, row.ref_low)) && (row.ref_high === null || hasNumberLoose(text, row.ref_high));

const centreY = (l: OcrLine) => l.box.y + l.box.height / 2;
const unionBox = (ls: OcrLine[]): ImageSourceBox => {
  const x0 = Math.min(...ls.map((l) => l.box.x)), y0 = Math.min(...ls.map((l) => l.box.y));
  const x1 = Math.max(...ls.map((l) => l.box.x + l.box.width)), y1 = Math.max(...ls.map((l) => l.box.y + l.box.height));
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return { x: r(x0), y: r(y0), width: r(x1 - x0), height: r(y1 - y0) };
};
/** A box that holds only a result: the number, maybe a flag letter or a short unit ("24 L", "5.3", "4.53 mg/dL"). Never a name. */
const isValueOnly = (l: OcrLine, value: number) => hasNumberLoose(l.text, value) && l.text.replace(/[^A-Za-z]/g, '').length <= 6;

/**
 * The box that shows this row, or null. First the test name must identify exactly one line (exactly, or within a
 * typo or two). Then the row's value must be confirmed by layout, in one of two ways:
 *   - on the same line as the name ("Hemoglobin 11.2 g/dL 12.0 - 15.5"), or
 *   - alone in a box in the same horizontal band, to the side (patient-portal cards: name on the left, "24 L" on the right).
 * If the printed range sits on the line just below (a "Reference Range: 40-190" line) it is included in the highlight.
 * If more than one line qualifies, the printed range bounds may break the tie; otherwise: no answer. A missing
 * highlight is always better than a wrong one.
 */
export function matchRowToLine(row: RowKey, lines: OcrLine[]): ImageSourceBox | null {
  const name = alnum(row.test_name.replace(/\s*\(\d+\)$/, ''));
  if (name.length < 2) return null;
  const tolerance = name.length >= 12 ? 2 : name.length >= 6 ? 1 : 0;
  const exact = lines.filter((l) => alnum(l.text).includes(name));
  const named = exact.length > 0 ? exact : lines.filter((l) => bestSubstringDistance(alnum(l.text), name) <= tolerance);

  const confirmed: { line: OcrLine; box: ImageSourceBox; text: string }[] = [];
  for (const c of named) {
    const norm = (t: string) => t.replace(/[–—−]/g, '-');
    const below = lines
      .filter((l) => l !== c && l.box.y >= c.box.y + c.box.height * 0.5 && centreY(l) - centreY(c) <= c.box.height * 2.4)
      .sort((x, y) => x.box.y - y.box.y)
      .find((l) => /^ref/i.test(l.text.trim()) || [row.ref_low, row.ref_high].some((v) => v !== null && hasNumberLoose(norm(l.text), v)));
    const extra = below && !alnum(below.text).includes(name) ? [below] : [];
    if (hasNumberLoose(norm(c.text), row.value)) { confirmed.push({ line: c, box: unionBox([c, ...extra]), text: norm(`${c.text} ${extra[0]?.text ?? ''}`) }); continue; }
    // A side box counts only if (a) the name line has no result of its own (a number that is not part of the test
    // name), (b) the box starts to the right of the name, and (c) no other text sits between them in that band.
    const own = (c.text.match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => !row.test_name.includes(n));
    const inBand = (l: OcrLine) => l !== c && Math.abs(centreY(l) - centreY(c)) <= 0.75 * Math.max(l.box.height, c.box.height);
    const side = own.length > 0 ? [] : lines.filter((l) => inBand(l) && isValueOnly(l, row.value) && l.box.x > c.box.x && !lines.some((o) => inBand(o) && o !== l && !isValueOnly(o, row.value) && o.box.x > c.box.x && o.box.x < l.box.x));
    if (side.length === 1) confirmed.push({ line: c, box: unionBox([c, side[0] as OcrLine, ...extra]), text: norm(`${c.text} ${side[0]?.text} ${extra[0]?.text ?? ''}`) });
  }
  if (confirmed.length === 1) return (confirmed[0] as (typeof confirmed)[number]).box;
  if (confirmed.length > 1) {
    const tied = confirmed.filter((m) => carriesBounds(row, m.text));
    if (tied.length === 1) return (tied[0] as (typeof tied)[number]).box;
  }
  return null;
}

// --- OCR itself (PaddleOCR through ONNX, running inside this server; the photo goes nowhere else) ----------

type Engine = { detect: (image: { data: Buffer; width: number; height: number }) => Promise<{ texts: { text: string; mean?: number; box: number[][] }[] }> };
const g = globalThis as { __labOcrEngine?: Promise<Engine>; __labOcrChain?: Promise<unknown> };
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 30000;
/** Text the engine is less sure of than this is not used to place a highlight. */
const MIN_CONFIDENCE = 0.5;

// The engine is an ES module and ships native code; load it with a real dynamic import so neither the bundler nor
// the test transpiler rewrites it.
const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<{ default: { create: (o?: object) => Promise<Engine> } }>;

function engine(): Promise<Engine> {
  g.__labOcrEngine ??= (async () => (await dynamicImport('@gutenye/ocr-node')).default.create())();
  return g.__labOcrEngine;
}

/** Decodes the photo to raw pixels in memory. Nothing is written to disk. Transparent areas become white (a transparent PNG would otherwise be black text on black). */
async function decode(buffer: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  type Pipeline = { flatten: (o: object) => Pipeline; ensureAlpha: (a: number) => Pipeline; raw: () => Pipeline; toBuffer: (o: object) => Promise<{ data: Buffer; info: { width: number; height: number } }> };
  const sharp = (await dynamicImport('sharp') as unknown as { default: (b: Buffer) => Pipeline }).default;
  const { data, info } = await sharp(buffer).flatten({ background: '#ffffff' }).ensureAlpha(1).raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function recognizeWords(buffer: Buffer): Promise<OcrWord[]> {
  const [ocr, image] = await Promise.all([engine(), decode(buffer)]);
  const { texts } = await ocr.detect(image);
  return texts.filter((t) => t.text.trim() && (t.mean ?? 1) >= MIN_CONFIDENCE).map((t) => {
    const xs = t.box.map((pt) => pt[0] as number), ys = t.box.map((pt) => pt[1] as number);
    return { text: t.text.trim(), x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  });
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
      g.__labOcrEngine = undefined; // a broken engine must not poison later uploads
      return [] as OcrLine[];
    } finally { if (timer) clearTimeout(timer); }
  });
  g.__labOcrChain = job.catch(() => undefined);
  return job;
}
