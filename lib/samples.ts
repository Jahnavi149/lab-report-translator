import { applyFlags, plainEnglishFor, questionsFor, summaryFor } from './flags';
import type { LabReport, LabRow } from './types';

type RawRow = Omit<LabRow, 'flag' | 'plain_english' | 'flag_source' | 'confidence'> & { confidence?: LabRow['confidence'] };

function buildReport(id: string, title: string, raw: RawRow[], sourceNote: string): LabReport {
  const rows: LabRow[] = applyFlags(raw).map((r) => {
    const hasRange = r.ref_low !== null || r.ref_high !== null;
    return {
      ...r,
      flag_source: hasRange ? 'range' : 'none',
      confidence: hasRange ? 'high' : 'low',
      ...(hasRange ? {} : { review_reason: 'No range is printed for this test.' }),
      plain_english: plainEnglishFor(r.test_name, r.value, r.unit, r.ref_low, r.ref_high, r.flag),
    };
  });
  return {
    id, title, is_synthetic: true, rows, summary: summaryFor(rows), questions: questionsFor(rows),
    verification_passed: true,
    verification_note: 'Synthetic report: values, units and ranges are the ones written into the sample.',
    source_note: sourceNote,
  };
}

const src = (t: string, v: number, u: string, range: string) => `${t} ${v} ${u} ${range}`.trim();
const NOTE = 'Synthetic sample. No real patient data.';

export const SAMPLES: LabReport[] = [
  buildReport('normal-panel', 'Normal panel (synthetic)', [
    { test_name: 'Total Cholesterol', value: 178, unit: 'mg/dL', ref_low: null, ref_high: 200, source_text: src('Total Cholesterol', 178, 'mg/dL', '(<200)') },
    { test_name: 'Hemoglobin', value: 13.8, unit: 'g/dL', ref_low: 12.0, ref_high: 15.5, source_text: src('Hemoglobin', 13.8, 'g/dL', '12.0 - 15.5') },
    { test_name: 'Glucose, Fasting', value: 92, unit: 'mg/dL', ref_low: 70, ref_high: 99, source_text: src('Glucose, Fasting', 92, 'mg/dL', '70 - 99') },
  ], NOTE),
  buildReport('mixed-abnormal', 'Mixed abnormal panel (synthetic)', [
    { test_name: 'Total Cholesterol', value: 230, unit: 'mg/dL', ref_low: null, ref_high: 200, source_text: src('Total Cholesterol', 230, 'mg/dL', '(<200)') },
    { test_name: 'HDL Cholesterol', value: 38, unit: 'mg/dL', ref_low: 40, ref_high: null, source_text: src('HDL Cholesterol', 38, 'mg/dL', '(>40)') },
    { test_name: 'Hemoglobin', value: 11.2, unit: 'g/dL', ref_low: 12.0, ref_high: 15.5, source_text: src('Hemoglobin', 11.2, 'g/dL', '12.0 - 15.5') },
    { test_name: 'Glucose, Fasting', value: 92, unit: 'mg/dL', ref_low: 70, ref_high: 99, source_text: src('Glucose, Fasting', 92, 'mg/dL', '70 - 99') },
  ], NOTE),
  buildReport('sugar-thyroid', 'Blood sugar and thyroid panel (synthetic)', [
    { test_name: 'HbA1c', value: 6.4, unit: '%', ref_low: null, ref_high: 5.7, source_text: src('HbA1c', 6.4, '%', '(<5.7)') },
    { test_name: 'TSH', value: 6.8, unit: 'mIU/L', ref_low: 0.4, ref_high: 4.5, source_text: src('TSH', 6.8, 'mIU/L', '0.4 - 4.5') },
    { test_name: 'Vitamin D, 25-Hydroxy', value: 18, unit: 'ng/mL', ref_low: 30, ref_high: 100, source_text: src('Vitamin D, 25-Hydroxy', 18, 'ng/mL', '30 - 100') },
  ], NOTE),
  buildReport('tricky-panel', 'Tricky panel: missing range (synthetic)', [
    { test_name: 'Ferritin', value: 22, unit: 'ng/mL', ref_low: null, ref_high: null, source_text: src('Ferritin', 22, 'ng/mL', '') },
    { test_name: 'Total Cholesterol', value: 195, unit: 'mg/dL', ref_low: null, ref_high: 200, source_text: src('Total Cholesterol', 195, 'mg/dL', '(<200)') },
    { test_name: 'Hemoglobin', value: 12.4, unit: 'g/dL', ref_low: 12.0, ref_high: 15.5, source_text: src('Hemoglobin', 12.4, 'g/dL', '12.0 - 15.5') },
  ], 'Synthetic sample. The Ferritin row has no range printed, so it is flagged Unknown and marked Needs Review.'),
];

