import { NextResponse } from 'next/server';
import { MAX_AUDIO_BYTES, checkWav, cleanKeywords, isAsrLang } from '@/lib/asr';
import { museConfigured, transcribeWithMuse } from '@/lib/muse';
import { rateLimited } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** One spoken question, as a short mono WAV, to Muse Voice Transcribe. Returns text only; nothing is stored. */
export async function POST(req: Request) {
  try {
    if (!museConfigured()) return fail('Voice questions are not available right now.', 503);
    if (rateLimited(req, 'asr', 40)) return fail('Too many voice questions from this connection. Please wait a few minutes and try again.', 429);
    const declared = Number(req.headers.get('content-length') ?? 0);
    if (declared > MAX_AUDIO_BYTES + 20000) return fail('That recording is too long. Please ask a shorter question.', 413);

    let form: FormData;
    try { form = await req.formData(); } catch { return fail('Invalid request.'); }
    const lang = form.get('lang');
    if (!isAsrLang(lang)) return fail('That language is not supported for voice questions.');
    const audio = form.get('audio');
    if (!(audio instanceof Blob)) return fail('The recording was empty.');
    const wav = new Uint8Array(await audio.arrayBuffer());
    const checked = checkWav(wav);
    if (!checked.ok) return fail(checked.error, wav.length > MAX_AUDIO_BYTES ? 413 : 400);

    let keywords: string[] = [];
    const rawKeywords = form.get('keywords');
    if (typeof rawKeywords === 'string' && rawKeywords.length < 4000) { try { keywords = cleanKeywords(JSON.parse(rawKeywords)); } catch { /* no keywords */ } }

    return NextResponse.json({ transcript: await transcribeWithMuse(wav, lang, keywords) });
  } catch (e) {
    console.error('Transcription failed:', e instanceof Error ? e.message : e);
    return fail('The recording could not be turned into text just now. Please try again in a moment.', 502);
  }
}
