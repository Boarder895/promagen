import { NextResponse } from "next/server";

// Edge runtime: fast, stateless; ideal for health checks
export const runtime = 'nodejs';

// Stable JSON 200 for monitors; no caching
export function GET() {
  return NextResponse.json(
    { ok: true, service: "promagen-frontend", time: new Date().toISOString() },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

// Lightweight HEAD handler for probe tools
export function HEAD() {
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

