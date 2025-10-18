// src/app/api/providers/[id]/override/route.ts
import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const p = getProvider(ctx.params.id);
  if (!p) return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  return NextResponse.json({ ok: true });
}




