// C:\Users\Martin Yarnold\Projects\promagen\frontend\src\middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const isDev = process.env.NODE_ENV !== 'production';
const ADMIN_PATHS = [/^\/providers(?:\/|$)/, /^\/admin(?:\/|$)/];

function unauthorizedBasic() {
  return new NextResponse('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Promagen Admin"' },
  });
}
function unauthorizedBearer() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function needsBasic(pathname: string) {
  return ADMIN_PATHS.some((re) => re.test(pathname));
}
function needsBearer(req: NextRequest) {
  const { pathname } = new URL(req.url);
  if (pathname.startsWith('/api/admin/')) return true;
  if (pathname.startsWith('/api/') && req.method !== 'GET' && req.method !== 'OPTIONS') return true;
  return false;
}

function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const fwd = headers.get('forwarded');
  if (fwd) {
    const m = /for="?([^;"]+)/i.exec(fwd);
    if (m) return m[1].replace(/"/g, '');
  }
  return '0.0.0.0';
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // 1) Basic Auth for admin pages
  if (needsBasic(pathname)) {
    const user = process.env.ADMIN_USER ?? '';
    const pass = process.env.ADMIN_PASS ?? '';
    if (user && pass) {
      const auth = req.headers.get('authorization') || '';
      const [scheme, encoded] = auth.split(' ');
      if (scheme !== 'Basic' || !encoded) {
        return unauthorizedBasic();
      }
      let decoded = '';
      try {
        // Use atob if available, otherwise Buffer
        decoded = typeof atob === 'function'
          ? atob(encoded)
          : Buffer.from(encoded, 'base64').toString();
      } catch {
        return unauthorizedBasic();
      }
      const [u, p] = decoded.split(':');
      if (u !== user || p !== pass) {
        return unauthorizedBasic();
      }
    }
  }

  // 2) Bearer Token for write API routes
  if (needsBearer(req)) {
    const token = process.env.ADMIN_BEARER_TOKEN || '';
    if (!token) return unauthorizedBearer();
    const auth = req.headers.get('authorization') || '';
    const [scheme, supplied] = auth.split(' ');
    if (scheme !== 'Bearer' || !supplied || supplied !== token) {
      return unauthorizedBearer();
    }
  }

  // 3) Add security headers (CSP, etc.)
  const nonce = crypto.randomUUID();
  const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://promagen-api.fly.dev').replace(/\/+$/, '');
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "form-action 'self'",
    `connect-src 'self' ${API_BASE} https:${isDev ? ' ws:' : ''}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' https: data:",
    `'script-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-eval' 'unsafe-inline'" : ''} 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https:",
    "upgrade-insecure-requests",
  ].join('; ');
  const res = NextResponse.next();
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.headers.set('x-csp-nonce', nonce);
  res.headers.set('x-client-ip', getClientIp(req.headers));
  return res;
}

export const config = {
  matcher: ['/:path*'], // apply to all routes
};
