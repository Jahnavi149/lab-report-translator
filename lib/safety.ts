import type { LabRow } from './types';

// Everything that decides whether AI-written text may reach the screen lives here.
// It is pure (no network, no env) so it can be unit-tested against adversarial outputs.
// Principle: AI explains, code decides. Anything that fails a check is discarded and the
// deterministic template from lib/flags.ts is shown instead.

export function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => String(Number(n)));
}

export function allowedNumbers(row: Pick<LabRow, 'value' | 'ref_low' | 'ref_high'>): Set<string> {
  const s = new Set<string>([String(row.value)]);
  if (row.ref_low !== null) s.add(String(row.ref_low));
  if (row.ref_high !== null) s.add(String(row.ref_high));
  return s;
}

export function allowedNumbersForRows(rows: Pick<LabRow, 'value' | 'ref_low' | 'ref_high'>[]): Set<string> {
  const s = new Set<string>();
  for (const r of rows) for (const n of allowedNumbers(r)) s.add(n);
  return s;
}

const sameMultiset = (a: string[], b: string[]) => a.slice().sort().join(',') === b.slice().sort().join(',');

// --- Content filters -------------------------------------------------------------
// Medical content that must never appear in AI text: diagnoses, conditions, treatment.
const DIAGNOSIS = /diagnos|disease|disorder|syndrome|deficien|an(a)?emi|diabet|cancer|tumou?r|infect|stroke|heart attack|cardiac|cardiovascular|kidney (failure|disease)|liver (damage|disease|failure)|\bhypo\w*|\bhyper\w*|malnutrition|leuk(a)?emi|lymphoma|obes|arthritis|osteopor/i;
const TREATMENT = /treat|therap|cure|\bdose|dosage|\bmg\b(?!\/)|prescri|medicat|medicine|drug|supplement|vitamin pill|\bdiet\b|\beat\b|\bdrink|\bavoid|exercis|workout|\bstop\b|\bstart\b|\bbegin\b|\bquit\b|\bincrease\b|\bdecrease\b|\breduce\b|\btake\b|\btaking\b|lifestyle|surgery|injection/i;
// Statements may not interpret or speculate. (Questions are allowed to ask about causes.)
const INTERPRETATION = /\bshould\b|\bmust\b|\bneed to\b|\bhave to\b|suggest|indicat|impl(y|ies)|point(s|ing)? to|sign(s)? of|symptom|\brisk|likely|probabl|possibl|\bmay\b|\bmight\b|\bcould mean\b|\bmeans? that\b|due to|because of|caused by|result(s)? (from|of)|\bhealthy\b|unhealthy|worr|concern|serious|danger|urgent|emergency|good news|bad news|\bfine\b|\bgreat\b|excellent|\bpoor\b|\bnormal for you\b|you (have|are|may|might|will|should|need)|your (body|health)/i;

export function containsDiagnosisOrTreatment(text: string): boolean {
  return DIAGNOSIS.test(text) || TREATMENT.test(text);
}
export function containsInterpretation(text: string): boolean {
  return containsDiagnosisOrTreatment(text) || INTERPRETATION.test(text);
}

const DIRECTION: Record<LabRow['flag'], RegExp> = {
  High: /higher than|above|over the/i,
  Low: /lower than|below|under the/i,
  Normal: /inside|within/i,
  Unknown: /no range/i,
};
const CONTRADICTS: Record<LabRow['flag'], RegExp> = {
  High: /lower than|below|inside|within|normal/i,
  Low: /higher than|above|inside|within|normal/i,
  Normal: /higher than|above|lower than|below|outside|abnormal/i,
  Unknown: /higher than|above|lower than|below|inside|within|outside|normal/i,
};

