import type { LabRow } from './types';

// What this check does, honestly: for every extracted row it confirms that the value, the unit and each
// printed range bound appear as WHOLE TOKENS on that row's own source line, and that the line really is
// present in the document text. That catches parsing slips (a number taken from the wrong place, a
// dropped comma, a truncated unit). It cannot catch a report that is itself wrong; the Muse second pass
// is the independent check.

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const withCommas = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-US') : String(n));

/** Does `n` appear as a standalone number in `text` (with or without thousands separators)? */
export function hasNumberToken(text: string, n: number): boolean {
  const forms = new Set([String(n), withCommas(n), n.toFixed(1), n.toFixed(2)].filter((f) => Number(f.replace(/,/g, '')) === n));
  return [...forms].some((f) => new RegExp(`(?<![\\d.,])${esc(f)}(?![\\d]|[.,]\\d)`).test(text));
}

export function verifyRow(row: LabRow, normalizedSource: string): string | null {
  const line = row.source_text;
  if (!normalizedSource.includes(line)) return 'its line was not found in the document text';
  if (!hasNumberToken(line, row.value)) return 'its value was not found on its line';
  if (row.unit && !line.toLowerCase().includes(row.unit.toLowerCase())) return 'its unit was not found on its line';
  if (row.ref_low !== null && !hasNumberToken(line, row.ref_low)) return 'its lower range bound was not found on its line';
  if (row.ref_high !== null && !hasNumberToken(line, row.ref_high)) return 'its upper range bound was not found on its line';
  return null;
}

export interface Verification {
  passed: boolean;
  note: string;
  rows: LabRow[];
}

export function verifyRows(rows: LabRow[], sourceText: string): Verification {
  if (rows.length === 0) return { passed: false, note: 'No results were extracted. Please try a clearer file or the example report.', rows };
  const normalized = sourceText.replace(/[–—−]/g, '-').split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, ' ')).join('\n');
  const failed: string[] = [];
  const out = rows.map((row) => {
    const problem = verifyRow(row, normalized);
    if (!problem) return row;
    failed.push(row.test_name);
    return { ...row, confidence: 'low' as const, review_reason: `Needs review: ${problem}.` };
  });
  if (failed.length > 0) {
    return { passed: false, note: `Could not verify these rows against the document text: ${failed.join(', ')}. They are marked Needs Review. Please check them against your original report.`, rows: out };
  }
  return { passed: true, note: 'Every extracted value, unit and printed range was found on its own line of your report.', rows: out };
}
