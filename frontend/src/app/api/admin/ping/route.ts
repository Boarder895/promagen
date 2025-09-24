import { NextResponse, type NextRequest } from "next/server";
import { withAdminGuard } from "@/lib/requireAdmin";

export const GET = withAdminGuard(async (_req: NextRequest) => {
  return NextResponse.json({ ok: true, ts: Date.now() });
});
