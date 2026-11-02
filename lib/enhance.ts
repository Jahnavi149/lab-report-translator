import { questionsFor, summaryFor } from './flags';
import { explainWithMuse, questionsWithMuse, summarizeWithMuse, verifyWithMuse } from './muse';
import { redactForMuse } from './safety';
import type { LabRow } from './types';

export interface Enhancement {
  rows: LabRow[];
  summary: string[];
  questions: string[];
  features: string[];
  /** Rows the second-pass checker could not confirm. They are downgraded to Needs Review, never edited. */
  flaggedByMuse: string[];
}

/**
 * Runs every Muse job in parallel. A sentence that Muse got wrong, or that fails the safety check, is
 * replaced by the code-written template. Flags, values, units and ranges are never touched here.
 */
export async function enhanceWithMuse(rows: LabRow[], opts: { sourceText?: string } = {}): Promise<Enhancement> {
  const baseSummary = summaryFor(rows);
  const baseQuestions = questionsFor(rows);
  const [explain, summary, questions, check] = await Promise.allSettled([
    explainWithMuse(rows),
    summarizeWithMuse(rows),
    questionsWithMuse(rows),
    opts.sourceText ? verifyWithMuse(redactForMuse(opts.sourceText), rows) : Promise.resolve([] as string[]),
  ]);
  const features: string[] = [];
  const log = (what: string, r: PromiseRejectedResult) => console.error(`Muse ${what} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);

  let out = rows;
  if (explain.status === 'fulfilled') {
    const explained = explain.value;
    if (Object.keys(explained).length > 0) { out = out.map((r) => ({ ...r, plain_english: explained[r.test_name] ?? r.plain_english })); features.push('explanations'); }
  } else log('explanations', explain);

  let finalSummary = baseSummary;
  if (summary.status === 'fulfilled') { finalSummary = summary.value; features.push('summary'); } else log('summary', summary);

  let finalQuestions = baseQuestions;
  if (questions.status === 'fulfilled' && questions.value.length > 0) {
    finalQuestions = [...questions.value, ...baseQuestions.slice(questions.value.length)].slice(0, 3);
    features.push('doctor questions');
  } else if (questions.status === 'rejected') log('questions', questions);

  let flaggedByMuse: string[] = [];
  if (check.status === 'fulfilled') {
    if (opts.sourceText) features.push('second-pass check');
    flaggedByMuse = check.value;
    if (flaggedByMuse.length > 0) {
      out = out.map((r) => (flaggedByMuse.includes(r.test_name) ? { ...r, confidence: 'low' as const, review_reason: 'Muse second-pass check could not confirm this row against the document.' } : r));
    }
  } else log('second-pass check', check);

  return { rows: out, summary: finalSummary, questions: finalQuestions, features, flaggedByMuse };
}
