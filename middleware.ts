import type { NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  return Response.next();
}

// Process everything except Next static assets + favicon
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};
