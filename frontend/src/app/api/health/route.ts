// Simple health endpoint aligned to Promagen standards.
// - No PII, no secrets.
// - Fast JSON, cache disabled, CORS open for GET.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function headers() {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, no-cache, must-revalidate',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
  };
}

export async function GET() {
  const payload = {
    ok: true,
    service: 'promagen-frontend',
    env: process.env.NODE_ENV ?? 'development',
    asOf: new Date().toISOString(),
  };
  return new NextResponse(JSON.stringify(payload), { status: 200, headers: headers() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: headers() });
}
