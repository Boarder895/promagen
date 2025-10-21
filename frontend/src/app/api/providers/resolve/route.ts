import { NextResponse } from "next/server";
import { providers, getProvider } from "@/lib/providers";

export async function GET() {
  return NextResponse.json({ count: providers.length });
}

export async function POST(req: Request) {
  const { idOrSlug } = await req.json();
  const p = getProvider(String(idOrSlug ?? ""));
  if (!p) return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  return NextResponse.json(p);
}








