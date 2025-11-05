import { NextRequest, NextResponse } from "next/server";

type Rec = {
  id: string; city: string; tz: string;
  latitude: number; longitude: number;
  hoursTemplate?: string | null; workdays?: string | null;
  holidaysRef?: string | null; exceptions?: { date: string; closed?: boolean; open?: string; close?: string }[];
};

type ApiResp =
  | { ok: true; data: Rec[]; path: string; saved?: boolean; backups?: string[] }
  | { ok: false; error: string; errors?: string[] };

export async function GET(_req: NextRequest) {
  const payload: ApiResp = { ok: true, data: [], path: "data/exchanges.catalog.json" };
  return NextResponse.json(payload);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const data = (body && typeof body === "object" && "data" in (body as Record<string, unknown>))
      ? ((body as { data: Rec[] }).data)
      : [];

    // pretend-save; validate minimally
    const invalid = data.filter(r => !r.id || !r.city || !r.tz);
    if (invalid.length) {
      const resp: ApiResp = { ok: false, error: "Validation failed", errors: invalid.map(r => `Missing id/city/tz for ${r.id || "(no id)"}`) };
      return NextResponse.json(resp, { status: 400 });
    }

    const resp: ApiResp = { ok: true, data, path: "data/exchanges.catalog.json", saved: true, backups: [] };
    return NextResponse.json(resp);
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message ?? "bad json" } satisfies ApiResp, { status: 400 });
  }
}





