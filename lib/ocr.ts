import { verdictAppears } from './flags';
import type { Flag, ImageSourceBox } from './types';

// Where is a result on a photo? Not the language model's guess: a local OCR engine (PaddleOCR, run through ONNX
// inside this server) finds every printed text box and its exact pixel position, and plain code matches each row to one line. A row is highlighted only when exactly one line
// carries both its test name and its value; otherwise it gets no highlight, never a wrong one.

/** x0..y1 is the box on the photo; f* is the same box after straightening the page (set when the photo is tilted). */
export interface OcrWord { text: string; x0: number; y0: number; x1: number; y1: number; fx0?: number; fy0?: number; fx1?: number; fy1?: number; /** The four corners the engine found (pixels), for painting a region out exactly. */ quad?: number[][] }
/** box = where to draw on the photo. flat = the same place on the straightened page, used only to judge layout (same row, left of, between). */
export interface OcrLine { text: string; box: ImageSourceBox; flat?: ImageSourceBox; /** The engine's own text boxes that make up this line, in reading order (joined with single spaces to make `text`). */ words?: OcrWord[] }
type RowKey = { test_name: string; value: number | null; unit?: string; ref_low: number | null; ref_high: number | null; flag?: Flag };

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
  // Layout is judged on the straightened page when there is one; the drawn box always comes from the photo itself.
  const fy0 = (w: OcrWord) => w.fy0 ?? w.y0, fy1 = (w: OcrWord) => w.fy1 ?? w.y1;
  const heights = ok.map((w) => fy1(w) - fy0(w)).sort((a, b) => a - b);
  const tolerance = 0.5 * (heights[Math.floor(heights.length / 2)] as number);
  const sorted = [...ok].sort((a, b) => fy0(a) + fy1(a) - (fy0(b) + fy1(b)));
  const lines: { cy: number; words: OcrWord[] }[] = [];
  for (const w of sorted) {
    const cy = (fy0(w) + fy1(w)) / 2;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.cy - cy) <= tolerance) { last.words.push(w); last.cy = last.words.reduce((s, x) => s + (fy0(x) + fy1(x)) / 2, 0) / last.words.length; }
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
    const tilted = ws.every((w) => w.fx0 !== undefined);
    const flat = tilted ? {
      x: r(Math.min(...ws.map((w) => w.fx0 as number)) / width), y: r(Math.min(...ws.map((w) => w.fy0 as number)) / height),
      width: r((Math.max(...ws.map((w) => w.fx1 as number)) - Math.min(...ws.map((w) => w.fx0 as number))) / width),
      height: r((Math.max(...ws.map((w) => w.fy1 as number)) - Math.min(...ws.map((w) => w.fy0 as number))) / height),
    } : undefined;
    return { text: ws.map((w) => w.text).join(' '), box: { x: r(left), y: r(top), width: r(right - left), height: r(bottom - top) }, ...(flat ? { flat } : {}), words: ws };
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

/** Layout box: the straightened one if the photo was tilted. */
const G = (l: OcrLine): ImageSourceBox => l.flat ?? l.box;
const centreX = (l: OcrLine) => G(l).x + G(l).width / 2;
const centreY = (l: OcrLine) => G(l).y + G(l).height / 2;
const unionBox = (ls: OcrLine[]): ImageSourceBox => {
  const x0 = Math.min(...ls.map((l) => l.box.x)), y0 = Math.min(...ls.map((l) => l.box.y));
  const x1 = Math.max(...ls.map((l) => l.box.x + l.box.width)), y1 = Math.max(...ls.map((l) => l.box.y + l.box.height));
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return { x: r(x0), y: r(y0), width: r(x1 - x0), height: r(y1 - y0) };
};
/** A box that holds only a result: the number, maybe a flag letter or a short unit ("24 L", "5.3", "4.53 mg/dL"). Never a name. */
const isValueOnly = (l: OcrLine, value: number) => hasNumberLoose(l.text, value) && l.text.replace(/[^A-Za-z]/g, '').length <= 6;

/**
 * A reference line that also carries the result ("Reference Range: 40-190 mcg/dL 24 L"): happens when OCR merges the
 * value box with the range line under a tilted card. The value must be the last number on the line and must not just
 * be one of the range bounds (a value of 190 against "40-190" proves nothing).
 */
