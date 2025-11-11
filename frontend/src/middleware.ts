import { NextRequest, NextResponse } from 'next/server';

const CANONICAL_HOST = (process.env['CANONICAL_HOST'] ?? '').toLowerCase().trim();
const ENFORCE_CANONICAL = ((process.env['ENFORCE_CANONICAL'] ?? 'true').toLowerCase() === 'true');
const VERCEL_ENV = (process.env['VERCEL_ENV'] ?? '').toLowerCase();

const csp = [
  "default-src 'self'",
  "script-src 'self' 'strict-dynamic' 'nonce-rand' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const host = url.host.toLowerCase();

  // Canonical apex redirect (allow localhost in dev)
  if (ENFORCE_CANONICAL && CANONICAL_HOST && host !== CANONICAL_HOST) {
    const to = `${url.protocol}//${CANONICAL_HOST}${url.pathname}${url.search}`;
    return NextResponse.redirect(to, 308);
  }

  const res = NextResponse.next();
  // Security headers
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  // CSP (report-only on preview)
  if (VERCEL_ENV === 'preview') {
    res.headers.set('Content-Security-Policy-Report-Only', csp);
  } else {
    res.headers.set('Content-Security-Policy', csp);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
