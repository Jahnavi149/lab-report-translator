// Generates the synthetic sample files shipped in /public:
//   public/sample-report.pdf  a digital PDF with columns, edge cases and a missing range
//   public/sample-photo.png   the same report rendered as an image (uses macOS `sips`)
// All data is invented. Run: node scripts/make-samples.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROWS = [
  ['Total Cholesterol', '230', 'mg/dL', '(<200)'],
  ['HDL Cholesterol', '38', 'mg/dL', '(>40)'],
  ['LDL Cholesterol', '142', 'mg/dL', 'Optimal <100, Borderline 130-159'],
  ['Hemoglobin', '11.2', 'g/dL', '12.0 - 15.5'],
  ['Vitamin D, 25-Hydroxy', '18', 'ng/mL', '30 - 100'],
  ['Glucose, Fasting', '92', 'mg/dL', '70 - 99'],
  ['WBC', '6.5', 'x10E3/uL', '3.4 - 10.8'],
  ['Ferritin', '22', 'ng/mL', ''],
];

const esc = (s) => s.replace(/[\\()]/g, '\\$&');

function buildPdf(scale) {
  const W = 612 * scale, H = 792 * scale;
  const ops = [];
  const text = (x, y, size, str, bold = false) => ops.push(`BT /${bold ? 'F2' : 'F1'} ${size * scale} Tf ${x * scale} ${H - y * scale} Td (${esc(str)}) Tj ET`);
  text(50, 60, 16, 'SYNTHETIC SAMPLE LAB REPORT - invented data, not a real patient', true);
  text(50, 90, 11, 'Patient: Sample Person');
  text(50, 106, 11, 'DOB: 01/01/1970');
  text(50, 122, 11, 'Collected: 12/03/2026');
  text(50, 160, 11, 'Test', true); text(250, 160, 11, 'Result', true); text(310, 160, 11, 'Unit', true); text(390, 160, 11, 'Reference', true);
  ROWS.forEach(([name, value, unit, range], i) => {
    const y = 185 + i * 24;
    text(50, y, 11, name); text(250, y, 11, value); text(310, y, 11, unit);
    if (range) text(390, y + (i % 2 === 0 ? 0.6 : -0.4), 11, range); // tiny baseline jitter, like real PDFs
  });
  text(50, 430, 9, 'Synthetic example generated for Lab Report Translator. Information only, never a diagnosis.');
  const stream = ops.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

mkdirSync('public', { recursive: true });
writeFileSync('public/sample-report.pdf', buildPdf(1), 'latin1');
console.log('wrote public/sample-report.pdf');

const big = join(tmpdir(), 'lrt-sample-large.pdf');
writeFileSync(big, buildPdf(2.5), 'latin1');
try {
  execFileSync('sips', ['-s', 'format', 'png', big, '--out', 'public/sample-photo.png'], { stdio: 'ignore' });
  console.log('wrote public/sample-photo.png');
} catch {
  console.log('sips not available (macOS only): skipped public/sample-photo.png');
} finally { try { unlinkSync(big); } catch { /* ignore */ } }
