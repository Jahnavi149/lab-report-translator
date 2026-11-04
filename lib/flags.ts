import type { Flag, LabRow } from './types';

// "AI explains, code decides": every flag in the product comes from this file.
export function flagFor(value: number, refLow: number | null, refHigh: number | null): Flag {
  if (refLow === null && refHigh === null) return 'Unknown';
  if (refLow !== null && value < refLow) return 'Low';
  if (refHigh !== null && value > refHigh) return 'High';
  return 'Normal';
}

export function applyFlags<T extends { value: number; ref_low: number | null; ref_high: number | null }>(rows: T[]): (T & { flag: Flag })[] {
  return rows.map((r) => ({ ...r, flag: flagFor(r.value, r.ref_low, r.ref_high) }));
}

/** Human-readable printed range, e.g. "12 to 15.5 g/dL", "under 200 mg/dL", "over 40 mg/dL", or null when none printed. */
export function describeRange(refLow: number | null, refHigh: number | null, unit: string): string | null {
  const u = unit ? ` ${unit}` : '';
  if (refLow !== null && refHigh !== null) return `${refLow} to ${refHigh}${u}`;
  if (refHigh !== null) return `under ${refHigh}${u}`;
  if (refLow !== null) return `over ${refLow}${u}`;
  return null;
}

/** Compact range for tables and the doctor sheet, e.g. "12 - 15.5 g/dL", "< 200 mg/dL", "> 40 mg/dL". */
export function formatRangeCompact(refLow: number | null, refHigh: number | null, unit: string, none = 'Range not on report'): string {
  const u = unit ? ` ${unit}` : '';
  if (refLow !== null && refHigh !== null) return `${refLow} - ${refHigh}${u}`;
  if (refHigh !== null) return `< ${refHigh}${u}`;
  if (refLow !== null) return `> ${refLow}${u}`;
  return none;
}

const val = (r: Pick<LabRow, 'value' | 'unit'>) => `${r.value}${r.unit ? ` ${r.unit}` : ''}`;

export function summaryFor(rows: LabRow[]): string[] {
  const flagged = rows.filter((r) => r.flag === 'High' || r.flag === 'Low');
  const unknown = rows.filter((r) => r.flag === 'Unknown');
  const normal = rows.filter((r) => r.flag === 'Normal');
  const first = flagged.length > 0
    ? `Ask about first: ${flagged.map((r) => `${r.test_name} (${val(r)}, ${r.flag})`).join(', ')}.`
    : 'No values were outside the ranges printed on this report.';
  const second = normal.length > 0
    ? `${normal.length} result${normal.length === 1 ? '' : 's'} ${normal.length === 1 ? 'was' : 'were'} inside the printed range.`
    : 'No results were inside a printed range in this report.';
  const third = unknown.length > 0
    ? `${unknown.length} result${unknown.length === 1 ? '' : 's'} had no range printed on the report, so they could not be flagged. Ask your doctor what range applies.`
    : 'Every result in this report had a range printed on it.';
  return [first, second, third];
}

export function priorityRows<T extends { flag: Flag }>(rows: T[]): T[] {
  return rows.filter((r) => r.flag === 'High' || r.flag === 'Low' || r.flag === 'Unknown').slice(0, 3);
}

function questionFor(r: LabRow): string {
  if (r.flag === 'Unknown') {
    return `My ${r.test_name} was ${val(r)}, but no range was printed on this report. What range should I compare it to, and should we recheck it?`;
  }
  const range = describeRange(r.ref_low, r.ref_high, r.unit);
  if (!range) {
    return `My ${r.test_name} was ${val(r)} and the report marks it ${r.flag}, but it prints no range. What range should I compare it to, and should we recheck it?`;
  }
  return `My ${r.test_name} was ${val(r)}, while the range on this report is ${range}. Should we recheck this, and is there anything I should track or bring to my next appointment?`;
}

const FILLER_QUESTION = 'Is there anything from this report I should track, bring, or ask about at my next visit?';

export function questionsFor(rows: LabRow[]): string[] {
  const qs = priorityRows(rows).map(questionFor);
  while (qs.length < 3) qs.push(FILLER_QUESTION);
  return qs.slice(0, 3);
}

export function plainEnglishFor(testName: string, value: number, unit: string, refLow: number | null, refHigh: number | null, flag: Flag): string {
  const v = `${value}${unit ? ` ${unit}` : ''}`;
  const ranged = refLow !== null || refHigh !== null;
  if (flag === 'Unknown') return `${testName} was ${v}, but no range was printed on this report, so we cannot say if it is inside or outside a range.`;
  if (!ranged) return `${testName} was ${v}. The report itself marks it ${flag}, but it prints no range.`;
  if (flag === 'High') return `${testName} was ${v}, which is higher than the range printed on this report.`;
  if (flag === 'Low') return `${testName} was ${v}, which is lower than the range printed on this report.`;
  return `${testName} was ${v}, which is inside the range printed on this report.`;
}
