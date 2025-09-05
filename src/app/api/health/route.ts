// src/app/api/health/route.ts  (server runtime)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db"; // ✅ allowed
export function GET() {
  return NextResponse.json({ status: "ok" });
}
