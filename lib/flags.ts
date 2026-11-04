import type { Flag, FlagSource, LabRow, ReportedVerdict } from './types';

/** True only for explicit verdict words printed by a report; never derives a verdict from colour or layout. */
export function verdictAppears(text: string, flag: Exclude<Flag, 'Unknown'>): boolean {
  const patterns: Record<Exclude<Flag, 'Unknown'>, RegExp> = {
    High: /\b(?:high|above(?: range)?|abnormal high)\b/i,
    Low: /\b(?:low|below(?: range)?|abnormal low)\b/i,
    Normal: /\b(?:normal|within range|expected)\b/i,
  };
  return patterns[flag].test(text);
}

// "AI explains, code decides": every flag in the product comes from this file.
export function flagFor(value: number, refLow: number | null, refHigh: number | null): Flag {
  if (refLow === null && refHigh === null) return 'Unknown';
  if (refLow !== null && value < refLow) return 'Low';
  if (refHigh !== null && value > refHigh) return 'High';
  return 'Normal';
}

/** Numeric ranges win. A printed verdict is fallback evidence only when the report has no numeric range. */
export function flagFromEvidence(value: number | null, refLow: number | null, refHigh: number | null, verdict: ReportedVerdict | null): { flag: Flag; source: FlagSource } {
  const ranged = refLow !== null || refHigh !== null;
  if (ranged && value !== null) return { flag: flagFor(value, refLow, refHigh), source: 'range' };
  if (!ranged && verdict) return { flag: verdict, source: 'report_marker' };
  return { flag: 'Unknown', source: 'none' };
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

export const formatValue = (value: number | null, unit: string, none = 'Value not shown') =>
  value === null ? none : `${value}${unit ? ` ${unit}` : ''}`;

const val = (r: Pick<LabRow, 'value' | 'unit'>) => formatValue(r.value, r.unit, 'value not shown');

export function summaryFor(rows: LabRow[]): string[] {
  const flagged = rows.filter((r) => r.flag === 'High' || r.flag === 'Low');
  const unknown = rows.filter((r) => r.flag === 'Unknown');
  const normal = rows.filter((r) => r.flag === 'Normal');
  const noRange = rows.filter((r) => r.ref_low === null && r.ref_high === null);
  const hasReportMarker = rows.some((r) => r.flag_source === 'report_marker');
  const markerNormal = normal.some((r) => r.flag_source === 'report_marker');
  const first = flagged.length > 0
    ? `Ask about first: ${flagged.map((r) => `${r.test_name} (${val(r)}, ${r.flag})`).join(', ')}.`
    : hasReportMarker ? 'No results were outside a printed range or marked High or Low by the report.' : 'No values were outside the ranges printed on this report.';
  const second = normal.length > 0
    ? `${normal.length} result${normal.length === 1 ? '' : 's'} ${normal.length === 1 ? 'was' : 'were'} ${markerNormal ? 'inside a printed range or marked Normal by the report' : 'inside the printed range'}.`
    : 'No results were inside a printed range in this report.';
  const third = noRange.length > 0
    ? `${noRange.length} result${noRange.length === 1 ? '' : 's'} had no range printed on the report${unknown.length > 0 ? ', so some could not be flagged' : ''}. Ask your doctor what range applies.`
    : 'Every result in this report had a range printed on it.';
  return [first, second, third];
}

export function priorityRows<T extends { flag: Flag }>(rows: T[]): T[] {
  return rows.filter((r) => r.flag === 'High' || r.flag === 'Low' || r.flag === 'Unknown').slice(0, 3);
}

function questionFor(r: LabRow): string {
  if (r.value === null) {
    const range = describeRange(r.ref_low, r.ref_high, r.unit);
    return range
      ? `My ${r.test_name} did not show a numeric value, so it could not be compared with the printed range of ${range}. What should I ask about this result?`
      : `My ${r.test_name} did not show a numeric value or printed range, but the report marks it ${r.flag}. What should I ask about this result?`;
  }
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

export function plainEnglishFor(testName: string, value: number | null, unit: string, refLow: number | null, refHigh: number | null, flag: Flag): string {
  if (value === null) {
    if (refLow === null && refHigh === null && flag !== 'Unknown') return `${testName} did not show a numeric value. The report marks it ${flag}, and no range was printed.`;
    return `${testName} did not show a numeric value, so it could not be compared with a printed range.`;
  }
  const v = formatValue(value, unit);
  const ranged = refLow !== null || refHigh !== null;
  if (flag === 'Unknown') return `${testName} was ${v}, but no range was printed on this report, so we cannot say if it is inside or outside a range.`;
  if (!ranged) return `${testName} was ${v}. The report itself marks it ${flag}, but it prints no range.`;
  if (flag === 'High') return `${testName} was ${v}, which is higher than the range printed on this report.`;
  if (flag === 'Low') return `${testName} was ${v}, which is lower than the range printed on this report.`;
  return `${testName} was ${v}, which is inside the range printed on this report.`;
}
