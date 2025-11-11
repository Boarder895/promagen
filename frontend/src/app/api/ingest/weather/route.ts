import type { NextRequest} from "next/server";
import { NextResponse } from "next/server";

type MarketWeather = {
  id: string; city: string; tz: string;
  latitude: number; longitude: number;
  tempC?: number | null; tempF?: number | null; condition?: string | null;
};

type ApiResp =
  | { ok: true; count: number; data: MarketWeather[] }
  | { ok: false; error: string };

export async function POST(_req: NextRequest) {
  // stub ingest; would call your provider and store
  const data: MarketWeather[] = [];
  return NextResponse.json({ ok: true, count: data.length, data } satisfies ApiResp);
}







