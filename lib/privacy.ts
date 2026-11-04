import { looksIdentifying, redactWithAudit, toMuseSafeLine, unexplainedWords } from './safety';
import type { AiInputDisclosure, LabRow, MuseSafeLine, MuseSafeReportText, MuseSafeRow } from './types';

// Layer 1 of the privacy design: post-extraction Muse jobs are only handed structured rows.
//
// Every Muse call site in lib/muse.ts accepts `MuseSafeRow[]` (or `MuseSafeLine[]`), never a LabRow, a report
// string or a file name. PDF extraction is the deliberate exception: it accepts only `MuseSafeReportText`, which
// is complete selectable text branded here after identifier redaction. The brands make the compiler refuse raw
// rows, raw PDF text and original uploads at model call sites.
//
// A MuseSafeRow holds only: test name, value, unit, printed range and the flag the code computed.
// It has no source line, no explanation, no confidence, no review reason and no file name.

/** Copies the allow-listed fields of each row. Rows whose test name carries an identifier are left out. */
export function toMuseSafe(rows: Pick<LabRow, 'test_name' | 'value' | 'unit' | 'ref_low' | 'ref_high' | 'flag'>[]): MuseSafeRow[] {
  return rows
    .filter((r) => !looksIdentifying(r.test_name))
    .map((r) => ({ test_name: r.test_name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high, flag: r.flag }) as MuseSafeRow);
}

/** The only path by which complete PDF text may reach Muse: redact first, then brand the result. */
export function toMuseSafeReportText(text: string): { text: MuseSafeReportText; identifiersRemoved: number; removedKinds: string[] } {
  const { redacted, removed } = redactWithAudit(text);
  return {
    text: redacted as MuseSafeReportText,
    identifiersRemoved: removed.length,
    removedKinds: [...new Set(removed.map((r) => r.kind))],
  };
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
 * the redactor found in the original report text. For a PDF, `redactedReportText` is the exact complete text that
 * was sent for extraction; the original `reportText` is inspected only on the server for this audit.
 */
export function buildAiInput(rows: LabRow[], opts: { reportText?: string; redactedReportText?: MuseSafeReportText; photo: boolean; checked: boolean }): AiInputDisclosure {
  const removed = opts.reportText ? redactWithAudit(opts.reportText).removed : [];
  return {
    rows: toMuseSafe(rows).map((r) => ({ test_name: r.test_name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high, flag: r.flag })),
    source_lines: opts.checked ? toCheckItems(rows).map((i) => i.line) : [],
    photo: opts.photo,
    ...(opts.redactedReportText ? { redacted_report_text: opts.redactedReportText } : {}),
    lines_withheld: opts.checked ? rows.length - toCheckItems(rows).length : 0,
    identifiers_removed: removed.length,
    removed_kinds: [...new Set(removed.map((r) => r.kind))],
  };
}
