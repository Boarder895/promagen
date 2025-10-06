import { NextRequest, NextResponse } from 'next/server';

function gate(req: NextRequest): NextResponse | null {
  const token = process.env.ADMIN_BEARER_TOKEN || process.env.ADMIN_TOKEN || '';
  if (!token) return NextResponse.json({ error: 'Server missing ADMIN_BEARER_TOKEN' }, { status: 500 });
  const auth = req.headers.get('authorization') || '';
  const [scheme, supplied] = auth.split(' ');
  if (scheme !== 'Bearer' || supplied !== token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const res = gate(req); if (res) return res;
  return NextResponse.json({ ok: true, method: 'GET', ts: Date.now() });
}

export async function POST(req: NextRequest) {
  const res = gate(req); if (res) return res;
  let body: unknown = null; try { body = await req.json(); } catch {}
  return NextResponse.json({ ok: true, method: 'POST', received: body, ts: Date.now() });
}




