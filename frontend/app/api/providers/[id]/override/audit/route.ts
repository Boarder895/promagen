import { NextResponse } from 'next/server';
const API_BASE = process.env.API_BASE || 'http://localhost:3001';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const upstream = await fetch(`${API_BASE}/api/providers/${params.id}/override/audit?limit=10`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const type = upstream.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await upstream.json() : await upstream.text();
    return NextResponse.json(payload as any, { status: upstream.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'proxy_failed', message: e?.message }, { status: 502 });
  }
}

