import { NextResponse } from 'next/server';
import { museConfigured, museDisabled, museModel } from '@/lib/muse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // read env at request time, never bake it in at build

export async function GET() {
  return NextResponse.json({ muse_configured: museConfigured(), muse_disabled: museDisabled(), muse_model: museModel() });
}
