import { NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

export async function GET() {
  try {
    const url = `${API_BASE}/api/providers`;
    const res = await fetch(url, {
      // for local dev we don't need caching; tweak for prod as you wish
      headers: { Accept: 'application/json' },
      // Next.js fetch will throw on network errors but not on non-2xx
      cache: 'no-store',
    });

    const contentType = res.headers.get('content-type') || '';

    // If it's not JSON, return the raw text and status to avoid "<!DOCTYPE" JSON parse explosions
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      return NextResponse.json(
        { ok: false, upstreamStatus: res.status, upstreamBody: text.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: 'upstream_fetch_failed', message: err?.message || 'unknown' },
      { status: 502 },
    );
  }
}




