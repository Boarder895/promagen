const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const r = await fetch(`${API_BASE}/api/v1/audit/${ctx.params.id}/verify`, { cache: 'no-store' });
  const j = await r.json();
  return new Response(JSON.stringify(j), { status: r.status, headers: { 'Content-Type': 'application/json' } });
}


