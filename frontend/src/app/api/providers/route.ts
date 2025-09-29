// GET /api/providers  (public — shows current in-memory provider state)
import { NextResponse } from "next/server";
import { getProviderState } from "@/lib/providerState";

export async function GET() {
  const data = getProviderState();
  return NextResponse.json({ ok: true, providers: data }, { status: 200 });
}
