// Photo-citation review sheet.
//
//   1. Put lab-report photos in eval/photos/ (git ignores them; real reports are health data, keep them local).
//   2. npm run review:citations            rows read by Muse (needs META_MODEL_API_KEY; results cached in eval/.cache)
//      npm run review:citations -- --limit=5   only the first 5 photos (Muse reads take about 30 s each)
//      npm run review:citations -- --rows=ocr   rows parsed from the OCR text instead (offline, but a weaker test:
//                                          the rows then come from the same lines they are matched to)
//   3. Open eval/report/index.html. Every row that got a highlight is shown as a crop of the photo with the
//      outline on it. Tick "wrong" on any that is not the right line. The page keeps a running score:
//      share of shown highlights that are correct (the 99% target), and how many rows got none.
//
// Photos with stored phone rotation are skipped: the app straightens those in the browser first, and this
// script has no image library to do the same. Export them upright and try again.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import ts from 'typescript';

const OUT = '.test-build';
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync('lib').filter((n) => n.endsWith('.ts'))) {
  const js = ts.transpileModule(readFileSync(join('lib', f), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  writeFileSync(join(OUT, f.replace(/\.ts$/, '.js')), js);
}
const require = createRequire(import.meta.url);
const load = (n) => require(join(process.cwd(), OUT, `${n}.js`));

// Minimal .env.local reader so the Muse key is found without extra packages.
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const ocr = load('ocr');
const muse = load('muse');
const { parseLabTextDetailed } = load('parse');

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const mode = arg('rows') ?? (muse.museConfigured() ? 'muse' : 'ocr');
if (mode === 'muse' && !muse.museConfigured()) { console.error('No Muse key found. Set META_MODEL_API_KEY in .env.local, or use --rows=ocr.'); process.exit(1); }

const PHOTOS = 'eval/photos', CACHE = 'eval/.cache', PREPARED = join(CACHE, 'prepared'), REPORT = 'eval/report';
for (const d of [PHOTOS, PREPARED, REPORT]) mkdirSync(d, { recursive: true });
const limit = Number(arg('limit')) || Infinity;
const files = readdirSync(PHOTOS).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().slice(0, limit);
if (files.length === 0) { console.log(`No photos in ${PHOTOS}/ yet. Add some and run this again.`); process.exit(0); }

// Mirror what the browser does before upload: long edge between 1600 and 2400 px (macOS sips; skipped elsewhere).
function prepare(file) {
  const src = join(PHOTOS, file), dst = join(PREPARED, `${basename(file, extname(file))}.jpg`);
  const info = ocr.imageInfo(readFileSync(src));
  try {
    const long = info ? Math.max(info.width, info.height) : 0;
    const target = long && long < 1600 ? 1600 : long > 2400 ? 2400 : 0;
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', ...(target ? ['-Z', String(target)] : []), src, '--out', dst], { stdio: 'ignore' });
    return dst;
  } catch { return src; }
}

async function rowsFor(name, prepared, lines) {
  if (mode === 'ocr') return parseLabTextDetailed(lines.map((l) => l.text).join('\n')).rows;
  const cacheFile = join(CACHE, `${name}.rows.json`);
  const stamp = `${statSync(prepared).size}`;
  if (existsSync(cacheFile)) { const c = JSON.parse(readFileSync(cacheFile, 'utf8')); if (c.stamp === stamp) return c.rows; }
  const buf = readFileSync(prepared);
  const mime = ocr.imageInfo(buf) && buf[0] === 0xff ? 'image/jpeg' : 'image/png';
  const rows = (await muse.extractFromImageWithMuse(buf, mime)).map((r) => ({ test_name: r.test_name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high, source_text: r.source_text }));
  writeFileSync(cacheFile, JSON.stringify({ stamp, rows }));
  return rows;
}

const results = [], skipped = [];
for (const [i, file] of files.entries()) {
  process.stdout.write(`[${i + 1}/${files.length}] ${file} ... `);
  const prepared = prepare(file);
  const buf = readFileSync(prepared);
  const info = ocr.imageInfo(buf);
  if (!info) { skipped.push(`${file} (not a readable image)`); console.log('skipped'); continue; }
  if (info.orientation !== 1) { skipped.push(`${file} (stored phone rotation ${info.orientation}; export it upright)`); console.log('skipped (rotated)'); continue; }
  const lines = await ocr.ocrLines(buf);
  let rows = [];
  try { rows = await rowsFor(basename(file, extname(file)), prepared, lines); } catch (e) { skipped.push(`${file} (rows: ${e.message})`); console.log('skipped (rows failed)'); continue; }
  const seen = new Map();
  const items = rows.map((r) => {
    const n = (seen.get(r.test_name.toLowerCase()) ?? 0) + 1; seen.set(r.test_name.toLowerCase(), n);
    const name = n > 1 ? `${r.test_name} (${n})` : r.test_name;
    return { name, r, box: ocr.matchRowToLine({ test_name: name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high }, lines) };
  });
  results.push({ file, prepared, info, items });
  console.log(`${items.filter((x) => x.box).length}/${items.length} rows cited`);
}
await globalThis.__labOcrWorker?.then((w) => w.terminate()).catch(() => {});

// ---- the sheet ------------------------------------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SHOW_W = 760, MARGIN = 0.025;
const crop = (img, info, box) => {
  const imgH = SHOW_W * info.height / info.width;
  const top = Math.max(0, box.y - MARGIN), bottom = Math.min(1, box.y + box.height + MARGIN);
  return `<div class="crop" style="width:${SHOW_W}px;height:${Math.round((bottom - top) * imgH)}px;background-image:url('${esc(img)}');background-size:${SHOW_W}px auto;background-position:0 -${Math.round(top * imgH)}px">
    <div class="box" style="left:${box.x * SHOW_W}px;top:${Math.round((box.y - top) * imgH)}px;width:${box.width * SHOW_W}px;height:${Math.round(box.height * imgH)}px"></div></div>`;
};
let id = 0;
const sections = results.map(({ file, prepared, info, items }) => {
  const rel = `../.cache/prepared/${basename(prepared)}`.replace('../.cache/prepared/../', '../');
  const rowsHtml = items.map(({ name, r, box }) => {
    const key = `${file}::${name}`;
    return box
      ? `<div class="row" data-key="${esc(key)}"><div class="label"><strong>${esc(name)}</strong> ${esc(r.value)} ${esc(r.unit)}<label class="bad"><input type="checkbox" class="wrong"> wrong line</label></div>${crop(rel, info, box)}</div>`
      : `<div class="row none"><div class="label"><strong>${esc(name)}</strong> ${esc(r.value)} ${esc(r.unit)} <em>no highlight (not matched to a single line)</em></div></div>`;
  }).join('');
  id++;
  return `<section><h2>${esc(file)} <small>${info.width}×${info.height}, ${items.filter((x) => x.box).length}/${items.length} cited</small></h2>${rowsHtml || '<p>No rows were read from this photo.</p>'}</section>`;
}).join('');
const total = results.reduce((a, x) => a + x.items.length, 0), cited = results.reduce((a, x) => a + x.items.filter((i) => i.box).length, 0);
writeFileSync(join(REPORT, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Citation review</title>
<style>body{font:15px system-ui;margin:0;background:#f4f7f8;color:#12202b}header{position:sticky;top:0;background:#12202b;color:#fff;padding:12px 20px;z-index:5}main{padding:20px;max-width:880px;margin:auto}
section{background:#fff;border-radius:12px;padding:14px 18px;margin-bottom:18px;box-shadow:0 1px 6px rgba(0,0,0,.08)}h2 small{font-weight:400;color:#667}.row{margin:10px 0;padding-top:8px;border-top:1px solid #e3eaee}.label{display:flex;gap:10px;align-items:center;margin-bottom:6px}.bad{margin-left:auto;color:#a21;font-weight:600}.none{color:#667}
.crop{position:relative;background-repeat:no-repeat;border:1px solid #cbd6dc;overflow:hidden}.box{position:absolute;background:rgba(255,214,64,.45);outline:2px solid #d28a00}</style>
<header id="score">Loading…</header><main><p>Source: ${results.length} photo(s), rows read by <strong>${mode === 'muse' ? 'Muse' : 'OCR text (weaker test)'}</strong>. Tick “wrong line” on any highlight that is not on the line for the row named above it.${skipped.length ? `<br>Skipped: ${esc(skipped.join('; '))}` : ''}</p>${sections}</main>
<script>
const rows=[...document.querySelectorAll('.row[data-key]')];const total=${total};
const saved=JSON.parse(localStorage.getItem('citation-review')||'{}');
function score(){const wrong=rows.filter(r=>r.querySelector('.wrong').checked).length;localStorage.setItem('citation-review',JSON.stringify(Object.fromEntries(rows.map(r=>[r.dataset.key,r.querySelector('.wrong').checked]))));
 const ok=rows.length-wrong;document.getElementById('score').innerHTML='Highlights shown: <b>'+rows.length+'</b> of '+total+' rows ('+(total?Math.round(100*rows.length/total):0)+'% coverage) · marked wrong: <b>'+wrong+'</b> · correct among shown: <b>'+(rows.length?(100*ok/rows.length).toFixed(1):'–')+'%</b> (target 99%)';}
rows.forEach(r=>{const c=r.querySelector('.wrong');c.checked=!!saved[r.dataset.key];c.addEventListener('change',score)});score();
</script>`);
console.log(`\n${results.length} photo(s), ${cited}/${total} rows got a highlight.${skipped.length ? `\nSkipped: ${skipped.join('; ')}` : ''}`);
console.log(`Review sheet: ${join(process.cwd(), REPORT, 'index.html')}`);
