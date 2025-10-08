// app/api/audit/[id]/csv/route.ts
import { NextResponse } from "next/server";

export async function GET(_req: Request, context: any) {
  // narrow just what we need
  const { id } = (context?.params as { id: string });

  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  const res = await fetch(`${base}/api/audit/${id}/csv`, { cache: "no-store" });
  const csv = await res.text();

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
