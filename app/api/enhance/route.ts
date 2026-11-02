import { NextResponse } from 'next/server';
import { enhanceWithMuse } from '@/lib/enhance';
import { museConfigured } from '@/lib/muse';
import { rateLimited } from '@/lib/ratelimit';
import { sampleById } from '@/lib/samples';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Runs Muse Spark on one of the built-in SYNTHETIC samples. The server looks the sample up by id, so
// this endpoint can only ever process our own invented data, never arbitrary client text.
export async function POST(req: Request) {
  try {
    if (!museConfigured()) return NextResponse.json({ error: 'Muse Spark is not configured on this server.' }, { status: 501 });
    if (rateLimited(req, 'enhance', 20)) return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
    const { id } = await req.json() as { id?: unknown };
    const sample = typeof id === 'string' ? sampleById(id) : undefined;
    if (!sample) return NextResponse.json({ error: 'Unknown sample.' }, { status: 400 });
    const enhanced = await enhanceWithMuse(sample.rows);
    return NextResponse.json({ ...sample, rows: enhanced.rows, summary: enhanced.summary, questions: enhanced.questions, muse_used: enhanced.features.length > 0, muse_features: enhanced.features });
  } catch (e) {
    console.error('Enhance failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Muse did not respond in time. The built-in version is still shown.' }, { status: 502 });
  }
}
