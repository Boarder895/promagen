import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const CANONICAL_HOST = (process.env.NEXT_PUBLIC_CANONICAL_HOST ?? '').trim().toLowerCase();
const ENFORCE_CANONICAL = (process.env.NEXT_PUBLIC_ENFORCE_CANONICAL ?? '').trim() === '1';
const DEV_HEALTH_TOKEN = (process.env.PROMAGEN_DEV_HEALTH_TOKEN ?? '').trim();

const DEV_HEALTH_PATHS = new Set<string>(['/dev/health', '/api/health', '/health-check']);

const CSP_REPORT_URI = '/api/meta/csp-report';
const REPORT_TO = JSON.stringify({
  group: 'csp-endpoint',
  max_age: 10886400,
  endpoints: [{ url: CSP_REPORT_URI }],
});

// Protect only "private" surfaces (public site stays public)
const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
  '/settings(.*)',
  '/saved(.*)',
  '/test(.*)',
  '/api/admin(.*)',
  '/api/tests(.*)',
]);

function getPromagenRequestId(req: NextRequest): string {
  return (
    req.headers.get('x-promagen-request-id') ??
    req.headers.get('x-vercel-id') ??
    crypto.randomUUID()
  );
}

function isDevHealthPath(pathname: string): boolean {
  if (DEV_HEALTH_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/dev/health/')) return true;
  if (pathname.startsWith('/api/health')) return true;
  if (pathname.startsWith('/health-check')) return true;
  return false;
}

function isPromagenInternalHost(host: string): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  return h.includes('promagen');
}

function getClerkFapiUrl(): string | null {
  // Optional but useful: lets you keep CSP tight by explicitly allowing your Clerk Frontend API host
  // (NEXT_PUBLIC_CLERK_FAPI or CLERK_FAPI).
  const raw = (process.env.NEXT_PUBLIC_CLERK_FAPI ?? process.env.CLERK_FAPI ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `https://${raw}`;
}

function buildCsp(isDev: boolean, isPreview: boolean): string {
  const clerkFapi = getClerkFapiUrl();

  // If you set NEXT_PUBLIC_CLERK_FAPI / CLERK_FAPI we allow it explicitly;
  // otherwise allow Clerk hosted domains so auth still works.
  const clerkHostedFallback = 'https://*.clerk.accounts.dev https://*.clerk.com';
  const clerkScriptSrc = clerkFapi ? `${clerkFapi} ${clerkHostedFallback}` : clerkHostedFallback;
  const clerkConnectSrc = clerkFapi ? `${clerkFapi}` : clerkHostedFallback;

  const directives: string[] = [];

  directives.push(`default-src 'self'`);

  // Clerk requires script-src to include your FAPI hostname + Cloudflare challenges host.
  directives.push(
    `script-src 'self' 'unsafe-inline'${
      isDev ? " 'unsafe-eval'" : ''
    } blob: ${clerkScriptSrc} https://challenges.cloudflare.com`,
  );

  // Clerk requires unsafe-inline for runtime CSS-in-JS.
  directives.push(`style-src 'self' 'unsafe-inline' https:`);

  // Clerk images (avatars) come from img.clerk.com.
  directives.push(`img-src 'self' data: blob: https://img.clerk.com`);

  directives.push(`font-src 'self' data:`);

  // Keep your existing "safe-but-practical" connect-src, plus explicit Clerk FAPI if set.
  directives.push(`connect-src 'self' https:${isDev ? ' http: ws: wss:' : ''} ${clerkConnectSrc}`);

  // Clerk requires workers from self + blob:.
  directives.push(`worker-src 'self' blob:`);

  // Cloudflare bot protection iframe host.
  directives.push(`frame-src 'self' https://challenges.cloudflare.com`);

  directives.push(`base-uri 'self'`);
  directives.push(`form-action 'self'`);
  directives.push(`frame-ancestors 'none'`);
  directives.push(`object-src 'none'`);

  // Only send reports in preview builds (report-only header below)
  if (isPreview) {
    directives.push(`report-uri ${CSP_REPORT_URI}`);
    directives.push(`report-to csp-endpoint`);
  }

  return directives.join('; ');
}

function applySecurityHeaders(
  response: NextResponse,
  isDev: boolean,
  isDevHealth: boolean,
  requestId: string,
): NextResponse {
  const isPreview =
    (process.env.VERCEL_ENV ?? '').toLowerCase() === 'preview' ||
    (process.env.NEXT_PUBLIC_VERCEL_ENV ?? '').toLowerCase() === 'preview';

  const csp = buildCsp(isDev, isPreview);

  if (isPreview) {
    response.headers.set('Content-Security-Policy-Report-Only', csp);
    response.headers.set('Report-To', REPORT_TO);
  } else {
    response.headers.set('Content-Security-Policy', csp);
  }

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');

  response.headers.set(
    'Cross-Origin-Opener-Policy',
    isDev ? 'same-origin-allow-popups' : 'same-origin',
  );

  // COEP 'require-corp' blocks Clerk scripts - use 'unsafe-none' to allow third-party auth
  response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');

  if (!isDev) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );
  }

  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  );

  response.headers.set('x-promagen-request-id', requestId);

  if (isDevHealth) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    response.headers.set('Cache-Control', 'no-store');
  }

  return response;
}

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl;
  const host = url.host.toLowerCase();
  const pathname = url.pathname;

  const isDev = process.env.NODE_ENV === 'development';
  const isDevHealth = isDevHealthPath(pathname);
  const requestId = getPromagenRequestId(req);

  // 1) Dev/health gate (token OR internal host) — keep BEFORE auth
  if (isDevHealth) {
    const token = req.headers.get('x-promagen-health-token') ?? '';
    const allowed =
      (DEV_HEALTH_TOKEN && token === DEV_HEALTH_TOKEN) || isPromagenInternalHost(host);

    if (!allowed) {
      const res = NextResponse.json({ error: 'Not found' }, { status: 404 });
      return applySecurityHeaders(res, isDev, true, requestId);
    }
  }

  // 2) Canonical host enforcement
  if (host !== 'localhost:3000' && ENFORCE_CANONICAL && CANONICAL_HOST && host !== CANONICAL_HOST) {
    const to = `${url.protocol}//${CANONICAL_HOST}${url.pathname}${url.search}`;
    const res = NextResponse.redirect(to, 308);
    return applySecurityHeaders(res, isDev, isDevHealth, requestId);
  }

  // 3) Clerk protection for private areas
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // 4) Continue
  const res = NextResponse.next();
  return applySecurityHeaders(res, isDev, isDevHealth, requestId);
});

export const config = {
  matcher: [
    // Skip Next.js internals and common static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