export function valueEndsRangeLine(text: string, row: RowKey): boolean {
  if (row.value === null) return false;
  const nums = (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length < 2 || nums[nums.length - 1] !== row.value) return false;
  const asBound = [row.ref_low, row.ref_high].filter((b) => b === row.value).length;
  return nums.filter((n) => n === row.value).length > asBound;
}

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

  // Some portal cards print only a verdict beside the test name. In that case the explicit verdict text,
  // never its colour or graph position, is the evidence used to place the citation.
  if (row.value === null) {
    const marker = row.flag && row.flag !== 'Unknown' ? row.flag : null;
    if (!marker) return null;
    const matched: ImageSourceBox[] = [];
    for (const c of named) {
      if (verdictAppears(c.text, marker)) { matched.push(c.box); continue; }
      const inBand = (l: OcrLine) => l !== c && Math.abs(centreY(l) - centreY(c)) <= 0.75 * Math.max(G(l).height, G(c).height);
      const side = lines.filter((l) => inBand(l) && verdictAppears(l.text, marker) && centreX(l) > centreX(c)
        && !lines.some((o) => inBand(o) && o !== l && centreX(o) > centreX(c) && centreX(o) < centreX(l)));
      if (side.length === 1) matched.push(unionBox([c, side[0] as OcrLine]));
    }
    return matched.length === 1 ? matched[0] as ImageSourceBox : null;
  }
  const resultValue = row.value;

  const confirmed: { line: OcrLine; box: ImageSourceBox; text: string }[] = [];
  for (const c of named) {
    const norm = (t: string) => t.replace(/[–—−]/g, '-');
    const below = lines
      .filter((l) => l !== c && G(l).y >= G(c).y + G(c).height * 0.5 && centreY(l) - centreY(c) <= G(c).height * 2.4)
      .sort((x, y) => G(x).y - G(y).y)
      .find((l) => /^ref/i.test(l.text.trim()) || [row.ref_low, row.ref_high].some((v) => v !== null && hasNumberLoose(norm(l.text), v)));
    const extra = below && !alnum(below.text).includes(name) ? [below] : [];
    if (hasNumberLoose(norm(c.text), resultValue)) { confirmed.push({ line: c, box: unionBox([c, ...extra]), text: norm(`${c.text} ${extra[0]?.text ?? ''}`) }); continue; }
    if (extra[0] && valueEndsRangeLine(norm(extra[0].text), row)) { confirmed.push({ line: c, box: unionBox([c, extra[0]]), text: norm(`${c.text} ${extra[0].text}`) }); continue; }
    // A side box counts only if (a) the name line has no result of its own (a number that is not part of the test
    // name), (b) the box lies to the right of the name (centre to centre; OCR may merge the box with its unit, which pulls its left edge past the name's), and (c) no other text sits between them in that band.
    const own = (c.text.match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => !row.test_name.includes(n));
    const inBand = (l: OcrLine) => l !== c && Math.abs(centreY(l) - centreY(c)) <= 0.75 * Math.max(G(l).height, G(c).height);
    const side = own.length > 0 ? [] : lines.filter((l) => inBand(l) && isValueOnly(l, resultValue) && centreX(l) > centreX(c) && !lines.some((o) => inBand(o) && o !== l && !isValueOnly(o, resultValue) && centreX(o) > centreX(c) && centreX(o) < centreX(l)));
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
  const kept = texts.filter((t) => t.text.trim() && (t.mean ?? 1) >= MIN_CONFIDENCE && t.box.length >= 4);
  const skew = pageSkew(kept.map((t) => t.box));
  const cx = image.width / 2, cy = image.height / 2, cos = Math.cos(skew), sin = Math.sin(skew);
  return kept.map((t) => {
    const xs = t.box.map((pt) => pt[0] as number), ys = t.box.map((pt) => pt[1] as number);
    const word: OcrWord = { text: t.text.trim(), x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), quad: t.box.map((pt) => [pt[0] as number, pt[1] as number]) };
    if (skew !== 0) {
      // Rotate the text box's corners back by the page's tilt, so "same row" means same row on the paper.
      const fx = t.box.map((pt) => cx + ((pt[0] as number) - cx) * cos + ((pt[1] as number) - cy) * sin);
      const fy = t.box.map((pt) => cy - ((pt[0] as number) - cx) * sin + ((pt[1] as number) - cy) * cos);
      Object.assign(word, { fx0: Math.min(...fx), fx1: Math.max(...fx), fy0: Math.min(...fy), fy1: Math.max(...fy) });
    }
    return word;
  });
}

/**
 * How far the page is tilted, in radians (positive = clockwise), from the baselines of the long text boxes. The median
 * of many boxes ignores a few odd ones. Under 0.4 degrees is treated as straight; over 30 is not a tilt (a sideways
 * page), so layout is left alone.
 */
export function pageSkew(boxes: number[][][]): number {
  const angles = boxes
    .map((b) => {
      const dx = (b[1] as number[])[0] as number - ((b[0] as number[])[0] as number), dy = (b[1] as number[])[1] as number - ((b[0] as number[])[1] as number);
      const h = Math.hypot((b[3] as number[])[0] as number - ((b[0] as number[])[0] as number), (b[3] as number[])[1] as number - ((b[0] as number[])[1] as number));
      return Math.hypot(dx, dy) >= 4 * h && h > 0 ? Math.atan2(dy, dx) : null;
    })
    .filter((a): a is number => a !== null)
    .sort((a, b) => a - b);
  if (angles.length < 3) return 0;
  const median = angles[Math.floor(angles.length / 2)] as number;
  const deg = Math.abs(median) * 180 / Math.PI;
  return deg < 0.4 || deg > 30 ? 0 : median;
}

/** Everything the engine read: its text boxes, the lines they form, and the image size. */
export interface OcrScan { words: OcrWord[]; lines: OcrLine[]; width: number; height: number }

/**
 * Reads a photo. Returns null when the engine could not run (so callers can tell "failed" from "no text"), never
 * throws. The photo must be upright (orientation 1): the engine does not apply stored rotation.
 */
export async function scanImage(buffer: Buffer): Promise<OcrScan | null> {
  const info = imageInfo(buffer);
  if (!info || info.orientation !== 1 || info.width < 50 || info.height < 50) return null;
  const job = (g.__labOcrChain ?? Promise.resolve()).then(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const words = await Promise.race([
        recognizeWords(buffer),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('OCR timed out')), OCR_TIMEOUT_MS); }),
      ]);
      return { words, lines: groupWordsIntoLines(words, info.width, info.height), width: info.width, height: info.height } as OcrScan;
    } catch (e) {
      console.error('OCR failed:', e instanceof Error ? e.message : e);
      g.__labOcrEngine = undefined; // a broken engine must not poison later uploads
      return null;
    } finally { if (timer) clearTimeout(timer); }
  });
  g.__labOcrChain = job.catch(() => undefined);
  return job;
}

/**
 * Lines of text on the photo with their boxes, or [] when the photo cannot be located safely. Never throws:
 * a photo without citations is still a fully readable report.
 */
export async function ocrLines(buffer: Buffer): Promise<OcrLine[]> {
  return (await scanImage(buffer))?.lines ?? [];
}
