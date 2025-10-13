// POST /api/admin/sync  (guarded by middleware.ts)
import { NextResponse } from "next/server";
import { refreshProviders } from "@/lib/providerState";

export async function POST() {
  try {
    const res = await refreshProviders();
    return NextResponse.json({ ok: true, ...res }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}

// Optional method guards
export function GET() {
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}
export const PUT = GET, DELETE = GET, PATCH = GET;


