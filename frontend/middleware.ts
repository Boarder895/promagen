import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Set this in Vercel as a normal env var (not NEXT_PUBLIC): APP_ORIGIN=https://app.promagen.com
const ALLOWED = new Set(
  [process.env.APP_ORIGIN].filter(Boolean) as string[]
);

export function middleware(req: NextRequest) {
  const { pathname, host, protocol } = req.nextUrl;

  // Only protect admin API routes
  if (!pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  // Derive the "current" origin as a fallback allow (useful on previews)
  const thisOrigin = `${protocol}//${host}`;
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';

  // Build the allowlist: APP_ORIGIN plus current deployment’s origin
  const allow = new Set([thisOrigin, ...ALLOWED]);

  const originOk = origin && Array.from(allow).some(o => origin.startsWith(o));
  const refererOk = referer && Array.from(allow).some(o => referer.startsWith(o));

  // Require BOTH headers to be present and match (hardline CSRF stance)
  if (!originOk || !refererOk) {
    return new NextResponse('Forbidden (same-origin admin API only)', { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*'],
};


