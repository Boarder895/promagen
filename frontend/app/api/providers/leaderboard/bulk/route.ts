import { NextResponse } from 'next/server';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get('format');
  const reviewer = url.searchParams.get('reviewer');
  const period = url.searchParams.get('period');
  const body = await req.text();

  const qs = new URLSearchParams();
  if (format) qs.set('format', format);
  if (reviewer) qs.set('reviewer', reviewer);
  if (period) qs.set('period', period);

  const upstream = await fetch(
    `${API_BASE}/api/v1/providers/leaderboard/bulk${qs.toString() ? `?${qs.toString()}` : ''}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: format === 'csv' ? 'text/csv' : 'application/json' },
      body,
      cache: 'no-store',
    }
  );

  const type = upstream.headers.get('content-type') || '';
  if (type.includes('text/csv')) {
    const csv = await upstream.text();
    return new NextResponse(csv, {
      status: upstream.status,
      headers: { 'Content-Type': 'text/csv; charset=utf-8' },
    });
  }

  const json = await upstream.json();
  return NextResponse.json(json, { status: upstream.status });
}


