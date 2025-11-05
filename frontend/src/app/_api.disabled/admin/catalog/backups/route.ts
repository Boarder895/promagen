import { NextRequest, NextResponse } from "next/server";

type Rec = {
  id: string; city: string; tz: string;
  latitude: number; longitude: number;
  hoursTemplate?: string | null; workdays?: string | null;
  holidaysRef?: string | null; exceptions?: { date: string; closed?: boolean; open?: string; close?: string }[];
};

type ApiResp =
  | { ok: true; data: Rec[]; path: string; backups?: string[] }
  | { ok: false; error: string };

export async function GET(_req: NextRequest) {
  // stub: list backups and (optionally) return current data
  const payload: ApiResp = { ok: true, data: [], path: "data/exchanges.catalog.json", backups: [] };
  return NextResponse.json(payload);
}




