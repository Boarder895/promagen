// src/app/api/admin/sync\route.ts
import { NextRequest, NextResponse } from 'next/server';
import requireAdmin from '@/lib/requireAdmin';
import rateLimit from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const limit = Number(process.env.ADMIN_RATE_LIMIT ?? 30);
    const windowMs = Number(process.env.ADMIN_RATE_WINDOW_MS ?? 60_000);

    const r = rateLimit(req, 'admin:sync', limit, windowMs);
    if (!r.ok) {
      return NextResponse.json(
        { error: 'Too Many Requests', retryAfterSeconds: Math.ceil(r.retryAfterMs / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(r.retryAfterMs / 1000)) } }
      );
    }

    // TODO: your real sync work here
    return NextResponse.json({ ok: true, ts: Date.now() });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

