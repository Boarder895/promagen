import kv from "@/lib/kv";

export async function GET(
  _req: Request,
  ctx: { params: { key: string } }
): Promise<Response> {
  const value = await kv.get("snapshot", ctx.params.key);
  return Response.json({ ok: true, value });
}

export async function DELETE(
  _req: Request,
  ctx: { params: { key: string } }
): Promise<Response> {
  await kv.del("snapshot", ctx.params.key);
  return Response.json({ ok: true });
}
