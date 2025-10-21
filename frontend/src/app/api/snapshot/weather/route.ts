// frontend/src/app/api/snapshot/weather/route.ts
import { NextResponse } from "next/server";
import { fetchWeatherForMarkets } from "@/lib/weather";

export const revalidate = 1800; // 30 min

export async function GET() {
  // Stage-1: fetch stub; Stage-2/3 can swap in live sources.
  const items = await fetchWeatherForMarkets();
  return NextResponse.json({ items, asOfUTC: new Date().toISOString() });
}

