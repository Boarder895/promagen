import { NextResponse } from "next/server";
import { MARKETS } from "@/data/markets";
import { fetchMarketQuote } from "@/lib/market";

export const revalidate = 1800; // 30 min

export async function GET(){
  // In production, aggregate from per-market KV set by ingest cron.
  // Here we build a map on demand; ISR ensures 30-min freshness.
  const entries = await Promise.all(MARKETS.map(async m=>{
    const q = await fetchMarketQuote(m.id);
    return [m.id, q] as const;
  }));
  const items = Object.fromEntries(entries);
  return NextResponse.json({ items, asOfUtc: new Date().toISOString() });
}
