// World clocks API — strict types, no 'any', UTF-8 safe, CORS + caching set deliberately.

import { NextResponse } from 'next/server';
import exchangesJson from '@/data/exchanges.catalog.json';

type ClockItem = {
  id: string;
  city: string;
  tz: string;
  iso2: string;
  localISO: string;
};

type ExchangeRow = {
  id: string;
  city: string;
  tz: string;
  iso2: string;
};

// Narrow unknown JSON to the shape we actually use
function isExchangeRow(u: unknown): u is ExchangeRow {
  if (typeof u !== 'object' || u === null) return false;
  const r = u as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.city === 'string' &&
    typeof r.tz === 'string' &&
    typeof r.iso2 === 'string'
  );
}

// Convert imported JSON into a typed array without using 'any'
function getExchanges(): ExchangeRow[] {
  const raw = exchangesJson as unknown;
  if (Array.isArray(raw)) {
    return raw.filter(isExchangeRow);
  }
  // Some catalog builds may export an object with a property (e.g., { exchanges: [...] })
  if (typeof raw === 'object' && raw !== null) {
    const maybe = (raw as Record<string, unknown>).exchanges;
    if (Array.isArray(maybe)) {
      return maybe.filter(isExchangeRow);
    }
  }
  return [];
}

export const dynamic = 'force-dynamic';

function headers() {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 's-maxage=60, stale-while-revalidate=300',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
  };
}

export async function GET() {
  const now = new Date();
  const rows = getExchanges();

  // Cap payload for sanity and determinism in tests
  const clocks: ClockItem[] = rows.slice(0, 64).map((e) => {
    const localISO = new Date(
      now.toLocaleString('en-GB', { timeZone: e.tz })
    ).toISOString();

    return {
      id: e.id,
      city: e.city,
      tz: e.tz,
      iso2: e.iso2,
      localISO,
    };
  });

  const payload = { ok: true, asOf: now.toISOString(), clocks };

  return new NextResponse(JSON.stringify(payload), { status: 200, headers: headers() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: headers() });
}
