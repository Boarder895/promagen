import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const CANONICAL_HOST = (process.env['CANONICAL_HOST'] ?? '').toLowerCase().trim();
const ENFORCE_CANONICAL = (process.env['ENFORCE_CANONICAL'] ?? 'true').toLowerCase() === 'true';
const VERCEL_ENV = (process.env['VERCEL_ENV'] ?? '').toLowerCase();

const DEV_HEALTH_ENABLED =
  (process.env['PROMAGEN_DEV_HEALTH_ENABLED'] ?? 'false').toLowerCase() === 'true';
const DEV_HEALTH_TOKEN = (process.env['PROMAGEN_DEV_HEALTH_TOKEN'] ?? '').trim();

function buildCsp(isDev: boolean): string {
  // Next dev needs looser script rules (HMR uses eval/inline).
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

  // Production CSP (compatible with Next's inline bootstrapping scripts)
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

function isDevHealthPath(pathname: string): boolean {
  return pathname === '/dev/health' || pathname.startsWith('/dev/health/');
}

function isProdLike(vercelEnv: string, isDev: boolean): boolean {
  if (isDev) return false;
  // Treat preview like production for safety (preview URLs get shared).
  return vercelEnv === 'production' || vercelEnv === 'preview';
}

function getPresentedDevHealthToken(req: NextRequest, url: URL): string {
  // Prefer header token (lower leakage risk than query strings).
  const fromHeader =
    req.headers.get('x-promagen-dev-health-token') ??
    req.headers.get('x-promagen-dev-token') ??
    req.headers.get('x-dev-health-token');

  if (fromHeader && fromHeader.trim()) return fromHeader.trim();

  // Optional fallback: query token (convenient, but more leak-prone).
  const fromQuery = url.searchParams.get('token');
  if (fromQuery && fromQuery.trim()) return fromQuery.trim();

  return '';
}

function devHealthAllowed(req: NextRequest, url: URL, isDev: boolean, vercelEnv: string): boolean {
  // Default OFF everywhere unless explicitly enabled.
  if (!DEV_HEALTH_ENABLED) return false;

  // Dev: frictionless (no token).
  if (isDev) return true;

  // Preview/prod: require token (defence in depth).
  if (!isProdLike(vercelEnv, isDev)) {
    // Non-dev but not preview/prod (rare): still require token to be safe.
    // (e.g., custom staging env)
  }

  if (!DEV_HEALTH_TOKEN) return false;

  const presented = getPresentedDevHealthToken(req, url);
  if (!presented) return false;

  return presented === DEV_HEALTH_TOKEN;
}

function applySecurityHeaders(
  res: NextResponse,
  isDev: boolean,
  devHealthMode: boolean,
): NextResponse {
  const csp = buildCsp(isDev);

  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Keep COOP/COEP off in dev to avoid surprises.
  if (!isDev) {
    res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  }

  // Preview: report-only. Production: enforce.
  if (VERCEL_ENV === 'preview') {
    res.headers.set('Content-Security-Policy-Report-Only', csp);
  } else {
    res.headers.set('Content-Security-Policy', csp);
  }

  // Ensure internal dashboards never get indexed (even if someone exposes them by mistake).
  if (devHealthMode) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  }

  return res;
}

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const host = url.host.toLowerCase();
  const pathname = url.pathname;

  const isDev = process.env.NODE_ENV === 'development';
  const devHealthMode = isDevHealthPath(pathname);

  // Gate /dev/health first. Always return 404 when blocked (no hints).
  if (devHealthMode) {
    const allowed = devHealthAllowed(req, url, isDev, VERCEL_ENV);

    if (!allowed) {
      const notFound = new NextResponse('Not Found', { status: 404 });
      return applySecurityHeaders(notFound, isDev, true);
    }
    // Allowed: continue through canonical redirects + normal headers below.
  }

  // Allow localhost without canonical redirects.
  if (host !== 'localhost:3000' && ENFORCE_CANONICAL && CANONICAL_HOST && host !== CANONICAL_HOST) {
    const to = `${url.protocol}//${CANONICAL_HOST}${url.pathname}${url.search}`;
    return NextResponse.redirect(to, 308);
  }

  const res = NextResponse.next();
  return applySecurityHeaders(res, isDev, devHealthMode);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
