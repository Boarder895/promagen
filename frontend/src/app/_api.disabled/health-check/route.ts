import { NextResponse } from "next/server";
export const runtime = "nodejs"; // avoid Edge unless needed
export const dynamic = "force-dynamic"; // always live
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}



