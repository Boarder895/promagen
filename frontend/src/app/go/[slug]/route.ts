// src/app/go/[slug]/route.ts
import { NextResponse, NextRequest } from "next/server";
import { getProvider } from "@/lib/providers";

export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  const p = getProvider(ctx.params.slug);
  if (!p) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const url = p.affiliateUrl || "";
  if (!url) return NextResponse.json({ error: "no affiliateUrl configured" }, { status: 400 });

  return NextResponse.redirect(url);
}




