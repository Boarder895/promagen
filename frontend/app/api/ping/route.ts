// app/api/ping/route.ts (Next.js App Router API route)
import { NextResponse } from "next/server";

export const revalidate = 0;            // no static cache
export const dynamic = "force-dynamic"; // always run on request

export async function GET() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

  try {
    const r = await fetch(`${apiBase.replace(/\/$/, "")}/api/ping`, { cache: "no-store" });
    const upstream = await r.json().catch(() => null);
    return NextResponse.json(
      { ok: true, apiBase, upstream },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, apiBase, error: String(err?.message || err) },
      { status: 502 },
    );
  }
}



