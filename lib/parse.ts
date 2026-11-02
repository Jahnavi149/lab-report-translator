import { flagFor, plainEnglishFor } from './flags';
import { sanitizeTestName } from './safety';
import type { Flag, FlagSource, LabRow } from './types';

const NUM = '\\d[\\d,]*(?:\\.\\d+)?';
const num = (s: string) => Number(s.replace(/,/g, ''));

// Lines that are headers, identifiers or dates, never results.
const NOT_A_RESULT = /^(patient|date|lab\w*|report\w*|test\s+result|name|age\b|sex\b|gender|dob|phone|page\b|collected|received|printed|ordered|specimen|accession|sample|ref(erred)?\b|dr\b|physician|address|synthetic)/i;
const NOT_A_UNIT = /^(h|l|high|low|normal|abnormal|critical|final|pending|to|and|or|ref|range|result|flag)$/i;
const UNIT_TOKEN = /^(?:x?10[\^*Ee]\d+\/[A-Za-zµμ]+|[A-Za-zµμ%/][^\s()<>≤≥]*)$/;

export interface ParseResult {
  rows: LabRow[];
  /** Lines that looked like results (a name followed by a number) but could not be read safely. */
  skipped: string[];
}

function findValue(line: string): { name: string; value: number; after: string } | null {
  const re = new RegExp(`(?<=^|\\s)(${NUM})(?=\\s|$|[A-Za-zµμ%])`, 'g');
  for (const m of line.matchAll(re)) {
    const idx = m.index ?? 0;
    const before = line.slice(0, idx).trim();
    const after = line.slice(idx + m[1]!.length);
    if (!before || !/[\p{L})]/u.test(before)) continue;
    // "25-Hydroxy": a number glued to a hyphenated word is part of the test name.
    if (/^-[A-Za-z]/.test(after)) continue;
    // A qualified result ("<0.5") or an earlier standalone number in the name means we cannot trust this split.
    if (/[<>≤≥]\s*$/.test(before)) return null;
    if (/(^|\s)[<>≤≥]?\d[\d.,]*(\s|$)/.test(before)) return null;
    return { name: before.replace(/[:\-]\s*$/, '').trim(), value: num(m[1]!), after: after.trim() };
  }
  return null;
}

function splitUnit(after: string): { unit: string; rest: string } {
  const [first = '', ...others] = after.split(/\s+/);
  if (first && !NOT_A_UNIT.test(first) && UNIT_TOKEN.test(first)) return { unit: first, rest: others.join(' ') };
  return { unit: '', rest: after };
}

function parseRange(rest: string): { low: number | null; high: number | null; ambiguous: boolean } {
  const cleaned = rest.replace(/[()[\]]/g, ' ');
  const dashes = [...cleaned.matchAll(new RegExp(`(${NUM})\\s*(?:-|to)\\s*(${NUM})`, 'gi'))];
  const lowers = [...cleaned.matchAll(new RegExp(`[>≥]\\s*=?\\s*(${NUM})`, 'g'))];
  const uppers = [...cleaned.matchAll(new RegExp(`[<≤]\\s*=?\\s*(${NUM})`, 'g'))];
  if (dashes.length === 1 && lowers.length === 0 && uppers.length === 0) return { low: num(dashes[0]![1]!), high: num(dashes[0]![2]!), ambiguous: false };
  if (dashes.length === 0 && lowers.length <= 1 && uppers.length <= 1) {
    return { low: lowers[0] ? num(lowers[0][1]!) : null, high: uppers[0] ? num(uppers[0][1]!) : null, ambiguous: false };
  }
  // Several tiers printed (e.g. "Optimal <100, Borderline 130-159, High >160"): refuse to pick one.
  return { low: null, high: null, ambiguous: true };
}

export function parseLabTextDetailed(text: string): ParseResult {
  const rows: LabRow[] = [];
  const skipped: string[] = [];
  const seen = new Map<string, number>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/[–—−]/g, '-').replace(/\s+/g, ' ');
    if (line.length < 4 || NOT_A_RESULT.test(line)) continue;
    if (!/\d/.test(line)) continue;

    const found = findValue(line);
    if (!found) {
      if (/^[\p{L}][\p{L}\p{N} ,.()/%+:'-]{2,}\s[<>≤≥]?\d/u.test(line)) skipped.push(line);
      continue;
    }
    let testName = sanitizeTestName(found.name);
    if (!testName || !/\p{L}/u.test(testName) || /^(page|total|reference|normal|high|low)$/i.test(testName)) continue;

    const { unit: rawUnit, rest } = splitUnit(found.after);
    const unit = rawUnit;
    let marker: 'High' | 'Low' | null = null;
    const markerMatch = rest.match(/(?:^|\s)(H|HIGH|High|L|LOW|Low)\s*\*?$/);
    if (markerMatch?.[1]) marker = /^h/i.test(markerMatch[1]) ? 'High' : 'Low';

    const { low, high, ambiguous } = parseRange(rest.replace(/(?:^|\s)(H|HIGH|High|L|LOW|Low)\s*\*?$/, ''));

    let flag: Flag = flagFor(found.value, low, high);
    let flagSource: FlagSource = low === null && high === null ? 'none' : 'range';
    let reviewReason: string | undefined;
    if (flagSource === 'none' && marker) { flag = marker; flagSource = 'report_marker'; reviewReason = `No range is printed. The ${marker} flag is copied from the report's own marker.`; }
    else if (flagSource === 'none') reviewReason = ambiguous ? 'Several different ranges are printed for this test, so none was chosen. Ask your doctor which applies.' : 'No range is printed for this test.';

    // Duplicate names (e.g. a repeated page) get a suffix so they never overwrite each other.
    const key = testName.toLowerCase();
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > 1) testName = `${testName} (${n})`;

    rows.push({
      test_name: testName,
      value: found.value,
      unit,
      ref_low: low,
      ref_high: high,
      flag,
      flag_source: flagSource,
      plain_english: plainEnglishFor(testName, found.value, unit, low, high, flag),
      confidence: reviewReason ? 'low' : 'high',
      ...(reviewReason ? { review_reason: reviewReason } : {}),
      source_text: line,
    });
  }
  return { rows, skipped };
}

export function parseLabText(text: string): LabRow[] {
  return parseLabTextDetailed(text).rows;
}
