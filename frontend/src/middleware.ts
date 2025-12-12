import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const CANONICAL_HOST = (process.env['CANONICAL_HOST'] ?? '').toLowerCase().trim();
const ENFORCE_CANONICAL = (process.env['ENFORCE_CANONICAL'] ?? 'true').toLowerCase() === 'true';
const VERCEL_ENV = (process.env['VERCEL_ENV'] ?? '').toLowerCase();

function buildCsp(isDev: boolean): string {
  // Next dev needs looser script rules (webpack/HMR use eval/inline).
  if (isDev) {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' http: https: ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }

  // Production CSP (tight)
  return [
    "default-src 'self'",
    "script-src 'self' 'strict-dynamic' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const host = url.host.toLowerCase();

  // Canonical apex redirect (allow localhost in dev)
  if (ENFORCE_CANONICAL && CANONICAL_HOST && host !== CANONICAL_HOST) {
    const to = `${url.protocol}//${CANONICAL_HOST}${url.pathname}${url.search}`;
    return NextResponse.redirect(to, 308);
  }

  const res = NextResponse.next();

  const isDev = process.env.NODE_ENV === 'development';
  const csp = buildCsp(isDev);

  // Security headers
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // COOP/COEP can be painful in dev; keep them for prod only.
  if (!isDev) {
    res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  }

  // CSP (report-only on preview; enforced otherwise)
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
