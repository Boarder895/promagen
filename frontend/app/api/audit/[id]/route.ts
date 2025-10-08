// app/api/audit/[id]/csv/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/audit/${params.id}/csv`, { cache: 'no-store' });
  const csv = await res.text();
  return new NextResponse(csv, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'cache-control': 'no-store' },
  });
}
