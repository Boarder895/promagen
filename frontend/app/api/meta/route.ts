import { NextResponse } from 'next/server';
const API_BASE = process.env.API_BASE || 'http://localhost:3001';

export async function GET() {
  const upstream = await fetch(`${API_BASE}/api/v1/meta`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const type = upstream.headers.get('content-type') || '';
  const payload = type.includes('application/json')
    ? await upstream.json()
    : await upstream.text();
  return NextResponse.json(payload as any, { status: upstream.status });
}
