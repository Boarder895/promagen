export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { EXCHANGES, SELECTED_IDS, type Exchange } from "@/data/exchanges";

// This matches what page.tsx expects:
// RibbonMarket = { exchange: Exchange, weather?: { tempC?: number }, state?: { status?: string } }
type RibbonMarket = {
  exchange: Exchange;
  weather?: { tempC?: number };
  state?: { status?: "open" | "closed" | "unknown" };
};

function getSelected(): Exchange[] {
  const byId = new Map(EXCHANGES.map(e => [e.id, e]));
  return SELECTED_IDS.map(id => byId.get(id)!).filter((x): x is Exchange => Boolean(x));
}

const isEast = (e: Exchange) => e.longitude > 0;

function partitionEven(ex: Exchange[]) {
  const target = Math.floor(ex.length / 2); // 6
  const east = ex.filter(isEast).sort((a, b) => a.longitude - b.longitude);
  const west = ex.filter(e => !isEast(e)).sort((a, b) => Math.abs(a.longitude) - Math.abs(b.longitude));

  // Rebalance to target per side
  while (east.length > target) west.unshift(east.shift()!);
  while (west.length > target) east.unshift(west.shift()!);

  // Decorate into RibbonMarket shape used by the client
  const wrap = (x: Exchange): RibbonMarket => ({
    exchange: x,
    weather: { tempC: 20 },     // stub until real weather is wired
    state: { status: "unknown"} // stub until market engine is wired
  });

  return { east: east.map(wrap), west: west.map(wrap) };
}

export async function GET() {
  const { east, west } = partitionEven(getSelected());

  // Back-compat keys + what the page actually uses:
  const payload = {
    // what HomePage currently reads:
    markets: [...east, ...west],   // ← ARRAY as expected by page.tsx
    providers: [],                 // page uses this too; keep as array

    // extra shapes so older components won't break:
    east,
    west,
    marketsObj: { east, west },
    eastMarkets: east,
    westMarkets: west,
  };

  return new NextResponse(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}














