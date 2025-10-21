// frontend/src/app/api/ping/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";            // Stage 1: avoid Edge to prevent SSG warning
export const dynamic = "force-dynamic";     // always live
export const revalidate = 0;                // no caching at build time

// Stable JSON 200 for monitors; no caching
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      server: "promagen-frontend",
      time: new Date().toISOString(),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

// Lightweight HEAD handler for probe tools
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}





