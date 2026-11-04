import { flagFor, plainEnglishFor } from './flags';
import { isIdentifyingLine, sanitizeTestName } from './safety';
import type { Flag, FlagSource, LabRow, PdfSourceAnchor } from './types';

// --- Numbers ---------------------------------------------------------------------------------------------
// A number is any run of digits with "." or "," inside it. What the separators MEAN depends on the report: "11,2" is eleven
// point two in French, German, Spanish, Portuguese and Indonesian reports, and "1,234" is one thousand two hundred thirty-four
// in English ones. The convention is read from the whole report (see conventionOf), and a token that fits neither reading is
// refused, never guessed: "11,2" is never silently read as 112.
const NUM = '\\d(?:[\\d.,]*\\d)?';

export type Convention = 'dot' | 'comma';

/** Which decimal mark the report uses, from the numbers it prints. Ties and no evidence mean "dot" (the English convention). */
export function conventionOf(text: string): Convention {
  const tokens = text.match(/(?<![\d.,/])\d+(?:[.,]\d+)+(?![\d.,/])/g) ?? [];
  let comma = 0, dot = 0, thousandsDot = 0;
  for (const t of tokens) {
    if (/^\d+,\d{1,2}$|^\d+,\d{4,}$/.test(t)) comma++;
    else if (/^\d+\.\d{1,2}$|^\d+\.\d{4,}$/.test(t)) dot++;
    else if (/^[1-9]\d{0,2}(\.\d{3}){2,}(,\d+)?$/.test(t)) comma++;
    else if (/^[1-9]\d{0,2}\.\d{3}$/.test(t)) thousandsDot++;
  }
  // Several "7.500"-style numbers and no other evidence: a dot grouping thousands, as in Indonesian and German count columns.
  if (comma === 0 && dot === 0 && thousandsDot >= 2) return 'comma';
  return comma > dot ? 'comma' : 'dot';
}

/** The value of one number token under a convention, or null when it fits neither reading. */
export function numberOf(token: string, conv: Convention): number | null {
  if (/^\d+$/.test(token)) return Number(token);
  const hasComma = token.includes(','), hasDot = token.includes('.');
  if (hasComma && hasDot) {
    const decimalIsComma = token.lastIndexOf(',') > token.lastIndexOf('.');
    if (decimalIsComma) return /^\d{1,3}(\.\d{3})+,\d+$/.test(token) ? Number(token.replace(/\./g, '').replace(',', '.')) : null;
    return /^\d{1,3}(,\d{3})+\.\d+$/.test(token) ? Number(token.replace(/,/g, '')) : null;
  }
  const sep = hasComma ? ',' : '.';
  const parts = token.split(sep);
  const last = parts[parts.length - 1]!;
  if (parts.length > 2) {
    // "1,234,567" (English) or "1.234.567" (German, Indonesian): groups of exactly three.
    const grouped = /^\d{1,3}$/.test(parts[0]!) && parts.slice(1).every((g) => g.length === 3);
    const thousandsMark = conv === 'comma' ? '.' : ',';
    return grouped && sep === thousandsMark ? Number(parts.join('')) : null;
  }
  // One or two, or four or more, digits after the mark: a decimal.
  if (last.length !== 3) return Number(`${parts[0]}.${last}`);
  // Exactly three digits after the mark: a thousands group or a three-place decimal, decided by the report's convention.
  const thousandsMark = conv === 'comma' ? '.' : ',';
  if (sep === thousandsMark) return /^[1-9]\d{0,2}$/.test(parts[0]!) ? Number(parts.join('')) : null;
  return Number(`${parts[0]}.${last}`);
}

