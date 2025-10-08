import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(_req: NextRequest, context: unknown) {
  const { id } = (context as { params: { id: string } }).params; // narrow locally

  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
  const res  = await fetch(`${base}/api/audit/${id}`, { cache: 'no-store' });
  const json = await res.json();

  return NextResponse.json(json, {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
