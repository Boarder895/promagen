import { NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.text();
    const upstream = await fetch(`${API_BASE}/api/providers/${params.id}/override`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
    });
    const type = upstream.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await upstream.json() : await upstream.text();
    return NextResponse.json(payload as any, { status: upstream.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'proxy_failed', message: e?.message }, { status: 502 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const upstream = await fetch(`${API_BASE}/api/providers/${params.id}/override`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    const type = upstream.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await upstream.json() : await upstream.text();
    return NextResponse.json(payload as any, { status: upstream.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'proxy_failed', message: e?.message }, { status: 502 });
  }
}