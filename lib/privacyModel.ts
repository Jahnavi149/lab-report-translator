import { detectPhi, nerAvailable, nerEnabled, PHI_KIND_LABELS } from './ner';
import type { MuseCheckItem } from './privacy';
import { redactWithAudit } from './redact';
import type { AiInputDisclosure } from './types';

// The opt-in evaluation model (lib/ner.ts, PRIVACY_MODEL=1, off by default) applied to text. In the running app this
// file does nothing: patterns and the "unexplained word" rule in lib/privacy.ts guard every line, and the functions
// below return their input unchanged with engine 'patterns'.

export type Engine = 'patterns+model' | 'patterns';

/**
 * Keeps only the result lines the model finds no identifier in. Model installed but failing: no line is sent
 * (the second check is optional, so failing closed costs only that check). Model not installed: patterns only, and
 * the returned engine says so.
 */
export async function screenCheckItems(items: MuseCheckItem[]): Promise<{ items: MuseCheckItem[]; engine: Engine; withheld: number }> {
  if (!nerEnabled() || !nerAvailable()) return { items, engine: 'patterns', withheld: 0 };
  try {
    const kept: MuseCheckItem[] = [];
    for (const item of items) if ((await detectPhi(item.line)).length === 0) kept.push(item);
    return { items: kept, engine: 'patterns+model', withheld: items.length - kept.length };
  } catch (e) {
    console.error('Privacy model failed on result lines:', e instanceof Error ? e.message : e);
    return { items: [], engine: 'patterns+model', withheld: items.length };
  }
}

/**
 * Adds what the model found in the full report text to the "What the AI sees" record. The model reads the text the
 * patterns already cleaned, so what it reports is in addition to the pattern count. Counts and kinds only, never values.
 * The report text is not sent anywhere: it is inspected here, on the server, to count.
 */
export async function addModelAudit(disclosure: AiInputDisclosure, reportText: string): Promise<AiInputDisclosure> {
  if (!nerEnabled() || !nerAvailable()) return { ...disclosure, engine: 'patterns' };
  try {
    const spans = await detectPhi(redactWithAudit(reportText).redacted);
    const kinds = [...new Set(spans.map((s) => PHI_KIND_LABELS[s.kind]))];
    return {
      ...disclosure, engine: 'patterns+model',
      identifiers_removed: disclosure.identifiers_removed + spans.length,
      removed_kinds: [...new Set([...disclosure.removed_kinds, ...kinds])],
    };
  } catch (e) {
    console.error('Privacy model failed on report text:', e instanceof Error ? e.message : e);
    return { ...disclosure, engine: 'patterns+model' };
  }
}
