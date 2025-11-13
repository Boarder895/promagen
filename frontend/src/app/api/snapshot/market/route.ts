// Market snapshot endpoint (frontend read-only).
// Returns a deterministic snapshot derived from the exchanges catalog +
// a small "status" shim so UI/tests have something truthful to render.

import { NextResponse } from 'next/server';
import exchanges from '@/data/exchanges.catalog.json';

type Exchange = {
  id: string;
  city: string;
  exchange: string;
  country: string;
  iso2: string;
  tz: string;
  longitude: number;
};

export const dynamic = 'force-dynamic';

function headers() {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 's-maxage=60, stale-while-revalidate=300',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
  };
}

function statusForTZ(tz: string, now = new Date()): 'OPEN' | 'CLOSED' | 'PRE' | 'POST' {
  // Very light, test-friendly heuristic:
  // treat 09:00–16:00 local as OPEN, 08:30–09:00 PRE, 16:00–16:30 POST, otherwise CLOSED.
  try {
    const local = new Date(now.toLocaleString('en-GB', { timeZone: tz }));
    const mins = local.getHours() * 60 + local.getMinutes();
    if (mins >= 9 * 60 && mins < 16 * 60) return 'OPEN';
    if (mins >= 8 * 60 + 30 && mins < 9 * 60) return 'PRE';
    if (mins >= 16 * 60 && mins < 16 * 60 + 30) return 'POST';
  } catch {
    // ignore tz errors -> CLOSED
  }
  return 'CLOSED';
}

export async function GET() {
  const now = new Date();
  const list = (exchanges as Exchange[])
    .filter(e => e && e.id && typeof e.longitude === 'number')
    .sort((a, b) => a.longitude - b.longitude)
    .map(e => ({
      id: e.id,
      city: e.city,
      exchange: e.exchange,
      iso2: e.iso2,
      tz: e.tz,
      longitude: e.longitude,
      status: statusForTZ(e.tz, now),
      localTime: new Date(now.toLocaleString('en-GB', { timeZone: e.tz })).toISOString(),
    }));

  const payload = {
    ok: true,
    asOf: now.toISOString(),
    count: list.length,
    exchanges: list,
  };

  return new NextResponse(JSON.stringify(payload), { status: 200, headers: headers() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: headers() });
}
