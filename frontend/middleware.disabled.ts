import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ADMIN_HEADER = 'x-admin-token';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');

  // Same-origin check: allow requests with no origin (SSR/assets) or matching host.
  const sameOrigin =
    !origin || (new URL(origin).host === host);

  if (!sameOrigin) {
    return new NextResponse('Blocked by same-origin policy', { status: 403 });
  }

  // Example admin guard for /api/admin/* and /admin/*
  const isAdminPath =
    url.pathname.startsWith('/api/admin') ||
    url.pathname === '/admin' ||
    url.pathname.startsWith('/admin/');

  if (isAdminPath) {
    const token = req.headers.get(ADMIN_HEADER) ?? url.searchParams.get('admin_token');
    if (!token) {
      return new NextResponse('Admin token required', { status: 401 });
    }
    // Optionally compare token to env in an edge-safe way (kept simple here):
    // if (token !== process.env.NEXT_PUBLIC_ADMIN_TOKEN) { ... }
  }

  return NextResponse.next();
}

// Match API and app routes broadly; refine if needed.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};

