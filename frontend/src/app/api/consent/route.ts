import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Minimal server-side read of your consent cookie for gating server features later.
// GET returns { status: 'granted' | 'denied' | 'unset' }

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const store = await cookies();
    const status = store.get('promagen_consent')?.value ?? 'unset';
    return NextResponse.json({ ok: true, data: { status } }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error)?.message ?? 'Failed to read consent' },
      { status: 500 },
    );
  }
}
