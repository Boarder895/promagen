// frontend/src/app/api/ribbon/route.ts
import { NextResponse } from "next/server";

export type MarketStatus = "open" | "closed" | "pre" | "post";

export interface RibbonEntry {
  exchangeId: string;
  status: MarketStatus;
  localTimeISO: string;
  tempC: number | null;
}

export async function GET() {
  // TODO: replace with real ribbon aggregator when ready
  const data: RibbonEntry[] = [
    {
      exchangeId: "lse",
      status: "closed",
      localTimeISO: new Date().toISOString(),
      tempC: null
    }
  ];
  return NextResponse.json({ ok: true, data });
}

