// Lines that are headers, identifiers or dates, never results.
const NOT_A_RESULT = /^(patient|date|lab\w*|report\w*|test\s+result|name|age\b|sex\b|gender|dob|phone|page\b|collected|received|printed|ordered|specimen|accession|sample|ref(erred)?\b|dr\b|physician|address|synthetic)/i;
// The same kind of header lines in French, German, Portuguese, Spanish and Indonesian reports (identifier lines are caught by lib/redact.ts).
const NOT_A_RESULT_LOCAL = /^(?:date|datum|data|fecha|tanggal|tgl|page|seite|p[aá]gina|halaman|[aâ]ge|alter|idade|edad|umur|usia|sexe|geschlecht|sexo|jenis kelamin|jahre|ans|anos|a[nñ]os|tahun|impr\w*|druck\w*|edit\w*|prélèvement|prelevement|entnahme|coleta|toma|pengambilan|r[ée]sultats?\s+du|befund|laudo|informe|laporan|hasil pemeriksaan)(?![\p{L}\p{N}])/iu;
const NOT_A_UNIT = /^(h|l|high|low|normal|abnormal|critical|final|pending|to|and|or|ref|range|result|flag)$/i;
// The report's own High / Low marker at the end of a line: H, L, HIGH, LOW, an arrow, or the local word (hoch, élevé, alto, tinggi, ...).
const MARKER = /(?:^|\s)(H|L|HIGH|High|LOW|Low|↑|↓|hoch|niedrig|[ée]lev[ée]e?|bas|basse|alto|alta|baixo|baixa|bajo|baja|tinggi|rendah)\s*\*?$/iu;
const HIGH_MARK = /^(h|high|↑|hoch|[ée]lev[ée]e?|alto|alta|tinggi)$/iu;
const UNIT_TOKEN = /^(?:x?10[\^*Ee]\d+\/[A-Za-zµμ]+|[A-Za-zµμ%/][^\s()<>≤≥]*)$/;

export interface ParseResult {
  rows: LabRow[];
  /** Lines that looked like results (a name followed by a number) but could not be read safely. */
  skipped: string[];
}

function findValue(line: string, conv: Convention): { name: string; value: number; after: string } | null {
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
    let token = m[1]!;
    let rest = after;
    // French and Portuguese print thousands with a space ("250 000 /mm3"). Only read it that way when a unit follows the group,
    // so "140 135 - 145" (a value and a range) is never joined.
    if (conv === 'comma' && /^\d{1,3}$/.test(token)) {
      const grouped = /^ (\d{3})(?= [A-Za-zµμ%/])/.exec(rest);
      if (grouped) { token += grouped[1]; rest = rest.slice(4); }
    }
    const value = numberOf(token, conv);
    if (value === null) return null;
    return { name: before.replace(/[:\-]\s*$/, '').trim(), value, after: rest.trim() };
  }
  return null;
}

function splitUnit(after: string): { unit: string; rest: string } {
  const [first = '', ...others] = after.split(/\s+/);
  if (first && !NOT_A_UNIT.test(first) && UNIT_TOKEN.test(first)) return { unit: first, rest: others.join(' ') };
  return { unit: '', rest: after };
}

// Words that join or bound a printed range, in the languages the app reads. A bound word only counts when no number sits right before it,
// so "150 até 450" is a range (not a range plus an upper bound).
const RANGE_JOIN = '-|to|à|a|bis|até|ate|hasta|s/d|sd|sampai|hingga';
const UPPER_WORD = "under|below|less than|up to|upto|max(?:imum|imal)?|bis|unter|jusqu['’]?à|jusqu['’]?a|moins de|inf[ée]rieur(?:e)? [àa]|menos de|hasta|menor que|até|ate|inferior a|abaixo de|kurang dari|maks";
const LOWER_WORD = "over|above|more than|greater than|min(?:imum|imal)?|über|ueber|mehr als|plus de|sup[ée]rieur(?:e)? [àa]|más de|mas de|mayor que|acima de|superior a|lebih dari|di atas";

