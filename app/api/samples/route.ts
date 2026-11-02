import { NextResponse } from 'next/server';
import { SAMPLES } from '@/lib/samples';
export async function GET() { return NextResponse.json(SAMPLES); }