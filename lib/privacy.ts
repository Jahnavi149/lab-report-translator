import { looksIdentifying, redactWithAudit, toMuseSafeLine, unexplainedWords } from './safety';
import type { AiInputDisclosure, LabRow, MuseSafeLine, MuseSafeRow } from './types';

// Layer 1 of the privacy design: Muse is only ever handed structured rows.
//
// Every Muse call site in lib/muse.ts accepts `MuseSafeRow[]` (or `MuseSafeLine[]`), never a LabRow, a report
// string or a file name. The brand on those types means the compiler refuses anything that did not come through
// this file or lib/safety.ts. So even if redaction missed an identifier in the report text, that text cannot
// reach the model: it is not an input any Muse function can take.
//
// A MuseSafeRow holds only: test name, value, unit, printed range and the flag the code computed.
// It has no source line, no explanation, no confidence, no review reason and no file name.

/** Copies the allow-listed fields of each row. Rows whose test name carries an identifier are left out. */
export function toMuseSafe(rows: Pick<LabRow, 'test_name' | 'value' | 'unit' | 'ref_low' | 'ref_high' | 'flag'>[]): MuseSafeRow[] {
  return rows
    .filter((r) => !looksIdentifying(r.test_name))
    .map((r) => ({ test_name: r.test_name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high, flag: r.flag }) as MuseSafeRow);
}

/** A result row plus the one report line it was read from, for the second-pass check. */
export interface MuseCheckItem { row: MuseSafeRow; line: MuseSafeLine }

/**
 * Pairs each safe row with its own redacted source line. Only result lines go out, never the header or the rest
 * of the document. Fail closed: a line is withheld (the row just is not second-checked) if the redactor found an
 * identifier in it, or if it contains any word that is not the test name, its unit or ordinary result vocabulary
 * ("Optimal", "High", ...). That second rule is what catches a name printed in a result line with no label.
 */
export function toCheckItems(rows: LabRow[]): MuseCheckItem[] {
  const items: MuseCheckItem[] = [];
  for (const r of rows) {
    const [row] = toMuseSafe([r]);
    const line = toMuseSafeLine(r.source_text);
    if (row && line && unexplainedWords(line, r).length === 0) items.push({ row, line });
  }
  return items;
}

/**
 * Builds the "What the AI sees" record: the exact rows and lines handed to Muse, plus an audit of the identifiers
 * the redactor found in the full report text (which, by design, is never sent). `reportText` is only inspected
 * here, on the server, to count; it is not stored or sent anywhere.
 */
export function buildAiInput(rows: LabRow[], opts: { reportText?: string; photo: boolean; checked: boolean }): AiInputDisclosure {
  const removed = opts.reportText ? redactWithAudit(opts.reportText).removed : [];
  return {
    rows: toMuseSafe(rows).map((r) => ({ test_name: r.test_name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high, flag: r.flag })),
    source_lines: opts.checked ? toCheckItems(rows).map((i) => i.line) : [],
    photo: opts.photo,
    lines_withheld: opts.checked ? rows.length - toCheckItems(rows).length : 0,
    identifiers_removed: removed.length,
    removed_kinds: [...new Set(removed.map((r) => r.kind))],
  };
}
