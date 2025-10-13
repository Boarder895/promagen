const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const r = await fetch(`${API_BASE}/api/v1/audit/${ctx.params.id}/csv`, { cache: 'no-store' });
  const csv = await r.text();
  return new Response(csv, {
    status: r.status,
    headers: { 'Content-Type': 'text/csv; charset=utf-8' },
  });
}

