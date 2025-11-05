import { NextResponse } from "next/server";
import { MARKETS } from "@/data/markets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const marketId = searchParams.get("market");
  if (!marketId) return NextResponse.json({ error: "market required" }, { status: 400 });

  const def = MARKETS.find(m => m.id === marketId);
  if (!def) return NextResponse.json({ error: "unknown market" }, { status: 404 });

  // Stage 1–2: no live quotes yet; return definition as a stub payload.
  return NextResponse.json({ item: def, asOfUtc: new Date().toISOString() });
}


