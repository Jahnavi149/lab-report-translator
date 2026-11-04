// Generates the extra synthetic sample files in /samples, each one showing a different part of the app.
// Every name, number and address is INVENTED. The files are committed, so nobody needs to run this.
// Run (macOS, uses `sips` to render a page to an image): node scripts/make-extra-samples.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { LEVELS, degrade } from './phone-degrade.mjs';

const OUT = 'samples';
mkdirSync(OUT, { recursive: true });

const esc = (s) => s.replace(/[\\()]/g, '\\$&');
// WinAnsi fonts, written as latin1, so accents (é, à, ç) are real selectable text, like a real lab PDF.
const FONTS = '/F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

/** pages: arrays of { y, size, bold, cols: [[x, text], ...] } */
function buildPdf(pages, scale = 1) {
  const W = 612 * scale, H = 792 * scale;
  const objs = ['', ''];
  const kids = [];
  for (const page of pages) {
    const ops = [];
    for (const line of page) for (const [x, str] of line.cols) ops.push(`BT /${line.bold ? 'F2' : 'F1'} ${(line.size ?? 11) * scale} Tf ${x * scale} ${H - line.y * scale} Td (${esc(str)}) Tj ET`);
    const stream = ops.join('\n');
    const contentId = objs.length + 2, pageId = objs.length + 1;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${contentId} 0 R /Resources << /Font << ${FONTS} >> >> >>`);
    objs.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    kids.push(`${pageId} 0 R`);
  }
  objs[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  return assemble(objs);
}

function assemble(objs) {
  let pdf = Buffer.from('%PDF-1.4\n', 'latin1');
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf = Buffer.concat([pdf, Buffer.isBuffer(o) ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from('\nendobj\n')]) : Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1')]); });
  const xref = pdf.length;
  let tail = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  tail += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.concat([pdf, Buffer.from(tail, 'latin1')]);
}

const table = (startY, heads, rows, xs, step = 22) => [
  { y: startY, bold: true, cols: heads.map((h, i) => [xs[i], h]) },
  ...rows.map((r, i) => ({ y: startY + 26 + i * step, cols: r.map((c, j) => [xs[j], c]).filter(([, c]) => c !== '') })),
];
const banner = (title) => [{ y: 60, size: 15, bold: true, cols: [[50, title]] }];
const foot = (y, text) => ({ y, size: 9, cols: [[50, text]] });

// 1. Two pages: identifiers in the header (they must be removed), 18 results, citations on both pages.
{
  const heads = ['Test', 'Result', 'Unit', 'Reference'], xs = [50, 250, 310, 390];
  const p1 = [
    ...banner('SYNTHETIC SAMPLE - Metro Community Laboratory - invented data'),
    { y: 90, cols: [[50, 'Patient Name: Jordan Q. Example']] },
    { y: 106, cols: [[50, 'MRN: 00-481-2290      DOB: 04/09/1981']] },
    { y: 122, cols: [[50, 'Phone: (555) 013-4477      Email: jordan.example@mail.test']] },
    { y: 138, cols: [[50, 'Collected: 03/18/2026      Ordering physician: Dr. A. Placeholder']] },
    ...table(176, heads, [
      ['Hemoglobin', '11.2', 'g/dL', '12.0 - 15.5'], ['Hematocrit', '34.1', '%', '36.0 - 46.0'], ['WBC', '6.5', 'x10E3/uL', '3.4 - 10.8'],
      ['Platelets', '412', 'x10E3/uL', '150 - 450'], ['MCV', '88', 'fL', '79 - 97'], ['Glucose, Fasting', '92', 'mg/dL', '70 - 99'],
      ['Creatinine', '1.4', 'mg/dL', '0.6 - 1.2'], ['BUN', '16', 'mg/dL', '6 - 24'], ['Sodium', '139', 'mmol/L', '134 - 144'],
    ], xs),
    foot(740, 'Page 1 of 2'),
  ];
  const p2 = [
    ...banner('SYNTHETIC SAMPLE - Metro Community Laboratory - continued'),
    ...table(110, heads, [
      ['Potassium', '5.4', 'mmol/L', '3.5 - 5.2'], ['Total Cholesterol', '230', 'mg/dL', '<200'], ['HDL Cholesterol', '38', 'mg/dL', '>40'],
      ['LDL Cholesterol', '154', 'mg/dL', '<100'], ['Triglycerides', '140', 'mg/dL', '<150'], ['TSH', '6.8', 'uIU/mL', '0.45 - 4.50'],
      ['Vitamin D, 25-Hydroxy', '18', 'ng/mL', '30 - 100'], ['Ferritin', '22', 'ng/mL', '15 - 150'], ['Vitamin B12', '250', 'pg/mL', '232 - 1245'],
    ], xs),
    foot(740, 'Page 2 of 2   Synthetic example for Lab Report Translator. Information only, never a diagnosis.'),
  ];
  writeFileSync(join(OUT, '01-two-page-report.pdf'), buildPdf([p1, p2]));
}

// 2. A French report that prints decimal commas and a dot as the thousands separator.
{
  const xs = [50, 260, 320, 400];
  const p = [
    ...banner('EXEMPLE FICTIF - Laboratoire Centre-Ville - données inventées'),
    { y: 90, cols: [[50, 'Nom du patient : Camille Exemple']] },
    { y: 106, cols: [[50, 'Date de naissance : 12/05/1979      Téléphone : 01 55 01 23 45']] },
    { y: 122, cols: [[50, 'Prélèvement : 18/03/2026']] },
    ...table(160, ['Analyse', 'Résultat', 'Unité', 'Valeurs de référence'], [
      ['Hémoglobine', '11,2', 'g/dL', '12,0 - 15,5'], ['Leucocytes', '6,5', 'G/L', '4,0 - 10,0'], ['Glycémie à jeun', '1,26', 'g/L', '0,70 - 1,10'],
      ['Créatinine', '1,4', 'mg/dL', '0,6 - 1,2'], ['Cholestérol total', '2,30', 'g/L', 'inférieur à 2,00'], ['Triglycérides', '1.230', 'mg/dL', 'inférieur à 150'],
      ['Ferritine', '22', 'ng/mL', '15 - 150'],
    ], xs),
    foot(420, 'Exemple fictif pour Lab Report Translator. Information seulement, jamais un diagnostic.'),
  ];
  writeFileSync(join(OUT, '02-french-decimal-commas.pdf'), buildPdf([p]));
}

// 3. No printed ranges: only the lab's own High / Low word. The app copies that verdict and marks the row Needs review.
{
  const xs = [50, 270, 340, 440];
  const p = [
    ...banner('SYNTHETIC SAMPLE - results with flags only (no printed ranges)'),
    { y: 90, cols: [[50, 'Patient Name: Alex Example      MRN: 77-120-0045']] },
    { y: 106, cols: [[50, 'Collected: 03/18/2026']] },
    ...table(144, ['Test', 'Result', 'Unit', 'Flag'], [
      ['Hemoglobin', '11.2', 'g/dL', 'Low'], ['Potassium', '5.8', 'mmol/L', 'High'], ['Sodium', '139', 'mmol/L', ''],
      ['Calcium', '8.1', 'mg/dL', 'Low'], ['ALT', '88', 'U/L', 'High'], ['Urine Protein', 'Positive', '', 'High'],
    ], xs),
    foot(400, 'Synthetic example for Lab Report Translator. Information only, never a diagnosis.'),
  ];
  writeFileSync(join(OUT, '03-flags-without-ranges.pdf'), buildPdf([p]));
}

// 4. A phone-style photo: tilted, shadowed, blurred, compressed.
//    5. The same page embedded as a picture inside a PDF: a scan, with no selectable text.
{
  const xs = [50, 250, 310, 390];
  const page = [
    ...banner('SYNTHETIC SAMPLE - Thyroid and iron panel - invented data'),
    { y: 90, cols: [[50, 'Patient Name: Sam Example      MRN: 55-009-3318']] },
    { y: 106, cols: [[50, 'Collected: 03/18/2026']] },
    ...table(144, ['Test', 'Result', 'Unit', 'Reference'], [
      ['TSH', '6.8', 'uIU/mL', '0.45 - 4.50'], ['Free T4', '0.9', 'ng/dL', '0.82 - 1.77'], ['Ferritin', '22', 'ng/mL', '15 - 150'],
      ['Iron', '48', 'ug/dL', '27 - 159'], ['Vitamin B12', '250', 'pg/mL', '232 - 1245'], ['Folate', '3.1', 'ng/mL', '>3.0'],
    ], xs, 26),
    foot(360, 'Synthetic example for Lab Report Translator. Information only, never a diagnosis.'),
  ];
  const big = join(tmpdir(), 'lrt-extra-large.pdf'), png = join(tmpdir(), 'lrt-extra-page.png');
  writeFileSync(big, buildPdf([page], 2.5));
  execFileSync('sips', ['-s', 'format', 'png', big, '--out', png], { stdio: 'ignore' });
  await (await degrade(png, LEVELS.mild)).toFile(join(OUT, '04-phone-photo.jpg'));

  // The scan: a clean picture of the page, wrapped in a PDF with no text layer at all.
  const jpg = await sharp(png).flatten({ background: '#fff' }).jpeg({ quality: 80 }).toBuffer();
  const { width, height } = await sharp(jpg).metadata();
  const content = `q 612 0 0 792 0 0 cm /Im0 Do Q`;
  const image = Buffer.concat([
    Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`),
    jpg, Buffer.from('\nendstream'),
  ]);
  writeFileSync(join(OUT, '05-scanned-no-text.pdf'), assemble([
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, image,
  ]));
  for (const f of [big, png]) { try { unlinkSync(f); } catch { /* ignore */ } }
}

// 6. A PDF that is not a lab report at all: the app should say so politely and invent nothing.
{
  const p = [
    ...banner('Weekend pancake recipe'),
    { y: 100, cols: [[50, 'Ingredients: 2 cups flour, 2 eggs, 1 3/4 cups milk, 2 tablespoons sugar.']] },
    { y: 120, cols: [[50, 'Whisk everything together, rest for 10 minutes, then fry 3 minutes per side.']] },
    { y: 140, cols: [[50, 'Makes 8 pancakes. Serve with fruit.']] },
  ];
  writeFileSync(join(OUT, '06-not-a-lab-report.pdf'), buildPdf([p]));
}

console.log('wrote 6 files to samples/');
