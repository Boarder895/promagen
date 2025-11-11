// src/app/api/exchanges/route.ts
// Uses selected exchanges as the truth set. Shape matches tests.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import exchangesSelected from "@/data/exchanges.selected.json"; // JSON file you marked as SoT

type Exchange = {
  id: string;
  exchange?: string;
  city?: string;
  tz?: string;
  latitude?: number;
  longitude?: number;
  hoursTemplate?: string | null;
  workdays?: string | null;
  holidaysRef?: string | null;
};

type Payload = { ok: true; data: { items: Exchange[] } };
type ApiErr = { ok: false; error: string };

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export async function GET(_req?: NextRequest) {
  try {
    const items = asArray<Exchange>(exchangesSelected);
    if (!items.length) {
      return NextResponse.json({ ok: false, error: "No exchanges" } as ApiErr, {
        status: 503,
        headers: { "cache-control": "no-store" },
      });
    }
    return NextResponse.json({ ok: true, data: { items } } as Payload, {
      status: 200,
      headers: {
        "cache-control": "public, s-maxage=120, stale-while-revalidate=600",
        "x-promagen-api": "exchanges:v1",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to load exchanges" } as ApiErr,
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
