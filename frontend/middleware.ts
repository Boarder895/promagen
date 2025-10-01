// middleware.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Allowed hosts for same-origin checks (dev + prod).
 * Add or remove domains as needed.
 */
const ALLOWED_HOSTS = new Set<string>([
  "localhost:3000",
  "127.0.0.1:3000",
  "promagen.com",
  "www.promagen.com",
  "app.promagen.com",
  // Vercel preview/prod domains:
  ".vercel.app",
]);

/** Returns host (including port if present) from a URL string. */
function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.port ? `${u.hostname}:${u.port}` : u.hostname;
  } catch {
    return null;
  }
}

/** Loose check to allow any *.vercel.app */
function isAllowedHost(host: string | null): boolean {
  if (!host) return false;
  if (ALLOWED_HOSTS.has(host)) return true;
  if (host.endsWith(".vercel.app")) return true;
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Admin API: require Bearer token on ALL methods
  if (pathname.startsWith("/api/admin/")) {
    const header = req.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const expected = process.env.ADMIN_TOKEN || "";

    if (!expected || token !== expected) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    // Token ok → allow
    return NextResponse.next();
  }

  // 2) Same-origin guard for state-changing API routes
  if (
    pathname.startsWith("/api/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method)
  ) {
    const originHost = hostOf(req.headers.get("origin"));
    const refererHost = hostOf(req.headers.get("referer"));
    const reqHost = req.headers.get("host");

    const originOk = isAllowedHost(originHost);
    const refererOk = isAllowedHost(refererHost);
    const hostOk = isAllowedHost(reqHost);

    if (!(originOk && refererOk && hostOk)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  // Otherwise pass through
  return NextResponse.next();
}

// Only run for API routes to avoid touching static assets
export const config = {
  matcher: ["/api/:path*"],
};


