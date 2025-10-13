<<<<<<< HEAD
﻿import { NextResponse } from 'next/server';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function GET() {
  try {
    const r = await fetch(`${API}/health`, { cache: 'no-store' });
    const text = await r.text();
    try {
      return NextResponse.json(JSON.parse(text), { status: r.status });
    } catch {
      return NextResponse.json({ passthrough: text }, { status: r.status });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Bad Gateway', detail: e?.message, target: `${API}/health` },
      { status: 502 },
    );
  }
}
=======
import { NextRequest, NextResponse } from 'next/server';

function normalizeBase(b: string | null): string {
  const base =
    (b && b.trim()) ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://promagen-api.fly.dev';
  return base.replace(/\/+$/, '');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const base = normalizeBase(searchParams.get('base'));
  const upstream = `${base}/health`;

  try {
    const res = await fetch(upstream, { cache: 'no-store' });
    const text = await res.text().catch(() => '');
    return new NextResponse(text || '', { status: res.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return new NextResponse('unreachable', { status: 502 });
  }
}


>>>>>>> 2ae501b4f413143a9435e5c577312aa7dbda9955
