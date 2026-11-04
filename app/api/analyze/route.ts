import { NextResponse } from 'next/server';
import { enhanceWithMuse } from '@/lib/enhance';
import { flagForQualified, flagFromEvidence, plainEnglishFor } from '@/lib/flags';
import { extractFromImageWithMuse, extractFromPdfTextWithMuse, museConfigured } from '@/lib/muse';
import { matchRowToLine, type OcrLine } from '@/lib/ocr';
import { PHOTO_REFUSAL_MESSAGES, redactPhoto } from '@/lib/photo';
import { buildAiInput, toMuseSafeReportText } from '@/lib/privacy';
import { extractPdfTextWithAnchors } from '@/lib/pdftext';
import { rateLimited } from '@/lib/ratelimit';
import { qualifierOf, verifyRows } from '@/lib/verify';
import { redactForMuse } from '@/lib/safety';
import type { Flag, FlagSource, LabReport, LabRow } from '@/lib/types';

export const runtime = 'nodejs';
// A photo does a vision call and then the explain/summary/questions jobs, each allowed up to the Muse timeout.
// Hosts cap this value by plan (e.g. Vercel); on a 60 s plan, lower MUSE_TIMEOUT_MS to about 25000.
export const maxDuration = 120;

const MAX_BYTES = 10 * 1024 * 1024;
const citationBox = (test_name: string, r: { value: number | null; unit: string; ref_low: number | null; ref_high: number | null; reported_verdict: 'High' | 'Low' | 'Normal' | null }, ocr: OcrLine[]) => {
  const box = matchRowToLine({ test_name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high, flag: r.reported_verdict ?? 'Unknown' }, ocr);
  return box ? { source_box: box } : {};
};
/**
 * A value printed as a limit ("<0.3", ">60") is not an exact number. When every possible true value falls on the same side
 * of the printed range, the flag is still decided by code; otherwise it stays Unknown and the row is sent to review.
 */
function withLimit(line: string, value: number | null, low: number | null, high: number | null, resolved: { flag: Flag; source: FlagSource }) {
  const qualifier = value === null ? null : qualifierOf(line, value);
  if (!qualifier || value === null) return { ...resolved, qualifier: undefined, reason: undefined };
  if (resolved.source !== 'range') return { ...resolved, qualifier, reason: undefined };
  const flag = flagForQualified(qualifier, value, low, high);
  return flag === 'Unknown'
    ? { flag, source: 'none' as FlagSource, qualifier, reason: `The report prints this value as a limit (${qualifier}${value}), not an exact number, so it could not be compared with the printed range. Check it against your original.` }
    : { flag, source: resolved.source, qualifier, reason: undefined };
}
const QUALITATIVE = /\b(negative|positive|non[- ]?reactive|reactive|not detected|detected|absent|present|trace|abnormal)\b/i;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const normalizeLine = (line: string) => line.trim().replace(/[\u2013\u2014\u2212]/g, '-').replace(/\s+/g, ' ');

// Trust file contents, not the filename or the declared MIME type.
function sniff(buf: Buffer): 'pdf' | 'png' | 'jpeg' | 'webp' | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

