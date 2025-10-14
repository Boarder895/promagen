import { NextResponse } from 'next/server';
import { refreshProviders } from '@/lib/providerState';

export async function POST() {
  try {
    const result = await refreshProviders();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
