// frontend/src/app/api/health/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // Simple, cache-busting health probe
  return NextResponse.json({
    ok: true,
    service: "promagen-frontend",
    time: new Date().toISOString()
  });
}