export async function POST(req: Request) {
  try {
    if (rateLimited(req, 'analyze', 30)) return fail('Too many uploads from this connection. Please wait a few minutes and try again.', 429);
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return fail('Please choose a file.');
    if (file.size > MAX_BYTES) return fail('That file is over 10 MB. Please try a smaller file.');
    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = sniff(buffer);
    if (!kind) return fail('Please upload a digital PDF or a photo of a lab report (JPG, PNG, or WebP).');

    let report: LabReport;
    if (kind === 'pdf') {
      if (!museConfigured()) return fail('PDF reading is not available right now because the model is not configured.', 503);
      const extracted = await extractPdfTextWithAnchors(buffer);
      const text = extracted.text;
      if (!text.trim()) return fail('No selectable text was found in this PDF. If it is a scan, upload it as an image instead.');
      const safePdf = toMuseSafeReportText(text);
      if (!safePdf.text.trim()) return fail('No report text remained after the privacy check. Please try a report with a clearly separated results table.');

      // Muse chooses the semantic table fields. Code accepts only rows grounded in an exact redacted PDF line,
      // then reconnects that line to the original PDF coordinates for verification and source highlighting.
      const extractedRows = await extractFromPdfTextWithMuse(safePdf.text);
      const sourceLines = text.split(/\r?\n/).map((line, index) => ({
        index,
        original: normalizeLine(line),
        redacted: normalizeLine(redactForMuse(line)),
      }));
      const usedLines = new Set<number>();
      const seen = new Map<string, number>();
      const rows: LabRow[] = [];
      for (const r of extractedRows) {
        if (!r.consistent) continue;
        const match = sourceLines.find((line) => !usedLines.has(line.index) && line.redacted === normalizeLine(r.source_text));
        if (!match || !match.original) continue;
        usedLines.add(match.index);
        const key = r.test_name.toLocaleLowerCase();
        const n = (seen.get(key) ?? 0) + 1;
        seen.set(key, n);
        const name = n > 1 ? `${r.test_name} (${n})` : r.test_name;
        const printed = flagFromEvidence(r.value, r.ref_low, r.ref_high, r.reported_verdict);
        const limit = withLimit(match.original, r.value, r.ref_low, r.ref_high, printed);
        const resolved = { flag: limit.flag, source: limit.source };
        const reviewReason = limit.reason ?? (r.value === null
          ? resolved.source === 'report_marker'
            ? `No numeric value or range is printed. The ${resolved.flag} flag is copied from the report's own verdict.`
            : 'No numeric value is printed for this test.'
          : resolved.source === 'report_marker'
            ? `No range is printed. The ${resolved.flag} flag is copied from the report's own verdict.`
            : resolved.source === 'none' ? 'No range is printed for this test.' : undefined);
        rows.push({
          test_name: name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high, flag: resolved.flag,
          flag_source: resolved.source,
          ...(limit.qualifier ? { qualifier: limit.qualifier } : {}),
          plain_english: plainEnglishFor(name, r.value, r.unit, r.ref_low, r.ref_high, resolved.flag, limit.qualifier),
          confidence: reviewReason ? 'low' : 'high',
          ...(reviewReason ? { review_reason: reviewReason } : {}),
          source_text: match.original,
          ...(extracted.lineAnchors[match.index] ? { source_anchor: extracted.lineAnchors[match.index] } : {}),
        });
      }
      if (rows.length === 0) return fail('No lab results could be grounded in this PDF text. If it is a scan, upload it as an image instead, or try a clearer digital PDF.');
      // Results written in words ("Negative", "Reactive") have no number to compare, so they are not rows. Say so, never drop them silently.
      const notRead = sourceLines
        .filter((l) => !usedLines.has(l.index) && l.redacted.length > 0 && l.redacted.length <= 160 && QUALITATIVE.test(l.redacted) && /[A-Za-z]{3,}.*[A-Za-z]{3,}/.test(l.redacted))
        .map((l) => l.redacted).slice(0, 12);
      const verification = verifyRows(rows, text);
      const enhanced = await enhanceWithMuse(verification.rows, { check: true });
      const museNote = enhanced.flaggedByMuse.length > 0 ? ` Muse's second check also could not confirm: ${enhanced.flaggedByMuse.join(', ')}.` : '';
      report = {
        id: 'uploaded', title: file.name.slice(0, 120), is_synthetic: false, source_kind: 'pdf',
        rows: enhanced.rows, summary: enhanced.summary, questions: enhanced.questions,
        verification_passed: verification.passed && enhanced.flaggedByMuse.length === 0,
        verification_note: `${verification.note}${museNote}`,
        ...(notRead.length > 0 ? { skipped_lines: notRead } : {}),
        source_note: 'Read from your PDF. Kept in memory for this session only; cleared when you press Clear report.',
        muse_used: true, muse_features: ['PDF text extraction', ...enhanced.features],
        ai_input: buildAiInput(enhanced.rows, { reportText: text, redactedReportText: safePdf.text, photo: false, checked: true }),
      };
    } else {
      if (!museConfigured()) return fail('Photo reading is not available right now. Please upload a digital PDF instead.', 503);
      if (rateLimited(req, 'vision', 10)) return fail('Too many photo uploads from this connection. Please wait a few minutes and try again.', 429);
      // The picture is cleaned first: identifiers are found locally (patterns) and painted
      // out of the pixels, and the painted picture is read again to prove they are gone. Only that picture can be sent.
      const cleaned = await redactPhoto(buffer);
      if (!cleaned.ok) return fail(PHOTO_REFUSAL_MESSAGES[cleaned.reason], cleaned.reason === 'no_ocr' ? 503 : 422);
      // Muse reads the values from the cleaned picture; the lines the local OCR read from the original place the citations.
      const vision = await extractFromImageWithMuse(cleaned.photo);
      const ocr = cleaned.lines;
      if (vision.length === 0) return fail('No lab results could be read from this photo. Try a flatter, brighter, closer photo, or upload a digital PDF.');
      const seen = new Map<string, number>();
      const rows: LabRow[] = vision.map((r) => {
        const n = (seen.get(r.test_name.toLowerCase()) ?? 0) + 1;
        seen.set(r.test_name.toLowerCase(), n);
        const name = n > 1 ? `${r.test_name} (${n})` : r.test_name;
        const printed = flagFromEvidence(r.value, r.ref_low, r.ref_high, r.reported_verdict);
        const limit = withLimit(r.source_text, r.value, r.ref_low, r.ref_high, printed);
        const resolved = { flag: limit.flag, source: limit.source };
        const reviewReason = limit.reason ?? (r.value === null && resolved.source === 'report_marker'
          ? `No numeric value or range is shown. The ${resolved.flag} verdict was read from the photo; check it against the original.`
          : resolved.source === 'report_marker'
            ? `No range is shown. The ${resolved.flag} verdict was read from the photo; check it against the original.`
            : r.consistent ? 'Read from a photo: check this row against your original.' : 'Read from a photo, and the result evidence does not all match the text that was quoted. Check this row against your original.');
        return {
          test_name: name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high, flag: resolved.flag,
          flag_source: resolved.source,
          ...(limit.qualifier ? { qualifier: limit.qualifier } : {}),
          plain_english: plainEnglishFor(name, r.value, r.unit, r.ref_low, r.ref_high, resolved.flag, limit.qualifier),
          confidence: 'low',
          review_reason: reviewReason,
          source_text: r.source_text,
          ...citationBox(name, r, ocr),
        };
      });
      const enhanced = await enhanceWithMuse(rows);
      report = {
        id: 'uploaded', title: file.name.slice(0, 120), is_synthetic: false, source_kind: 'photo',
        rows: enhanced.rows, summary: enhanced.summary, questions: enhanced.questions,
        verification_passed: false,
        verification_note: 'Read from a photo with Muse Spark vision. A photo cannot be checked against document text the way a digital PDF can, so every row is marked Needs Review. Please compare each result with your original report before sharing.',
        source_note: 'Read from your photo. Kept in memory for this session only; cleared when you press Clear report.',
        muse_used: true, muse_features: ['photo reading', ...enhanced.features],
        ai_input: {
          ...buildAiInput(enhanced.rows, { photo: true, checked: false }),
          photo_preview: cleaned.photo.preview, photo_regions: cleaned.photo.regions,
          identifiers_removed: cleaned.photo.regions, removed_kinds: cleaned.photo.kinds,
        },
      };
    }
    return NextResponse.json(report);
  } catch (e) {
    console.error('Analyze failed:', e instanceof Error ? e.message : e);
    return fail('Something went wrong reading that file. Please try again, or try the example report.', 500);
  }
}
