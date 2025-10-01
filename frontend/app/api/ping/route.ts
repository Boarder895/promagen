import { NextResponse } from "next/server";

export const runtime = "edge";

export function GET() {
  return NextResponse.json(
    { ok: true, service: "promagen-frontend", time: new Date().toISOString() },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export function HEAD() {
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
