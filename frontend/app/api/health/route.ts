import { NextResponse } from 'next/server';
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
