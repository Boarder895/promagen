import { NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  event: z.string().min(1),
  id: z.string().optional(),
  url: z.string().url().optional(),
  meta: z.record(z.unknown()).optional(),
});

/**
 * POST /api/track-click
 * Accepts a small, typed payload and funnels to your analytics layer.
 * Uses console.debug only (allowed by your lint rules) as a safe default.
 */
export async function POST(req: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    console.debug("track-click: invalid JSON body");
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    console.debug("track-click: schema error", parsed.error.flatten());
    return NextResponse.json({ ok: false, error: "Bad payload" }, { status: 400 });
  }

  const { event, id, url, meta } = parsed.data;

  // TODO: replace with your real analytics sink (server-side only).
  console.debug("track-click", { event, id, url, meta });

  return NextResponse.json({ ok: true });
}
