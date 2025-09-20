import { NextRequest, NextResponse } from 'next/server';
import { ProvidersSchema } from '@/lib/schemas';

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
  const upstream = `${base}/providers`;

  try {
    const res = await fetch(upstream, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream error ${res.status}`, upstream },
        { status: 502 }
      );
    }
    const data = await res.json();
    const parsed = ProvidersSchema.safeParse(data);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { error: 'Validation failed', upstream, issues },
        { status: 502 }
      );
    }
    return NextResponse.json(parsed.data, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Fetch failed', upstream }, { status: 502 });
  }
}

