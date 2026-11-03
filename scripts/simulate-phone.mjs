// Stand-in for real phone photos: takes the screenshots in eval/photos/ and degrades them the way a phone camera does
// (perspective tilt, rotation, uneven light, glare, defocus blur, sensor noise, JPEG compression), then runs the real
// citation pipeline on each result and checks every highlight.
//
//   npm run evaluate:phone            (reuses the Muse rows already cached by review:citations; no network)
//
// This is a proxy, not the real thing. Real photos add things this cannot fake (curled paper, finger shadows,
// autofocus hunting). Use it to find breakage early, then confirm with 2-3 real photos.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const ocr = require(process.cwd() + '/.test-build/ocr.js');
const OUT = 'eval/phone-sim';
mkdirSync(OUT, { recursive: true });

// Deterministic noise so runs are comparable.
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

const LEVELS = {
  mild:   { tilt: 0.03, rot: 2,  blur: 0.6, noise: 4,  q: 80, shadow: 0.12, glare: 0.10, width: 1600 },
  medium: { tilt: 0.07, rot: 5,  blur: 1.1, noise: 8,  q: 65, shadow: 0.25, glare: 0.22, width: 1400 },
  harsh:  { tilt: 0.12, rot: 9,  blur: 1.8, noise: 14, q: 45, shadow: 0.40, glare: 0.35, width: 1100 },
};

async function degrade(srcPath, L) {
  const { data, info } = await sharp(srcPath).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sw = info.width, sh = info.height;
  // Output canvas: the page sits on a desk with margin, then everything is viewed at an angle.
  const W = L.width, H = Math.round(W * (sh / sw) * 1.0 + W * 0.12);
  const margin = W * 0.06;
  const pw = W - 2 * margin, ph = pw * (sh / sw);
  const cx = W / 2, cy = H / 2, rad = (L.rot * Math.PI) / 180;
  // Keystone: top edge narrower than bottom (camera tilted back). Mapped per row.
  const out = Buffer.alloc(W * H * 3);
  const gx = W * (0.7 + 0.2 * rnd()), gy = H * (0.2 + 0.3 * rnd()), gr = W * 0.35;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // undo rotation about the centre
      const dx = x - cx, dy = y - cy;
      let ux = dx * Math.cos(-rad) - dy * Math.sin(-rad) + cx;
      let uy = dx * Math.sin(-rad) + dy * Math.cos(-rad) + cy;
      // undo keystone: scale about vertical axis depends on y
      const t = uy / H; // 0 top, 1 bottom
      const scale = 1 - L.tilt * (1 - t) * 2; // top is smaller
      ux = cx + (ux - cx) / scale;
      const px = ((ux - margin) / pw) * sw, py = ((uy - (H - ph) / 2) / ph) * sh;
      const o = (y * W + x) * 3;
      let r, g, b;
      if (px >= 0 && py >= 0 && px < sw - 1 && py < sh - 1) {
        const x0 = px | 0, y0 = py | 0, fx = px - x0, fy = py - y0;
        const i00 = (y0 * sw + x0) * 3, i10 = i00 + 3, i01 = i00 + sw * 3, i11 = i01 + 3;
        const m = (c) => (data[i00 + c] * (1 - fx) + data[i10 + c] * fx) * (1 - fy) + (data[i01 + c] * (1 - fx) + data[i11 + c] * fx) * fy;
        r = m(0); g = m(1); b = m(2);
      } else { r = 70; g = 62; b = 55; } // desk
      // uneven lighting: darker toward one corner, plus a soft glare spot
      const shade = 1 - L.shadow * ((x / W) * 0.6 + (y / H) * 0.4);
      const d2 = ((x - gx) ** 2 + (y - gy) ** 2) / (gr * gr);
      const glare = L.glare * 255 * Math.exp(-d2 * 2.2);
      r = r * shade + glare; g = g * shade + glare; b = b * shade + glare;
      const n = gauss() * L.noise;
      out[o] = Math.max(0, Math.min(255, r + n)); out[o + 1] = Math.max(0, Math.min(255, g + n)); out[o + 2] = Math.max(0, Math.min(255, b + n));
    }
  }
  return sharp(out, { raw: { width: W, height: H, channels: 3 } }).blur(L.blur).jpeg({ quality: L.q });
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9.]/g, '');
const SOURCES = ['IMG_8335', 'IMG_8338', 'IMG_8341', 'IMG_8344'].filter((n) => existsSync(`eval/photos/${n}.PNG`) && existsSync(`eval/.cache/${n}.rows.json`));
if (SOURCES.length === 0) { console.log('Needs the screenshots in eval/photos/ and their cached rows (run npm run review:citations once).'); process.exit(0); }

const tally = {};
for (const level of Object.keys(LEVELS)) tally[level] = { rows: 0, cited: 0, correct: 0, wrong: 0, abstained: 0 };
for (const name of SOURCES) {
  const rows = JSON.parse(readFileSync(`eval/.cache/${name}.rows.json`, 'utf8')).rows;
  for (const [level, L] of Object.entries(LEVELS)) {
    const file = `${OUT}/${name}-${level}.jpg`;
    await (await degrade(`eval/photos/${name}.PNG`, L)).toFile(file);
    const lines = await ocr.ocrLines(readFileSync(file));
    const t = tally[level];
    for (const r of rows) {
      t.rows++;
      const box = ocr.matchRowToLine({ test_name: r.test_name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high }, lines);
      if (!box) { t.abstained++; continue; }
      t.cited++;
      const inside = lines.filter((l) => l.box.y >= box.y - 0.004 && l.box.y + l.box.height <= box.y + box.height + 0.004 && l.box.x >= box.x - 0.004).map((l) => l.text);
      const joined = norm(inside.join(' '));
      // Looser name check (first 6 chars) because defocus makes OCR misspell; the value must be exact.
      if (joined.includes(norm(r.test_name).slice(0, 6)) && joined.includes(String(r.value))) t.correct++;
      else { t.wrong++; console.log(`  CHECK ${name}-${level}: ${r.test_name} = ${r.value} -> ${JSON.stringify(inside)}`); }
    }
    console.log(`${name}-${level}: ${lines.length} OCR lines`);
  }
}
console.log('\nlevel   rows  cited  correct  wrong  no-citation');
for (const [level, t] of Object.entries(tally)) console.log(`${level.padEnd(7)} ${String(t.rows).padStart(4)}  ${String(t.cited).padStart(5)}  ${String(t.correct).padStart(7)}  ${String(t.wrong).padStart(5)}  ${String(t.abstained).padStart(11)}`);
console.log(`\nImages are in ${OUT}/ so you can look at what the OCR was given.`);
process.exit(0);