const hasTestName = (text: string, row: LabRow) => text.toLowerCase().includes(row.test_name.toLowerCase());
/** Remove the row's own test name so names like "Vitamin B12" or "Drug screen" do not trip number/content checks. */
const stripNames = (text: string, rows: LabRow[]) => rows.reduce((t, r) => t.split(new RegExp(r.test_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).join(' '), text);

/**
 * One explanation sentence. Must name the test and its value, contain only the row's own numbers,
 * state a direction that AGREES with the code-computed flag, and contain no interpretation.
 */
export function explanationIsSafe(explanation: unknown, row: LabRow): explanation is string {
  if (typeof explanation !== 'string') return false;
  const text = explanation.trim();
  if (text.length < 10 || text.length > 300) return false;
  if ((text.match(/[.!?](\s|$)/g) ?? []).length > 2) return false;
  if (!hasTestName(text, row)) return false;
  const body = stripNames(text, [row]);
  const nums = numbersIn(body);
  if (!nums.includes(String(row.value)) || !nums.every((n) => allowedNumbers(row).has(n))) return false;
  if (containsInterpretation(body)) return false;
  // Direction must match the flag that code computed. For rows whose flag came from a report marker
  // with no printed range, accept the marker word instead.
  if (row.ref_low === null && row.ref_high === null && row.flag !== 'Unknown') {
    return new RegExp(row.flag, 'i').test(text) && !CONTRADICTS[row.flag].test(text);
  }
  return DIRECTION[row.flag].test(text) && !CONTRADICTS[row.flag].test(text);
}

/** Three lines. Only the report's own numbers; every High/Low test must be named in line 1. */
export function summaryIsSafe(summary: unknown, rows: LabRow[]): summary is string[] {
  if (!Array.isArray(summary) || summary.length !== 3) return false;
  if (!summary.every((s) => typeof s === 'string' && s.trim().length > 0 && s.length <= 400)) return false;
  const allowed = allowedNumbersForRows(rows);
  // Counts of results per group are the only other numbers a summary may state.
  for (const flag of ['Normal', 'High', 'Low', 'Unknown'] as const) allowed.add(String(rows.filter((r) => r.flag === flag).length));
  allowed.add(String(rows.length));
  allowed.add(String(rows.filter((r) => r.flag === 'High' || r.flag === 'Low').length));
  const bodies = (summary as string[]).map((s) => stripNames(s, rows));
  if (!bodies.every((b) => numbersIn(b).every((n) => allowed.has(n)))) return false;
  if (bodies.some((b) => containsInterpretation(b))) return false;
  const flagged = rows.filter((r) => r.flag === 'High' || r.flag === 'Low');
  return flagged.every((r) => hasTestName(summary[0] as string, r));
}

/** One question per priority row. May ask about causes, but never name a condition, treatment or advice. */
export function questionIsSafe(question: unknown, row: LabRow): question is string {
  if (typeof question !== 'string') return false;
  const q = question.trim();
  if (q.length < 10 || q.length > 300 || !q.endsWith('?')) return false;
  if (!hasTestName(q, row)) return false;
  const body = stripNames(q, [row]);
  const nums = numbersIn(body);
  if (!nums.includes(String(row.value)) || !nums.every((n) => allowedNumbers(row).has(n))) return false;
  return !containsDiagnosisOrTreatment(body) && !/\brisk|symptom|danger|serious|urgent|emergency|you (have|are|may|might)/i.test(body);
}

/**
 * A translation must keep exactly the same numbers as its source, be a plausible length, and must
 * not smuggle English medical-advice words back in.
 */
export function translationIsSafe(source: unknown, translated: unknown): translated is string {
  if (typeof source !== 'string' || typeof translated !== 'string') return false;
  const t = translated.trim();
  if (t.length === 0 || t.length > 900) return false;
  const ratio = t.length / Math.max(source.length, 1);
  if (ratio < 0.2 || ratio > 5) return false;
  if (!sameMultiset(numbersIn(source), numbersIn(t))) return false;
  return !containsInterpretation(t);
}

// --- Privacy: never send identifying header lines to a third-party API ------------------
const IDENTIFYING_LINE = /\b(patient|name|dob|d\.o\.b|date of birth|birth|mrn|uhid|address|phone|mobile|tel|fax|email|e-mail|ssn|aadhaar|passport|insurance|policy|referred|referring|physician|doctor|dr\.|requested by|collected|accession|barcode|sample id|patient id|id)\b/i;

/**
 * A printed reference range such as "12.0 - 15.5", "3.4 - 10.8" or "150000 - 450000" must reach the checker intact.
 * It is a range if it is two plain numbers around a dash AND is written like one: it has a decimal point, spaces
 * around the dash, or both sides are short. "98765-43210" and "040-23456789" (unspaced, long) still count as
 * phone-style numbers and are masked.
 */
function isLabRange(s: string): boolean {
  const m = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/.exec(s.trim());
  if (!m) return false;
  const [, a = '', b = ''] = m;
  const digits = (x: string) => x.replace('.', '').length;
  const spaced = /\s-\s/.test(s);
  const decimal = a.includes('.') || b.includes('.');
  const short = digits(a) <= 4 && digits(b) <= 4;
  return digits(a) <= 7 && digits(b) <= 7 && (spaced || decimal || short);
}

/** Drops lines that look like patient identifiers and masks emails, phone numbers, long ID numbers and dates. Lab ranges are kept. */
export function redactForMuse(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !IDENTIFYING_LINE.test(line))
    .map((line) => line
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
      .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, '[date]')
      // A decimal or a lab range is a result; a bare 10+ digit integer (no lab value is that long) is an ID or phone number.
      .replace(/\+?\d[\d\s().-]{8,}\d/g, (m) => (/^\d+\.\d+$/.test(m.trim()) || isLabRange(m) ? m : '[number]')))
    .join('\n');
}

/** Test names come from untrusted PDFs and photos. Keep only characters a real test name needs. */
export function sanitizeTestName(name: string): string {
  return name.replace(/[^\p{L}\p{N} ,.()/%+:'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}
