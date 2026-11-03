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

const require = createRequire(import.meta.url);
const ocr = require(process.cwd() + '/.test-build/ocr.js');
const OUT = 'eval/phone-sim';
mkdirSync(OUT, { recursive: true });

import { LEVELS, degrade } from './phone-degrade.mjs';

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