function parseRange(rest: string, conv: Convention): { low: number | null; high: number | null; ambiguous: boolean; unreadable: boolean } {
  let cleaned = rest.replace(/[()[\]]/g, ' ');
  // Space-grouped thousands ("150 000 - 400 000") in reports that use a decimal comma.
  if (conv === 'comma') cleaned = cleaned.replace(/(?<![\d.,])(\d{1,3}) (\d{3})(?![\d])/g, '$1$2');
  const dashes = [...cleaned.matchAll(new RegExp(`(${NUM})\\s*(?:${RANGE_JOIN})\\s*(${NUM})`, 'gi'))];
  const lowers = [...cleaned.matchAll(new RegExp(`(?:[>≥]\\s*=?|(?<![\\p{L}\\p{N}])(?<!\\d\\s*)(?:${LOWER_WORD})(?![\\p{L}\\p{N}]))\\s*(${NUM})`, 'giu'))];
  const uppers = [...cleaned.matchAll(new RegExp(`(?:[<≤]\\s*=?|(?<![\\p{L}\\p{N}])(?<!\\d\\s*)(?:${UPPER_WORD})(?![\\p{L}\\p{N}]))\\s*(${NUM})`, 'giu'))];
  const read = (t: string | undefined): number | null => (t === undefined ? null : numberOf(t, conv));
  const none = { low: null, high: null, ambiguous: false, unreadable: false };
  let out;
  if (dashes.length === 1 && lowers.length === 0 && uppers.length === 0) {
    const low = read(dashes[0]![1]), high = read(dashes[0]![2]);
    out = low === null || high === null ? { ...none, unreadable: true } : { ...none, low, high };
  } else if (dashes.length === 0 && lowers.length <= 1 && uppers.length <= 1) {
    const low = read(lowers[0]?.[1]), high = read(uppers[0]?.[1]);
    out = (lowers[0] && low === null) || (uppers[0] && high === null) ? { ...none, unreadable: true } : { ...none, low, high };
  } else {
    // Several tiers printed (e.g. "Optimal <100, Borderline 130-159, High >160"): refuse to pick one.
    out = { ...none, ambiguous: true };
  }
  return out;
}

export function parseLabTextDetailed(text: string, lineAnchors?: PdfSourceAnchor[]): ParseResult {
  const rows: LabRow[] = [];
  const skipped: string[] = [];
  const seen = new Map<string, number>();
  const conv = conventionOf(text);

  for (const [lineIndex, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim().replace(/[–—−]/g, '-').replace(/\s+/g, ' ');
    // "MRN 00481516", "Mobile 9876501234", "Ward 4B": a labelled identifier is never a lab result, even though it is a word followed by a number.
    if (line.length < 4 || NOT_A_RESULT.test(line) || NOT_A_RESULT_LOCAL.test(line) || isIdentifyingLine(line)) continue;
    if (!/\d/.test(line)) continue;

    const found = findValue(line, conv);
    if (!found) {
      if (/^[\p{L}][\p{L}\p{N} ,.()/%+:'-]{2,}\s[<>≤≥]?\d/u.test(line)) skipped.push(line);
      continue;
    }
    let testName = sanitizeTestName(found.name);
    if (!testName || !/\p{L}/u.test(testName) || /^(page|total|reference|normal|high|low)$/i.test(testName)) continue;

    const { unit: rawUnit, rest } = splitUnit(found.after);
    const unit = rawUnit;
    let marker: 'High' | 'Low' | null = null;
    const markerMatch = rest.match(MARKER);
    if (markerMatch?.[1]) marker = HIGH_MARK.test(markerMatch[1]) ? 'High' : 'Low';

    const { low, high, ambiguous, unreadable } = parseRange(rest.replace(MARKER, ''), conv);

    let flag: Flag = flagFor(found.value, low, high);
    let flagSource: FlagSource = low === null && high === null ? 'none' : 'range';
    let reviewReason: string | undefined;
    if (flagSource === 'none' && marker) { flag = marker; flagSource = 'report_marker'; reviewReason = `No range is printed. The ${marker} flag is copied from the report's own marker.`; }
    else if (flagSource === 'none') reviewReason = unreadable ? 'A number in the printed range could not be read safely, so no range was used. Check it against your original.' : ambiguous ? 'Several different ranges are printed for this test, so none was chosen. Ask your doctor which applies.' : 'No range is printed for this test.';

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
      ...(lineAnchors?.[lineIndex] ? { source_anchor: lineAnchors[lineIndex] } : {}),
    });
  }
  return { rows, skipped };
}

export function parseLabText(text: string): LabRow[] {
  return parseLabTextDetailed(text).rows;
}
