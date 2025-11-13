// Ingest endpoint placeholder (frontend-only build).
// We return a safe "disabled" response so tests/builds succeed
// without wiring real ingest in this app layer.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function headers() {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, no-cache, must-revalidate',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
}

export async function POST(req: Request) {
  const body = await (async () => {
    try { return await req.json(); } catch { return null; }
  })();

  const payload = {
    ok: false,
    reason: 'ingest-disabled',
    message: 'Market ingest is disabled in the frontend build.',
    received: body ?? null,
    asOf: new Date().toISOString(),
  };

  return new NextResponse(JSON.stringify(payload), { status: 501, headers: headers() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: headers() });
}
