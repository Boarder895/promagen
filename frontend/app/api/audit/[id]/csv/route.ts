import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest, context: any) {
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
