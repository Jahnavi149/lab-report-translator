// Builds the photos used to test that identifiers are removed from a picture before it can reach the vision model.
// Every name, number and address below is INVENTED. The images are committed (fixtures/phi/) so the tests do not
// depend on fonts installed on the machine running them. Re-run only to change the fixtures:
//
//   node scripts/make-phi-fixtures.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { LEVELS, degrade } from './phone-degrade.mjs';

const OUT = 'fixtures/phi';
mkdirSync(OUT, { recursive: true });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = 'Helvetica, Arial, sans-serif';
const W = 1000;

/** Draws text lines top to bottom. Each item: [text, {size, bold, x, gap, color}] */
function page(height, items, extra = '') {
  let y = 70;
  const out = [];
  for (const [text, o = {}] of items) {
    const size = o.size ?? 28;
    y += o.gap ?? size * 1.55;
    out.push(`<text x="${o.x ?? 50}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${o.bold ? 700 : 400}" fill="${o.color ?? '#111'}">${esc(text)}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}"><rect width="100%" height="100%" fill="#fff"/>${out.join('')}${extra}</svg>`;
}

const table = (rows) => [
  ['Test                      Result      Unit        Reference', { bold: true, size: 24, gap: 70 }],
  ...rows.map((r) => [r, { size: 26 }]),
];

// --- A: labelled header, table results (what most hospital reports look like) ---------------------------------
const A = {
  name: 'labelled-table',
  rows: [['Hemoglobin', 11.2], ['Total Cholesterol', 230], ['HDL Cholesterol', 38], ['Glucose', 126]],
  phi: ['rahul', 'verma', '00482913', '9876543210', '411001', 'kapoor', '14031987'],
  svg: page(1000, [
    ['CITY GENERAL HOSPITAL AND DIAGNOSTIC CENTRE', { bold: true, size: 30 }],
    ['Patient Name: Rahul Verma', {}],
    ['DOB: 14/03/1987    Age/Sex: 38 Y / M', {}],
    ['MRN: 00482913', {}],
    ['Phone: +91 98765 43210', {}],
    ['Address: 12 MG Road, Pune 411001', {}],
    ['Referred by: Dr. Anil Kapoor', {}],
    ['Collected: 21/09/2026', {}],
    ...table(['Hemoglobin          11.2     g/dL       12.0 - 15.5', 'Total Cholesterol   230      mg/dL      <200', 'HDL Cholesterol     38       mg/dL      >40', 'Glucose             126      mg/dL      70 - 99']),
  ]),
};

// --- B: names and places with NO label (only the privacy model can know these are identifiers) -------------------
const B = {
  name: 'unlabelled-names',
  rows: [['Ferritin', 22], ['TSH', 6.8], ['Vitamin B12', 250]],
  phi: ['maria', 'gonzalez', 'lopez', 'priya', 'raman', 'jubilee'],
  svg: page(900, [
    ['Maria Gonzalez Lopez', { bold: true, size: 36 }],
    ['Reviewed by Priya Raman MD', {}],
    ['Apollo Hospitals, Jubilee Hills, Hyderabad', {}],
    ...table(['Ferritin            22       ng/mL      30 - 400', 'TSH                 6.8      mIU/L      0.4 - 4.5', 'Vitamin B12         250      pg/mL      200 - 900']),
  ]),
};

// --- C: stacked label above value, in capitals (value sits on the line under its label) ---------------------------
const C = {
  name: 'stacked-caps',
  rows: [['Creatinine', 1.4], ['Sodium', 138], ['Potassium', 4.1]],
  phi: ['sanjay', 'iyer', 'px7741209', '9876501234'],
  svg: page(900, [
    ['Patient Name', { size: 22, color: '#555' }],
    ['SANJAY IYER', { bold: true, size: 34, gap: 40 }],
    ['Patient ID', { size: 22, color: '#555', gap: 52 }],
    ['PX-7741209', { size: 30, gap: 38 }],
    ['Mobile', { size: 22, color: '#555', gap: 52 }],
    ['9876501234', { size: 30, gap: 38 }],
    ...table(['Creatinine          1.4      mg/dL      0.6 - 1.2', 'Sodium              138      mmol/L     135 - 145', 'Potassium           4.1      mmol/L     3.5 - 5.1']),
  ]),
};

for (const f of [A, B, C]) {
  const png = await sharp(Buffer.from(f.svg)).png().toBuffer();
  writeFileSync(`${OUT}/${f.name}.png`, png);
}
// D: A and B photographed at an angle with glare and blur (medium), and C harsher.
for (const [f, level] of [[A, 'medium'], [B, 'medium'], [C, 'harsh']]) {
  const src = await sharp(`${OUT}/${f.name}.png`).png().toBuffer();
  await (await degrade(src, LEVELS[level])).toFile(`${OUT}/${f.name}-${level}.jpg`);
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify([A, B, C].flatMap((f) => [
  { file: `${f.name}.png`, rows: f.rows, phi: f.phi },
  { file: `${f.name}-${f.name === 'stacked-caps' ? 'harsh' : 'medium'}.jpg`, rows: f.rows, phi: f.phi },
]), null, 2));
console.log('Wrote fixtures/phi/ (6 images + manifest.json). All data is invented.');
