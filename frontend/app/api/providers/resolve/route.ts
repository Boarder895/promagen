import { NextResponse } from 'next/server';
const API_BASE = process.env.API_BASE || 'http://localhost:3001';

export async function POST(req: Request) {
  const body = await req.text();
  const upstream = await fetch(`${API_BASE}/api/providers/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
  });
  const type = upstream.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await upstream.json() : await upstream.text();
  return NextResponse.json(payload as any, { status: upstream.status });
}
