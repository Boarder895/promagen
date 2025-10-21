// frontend/src/app/api/ingest/weather/route.ts
import { NextResponse } from "next/server";
import { fetchWeatherForMarkets } from "@/lib/weather";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await fetchWeatherForMarkets();
  // In Stage-3 this endpoint would persist items to your DB; for now it mirrors snapshot.
  return NextResponse.json({ items, asOfUTC: new Date().toISOString() });
}

