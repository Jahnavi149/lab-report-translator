import { questionsFor, summaryFor } from './flags';
import { explainWithMuse, questionsWithMuse, summarizeWithMuse, verifyWithMuse } from './muse';
import { toCheckItems, toMuseSafe } from './privacy';
import { screenCheckItems } from './privacyModel';
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
 *
 * Privacy: this is the only door to Muse. Rows are converted to MuseSafeRow here (name, value, unit, range, flag and
 * nothing else), and the second-pass check gets each row's own redacted result line, never the report text.
 * If a test name itself looks like an identifier, that row is left out and the whole-report summary and questions
 * use the code-written text, so the identifier cannot appear in any request.
 */
export async function enhanceWithMuse(rows: LabRow[], opts: { check?: boolean } = {}): Promise<Enhancement> {
  const baseSummary = summaryFor(rows);
  const baseQuestions = questionsFor(rows);
  const safe = toMuseSafe(rows);
  const everyRowSafe = safe.length === rows.length;
  // Result lines are checked by patterns and the unexplained-word rule (toCheckItems), then by the privacy model.
  const checkItems = opts.check ? (await screenCheckItems(toCheckItems(rows))).items : [];
  const skip = <T>(v: T) => Promise.resolve(v);
  const [explain, summary, questions, check] = await Promise.allSettled([
    safe.length > 0 ? explainWithMuse(safe) : skip({} as Record<string, string>),
    everyRowSafe ? summarizeWithMuse(safe) : Promise.reject(new Error('a test name looked like an identifier; using the code-written summary')),
    everyRowSafe ? questionsWithMuse(safe) : skip([] as string[]),
    checkItems.length > 0 ? verifyWithMuse(checkItems) : skip([] as string[]),
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
    if (checkItems.length > 0) features.push('second-pass check');
    flaggedByMuse = check.value;
    if (flaggedByMuse.length > 0) {
      out = out.map((r) => (flaggedByMuse.includes(r.test_name) ? { ...r, confidence: 'low' as const, review_reason: 'Muse second-pass check could not confirm this row against the document.' } : r));
    }
  } else log('second-pass check', check);

  return { rows: out, summary: finalSummary, questions: finalQuestions, features, flaggedByMuse };
}
