import { NextResponse } from 'next/server';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export async function GET() {
  const r = await fetch(`${API_BASE}/api/v1/audit`, { cache: 'no-store' });
  const j = await r.json();
  return NextResponse.json(j, { status: r.status });
}









