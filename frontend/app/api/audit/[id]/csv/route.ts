import type { NextRequest } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export async function GET(
  _req: NextRequest,
  ctx: Promise<{ params: { id: string } }>
) {
  const { id } = (await ctx).params;

  const upstream = await fetch(`${API_BASE}/api/audit/${id}`, { cache: 'no-store' });
  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

