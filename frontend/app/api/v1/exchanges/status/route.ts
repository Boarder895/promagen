// app/api/v1/exchanges/status/route.ts
import { NextResponse } from "next/server";
import { getExchangeStatusesPayload } from "@/lib/exchangeStatus";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = getExchangeStatusesPayload();
  return NextResponse.json(payload, {
    headers: { "cache-control": "no-store" },
  });
}
