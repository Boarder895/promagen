import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// If you need to limit paths later:
// export const config = { matcher: ["/((?!_next|api/health|favicon.ico).*)"] };



