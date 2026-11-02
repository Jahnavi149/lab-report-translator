import { NextResponse } from 'next/server';
import { museConfigured, translateWithMuse } from '@/lib/muse';
import { rateLimited } from '@/lib/ratelimit';
import { LANGUAGES, type Language } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const isStringArray = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every((s) => typeof s === 'string' && s.length <= 500);

export async function POST(req: Request) {
  try {
    if (!museConfigured()) return NextResponse.json({ error: 'Translation is not available.' }, { status: 501 });
    if (rateLimited(req, 'translate', 30)) return NextResponse.json({ error: 'Too many translation requests. Please wait a few minutes.' }, { status: 429 });
    const raw = await req.text();
    if (raw.length > 30000) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
    const body = JSON.parse(raw) as { summary?: unknown; questions?: unknown; explanations?: unknown; language?: unknown };
    const language = body.language as Language;
    if (!LANGUAGES.includes(language) || language === 'en') return NextResponse.json({ error: 'Unsupported language.' }, { status: 400 });
    const explanations = body.explanations && typeof body.explanations === 'object' ? Object.entries(body.explanations as Record<string, unknown>) : [];
    if (!isStringArray(body.summary, 3) || !isStringArray(body.questions, 3) || explanations.length > 60 || !explanations.every(([k, v]) => k.length <= 80 && typeof v === 'string' && v.length <= 500)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }
    const translated = await translateWithMuse({ summary: body.summary, questions: body.questions, explanations: Object.fromEntries(explanations) as Record<string, string> }, language);
    return NextResponse.json({ ...translated, muse_used: true });
  } catch (e) {
    console.error('Translate failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Translation failed.' }, { status: 502 });
  }
}
