import { NextResponse, type NextRequest } from "next/server";
import { withAdminGuard } from "@/lib/requireAdmin";

export const POST = withAdminGuard(async (_req: NextRequest) => {
  // TODO: your real sync logic here
  return NextResponse.json({ synced: true, ts: Date.now() });
});
