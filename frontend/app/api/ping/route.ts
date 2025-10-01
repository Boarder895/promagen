export const dynamic = "force-dynamic";
type Pong = { ok: true; ts: string };
export async function GET(): Promise<Response> {
  const payload: Pong = { ok: true, ts: new Date().toISOString() };
  return Response.json(payload, { status: 200 });
}
