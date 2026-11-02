import { NextResponse } from 'next/server';
import { enhanceWithMuse } from '@/lib/enhance';
import { applyFlags, plainEnglishFor } from '@/lib/flags';
import { extractFromImageWithMuse, museConfigured } from '@/lib/muse';
import { parseLabTextDetailed } from '@/lib/parse';
import { extractPdfText } from '@/lib/pdftext';
import { rateLimited } from '@/lib/ratelimit';
import { verifyRows } from '@/lib/verify';
import type { LabReport, LabRow } from '@/lib/types';

export const runtime = 'nodejs';
// A photo does a vision call and then the explain/summary/questions jobs, each allowed up to the Muse timeout.
// Hosts cap this value by plan (e.g. Vercel); on a 60 s plan, lower MUSE_TIMEOUT_MS to about 25000.
export const maxDuration = 120;

const MAX_BYTES = 10 * 1024 * 1024;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

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
      const text = await extractPdfText(buffer);
      const parsed = parseLabTextDetailed(text);
      if (parsed.rows.length === 0) return fail('No lab results could be read from this file. If it is a scan or photo, upload it as an image instead, or try a sample report.');
      const verification = verifyRows(parsed.rows, text);
      const enhanced = await enhanceWithMuse(verification.rows, { sourceText: text });
      const museNote = enhanced.flaggedByMuse.length > 0 ? ` Muse's second check also could not confirm: ${enhanced.flaggedByMuse.join(', ')}.` : '';
      const skippedNote = parsed.skipped.length > 0 ? ` ${parsed.skipped.length} line${parsed.skipped.length === 1 ? '' : 's'} looked like results but could not be read safely and ${parsed.skipped.length === 1 ? 'was' : 'were'} left out.` : '';
      report = {
        id: 'uploaded', title: file.name.slice(0, 120), is_synthetic: false,
        rows: enhanced.rows, summary: enhanced.summary, questions: enhanced.questions,
        verification_passed: verification.passed && enhanced.flaggedByMuse.length === 0 && parsed.skipped.length === 0,
        verification_note: `${verification.note}${museNote}${skippedNote}`,
        source_note: 'Read from your PDF. Kept in memory for this session only; cleared when you press Clear report.',
        muse_used: enhanced.features.length > 0, muse_features: enhanced.features,
        skipped_lines: parsed.skipped.slice(0, 10),
      };
    } else {
      if (!museConfigured()) return fail('Reading photos needs Muse Spark. Add META_MODEL_API_KEY to .env.local (or your hosting settings) and restart. Digital PDFs and sample reports work without a key.');
      if (rateLimited(req, 'vision', 10)) return fail('Too many photo uploads from this connection. Please wait a few minutes and try again.', 429);
      const vision = await extractFromImageWithMuse(buffer, `image/${kind}`);
      if (vision.length === 0) return fail('No lab results could be read from this photo. Try a flatter, brighter, closer photo, or upload a digital PDF.');
      const seen = new Map<string, number>();
      const rows: LabRow[] = applyFlags(vision).map((r) => {
        const n = (seen.get(r.test_name.toLowerCase()) ?? 0) + 1;
        seen.set(r.test_name.toLowerCase(), n);
        const name = n > 1 ? `${r.test_name} (${n})` : r.test_name;
        const ranged = r.ref_low !== null || r.ref_high !== null;
        return {
          test_name: name, value: r.value, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high, flag: r.flag,
          flag_source: ranged ? 'range' : 'none',
          plain_english: plainEnglishFor(name, r.value, r.unit, r.ref_low, r.ref_high, r.flag),
          confidence: 'low',
          review_reason: r.consistent ? 'Read from a photo: check this row against your original.' : 'Read from a photo, and the numbers do not all match the line that was quoted. Check this row against your original.',
          source_text: r.source_text,
        };
      });
      const enhanced = await enhanceWithMuse(rows);
      report = {
        id: 'uploaded', title: file.name.slice(0, 120), is_synthetic: false,
        rows: enhanced.rows, summary: enhanced.summary, questions: enhanced.questions,
        verification_passed: false,
        verification_note: 'Read from a photo with Muse Spark vision. A photo cannot be checked against document text the way a digital PDF can, so every row is marked Needs Review. Please compare each value with your original report before sharing.',
        source_note: 'Read from your photo. Kept in memory for this session only; cleared when you press Clear report.',
        muse_used: true, muse_features: ['photo reading', ...enhanced.features],
      };
    }
    return NextResponse.json(report);
  } catch (e) {
    console.error('Analyze failed:', e instanceof Error ? e.message : e);
    return fail('Something went wrong reading that file. Please try again, or try a sample report.', 500);
  }
}
