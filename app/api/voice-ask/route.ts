import { NextResponse } from 'next/server';
import { museConfigured } from '@/lib/muse';
import { rateLimited } from '@/lib/ratelimit';
import { answerVoiceQuestion, parseVoiceRequest } from '@/lib/voice';

export const runtime = 'nodejs';
export const maxDuration = 60;

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Lets the page know, before the user taps the mic, whether voice questions can work at all (is a Muse key set?). */
export async function GET() {
  return NextResponse.json({ available: museConfigured() });
}

/**
 * One spoken question about the loaded report. The intent is decided by code (lib/voice.ts); Muse only writes the words of an
 * answer inside two intents, and every answer is validated by lib/safety.ts. A failing answer comes back as the redirect line.
 */
export async function POST(req: Request) {
  try {
    if (!museConfigured()) return fail('Voice questions are not available right now.', 503);
    if (rateLimited(req, 'voice', 40)) return fail('Too many voice questions from this connection. Please wait a few minutes and try again.', 429);
    const raw = await req.text();
    if (raw.length > 30000) return fail('Request too large.', 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return fail('Invalid request.'); }
    const parsed = parseVoiceRequest(body);
    if (!parsed.ok) return fail(parsed.error);
    return NextResponse.json(await answerVoiceQuestion(parsed.req));
  } catch (e) {
    console.error('Voice question failed:', e instanceof Error ? e.message : e);
    return fail('The AI could not answer just now. Please try again in a moment.', 502);
  }
}
