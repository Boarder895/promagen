// src/app/api/providers/route.ts
import { NextResponse } from "next/server";

const API_BASE = process.env.API_BASE || "http://localhost:3001";

export async function GET() {
  try {
    const url = `${API_BASE}/api/providers`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.includes("application/json")) {
      return NextResponse.json(
        { ok: false, error: "upstream_error", status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { ok: false, error: "upstream_fetch_failed", message },
      { status: 502 }
    );
  }
}











