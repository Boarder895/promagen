// src/app/api/cron/import/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST() {
  await prisma.$executeRaw`SELECT 1`;
  return NextResponse.json({ ok: true, imported: 0 });
}
