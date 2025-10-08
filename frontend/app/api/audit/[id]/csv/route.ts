import type { NextRequest } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export async function GET(_req: NextRequest, ctx: any) {
  // Next 15 may pass the context as a Promise — don’t over-type it, just await.
  const { id } = (await ctx)?.params ?? {};
  if (!id) {
    return new Response('Missing id', { status: 400 });
  }

  const res = await fetch(`${API_BASE}/api/audit/${id}/csv`, {
    cache: 'no-store',
    headers: { accept: 'text/csv' },
  });

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

