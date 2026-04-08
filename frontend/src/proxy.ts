import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const CANONICAL_HOST = (process.env.NEXT_PUBLIC_CANONICAL_HOST ?? '').trim().toLowerCase();
const ENFORCE_CANONICAL = (process.env.NEXT_PUBLIC_ENFORCE_CANONICAL ?? '').trim() === '1';
const DEV_HEALTH_TOKEN = (process.env.PROMAGEN_DEV_HEALTH_TOKEN ?? '').trim();

const DEV_HEALTH_PATHS = new Set<string>(['/dev/health', '/api/health', '/health-check']);

// Admin user IDs — same env var used by /api/admin/* route handlers (defence in depth)
const ADMIN_USER_IDS = new Set(
  (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

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

// Admin-only gates (subset of protected routes — requires ADMIN_USER_IDS membership)
const isAdminPageRoute = createRouteMatcher(['/admin(.*)']);
const isAdminApiRoute = createRouteMatcher(['/api/admin(.*)']);

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

  // ============================================================================
  // CLERK CSP DOMAINS
  // ============================================================================
  // Allow Clerk's default hosted domains PLUS custom promagen.com subdomains:
  // - clerk.promagen.com (Frontend API / script loading)
  // - accounts.promagen.com (Account Portal)
  // ============================================================================
  const clerkHostedFallback =
    'https://*.clerk.accounts.dev https://*.clerk.com https://clerk.promagen.com https://accounts.promagen.com';
  const clerkScriptSrc = clerkFapi ? `${clerkFapi} ${clerkHostedFallback}` : clerkHostedFallback;
  const clerkConnectSrc = clerkFapi ? `${clerkFapi} ${clerkHostedFallback}` : clerkHostedFallback;

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
  directives.push(`img-src 'self' data: blob: https://img.clerk.com https://img.clerk.dev`);

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

// ============================================================================
// DEV vs PROD MIDDLEWARE
// ============================================================================
// Both use clerkMiddleware() so auth()/clerkClient() work in route handlers.
// Dev: all pages open (no route protection enforced).
// Prod: full auth + admin-only gate.
// ============================================================================

const devMiddleware = clerkMiddleware(async (_auth, req) => {
  const url = req.nextUrl;
  const host = url.host.toLowerCase();
  const pathname = url.pathname;
  const requestId = getPromagenRequestId(req);
  const isDevHealth = isDevHealthPath(pathname);

  // Dev/health gate
  if (isDevHealth) {
    const token = req.headers.get('x-promagen-health-token') ?? '';
    const allowed =
      (DEV_HEALTH_TOKEN && token === DEV_HEALTH_TOKEN) || isPromagenInternalHost(host);
    if (!allowed) {
      const res = NextResponse.json({ error: 'Not found' }, { status: 404 });
      return applySecurityHeaders(res, true, true, requestId);
    }
  }

  const res = NextResponse.next();
  return applySecurityHeaders(res, true, isDevHealth, requestId);
});

const prodMiddleware = clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl;
  const host = url.host.toLowerCase();
  const pathname = url.pathname;

  const isDevHealth = isDevHealthPath(pathname);
  const requestId = getPromagenRequestId(req);

  // 1) Dev/health gate (token OR internal host) — keep BEFORE auth
  if (isDevHealth) {
    const token = req.headers.get('x-promagen-health-token') ?? '';
    const allowed =
      (DEV_HEALTH_TOKEN && token === DEV_HEALTH_TOKEN) || isPromagenInternalHost(host);

    if (!allowed) {
      const res = NextResponse.json({ error: 'Not found' }, { status: 404 });
      return applySecurityHeaders(res, false, true, requestId);
    }
  }

  // 2) Canonical host enforcement
  if (ENFORCE_CANONICAL && CANONICAL_HOST && host !== CANONICAL_HOST) {
    const to = `${url.protocol}//${CANONICAL_HOST}${url.pathname}${url.search}`;
    const res = NextResponse.redirect(to, 308);
    return applySecurityHeaders(res, false, isDevHealth, requestId);
  }

  // 3) Clerk protection for private areas
  if (isProtectedRoute(req)) {
    await auth.protect();

    // 3b) Admin-only gate — non-admins never see admin pages or hit admin APIs.
    //     Requires ADMIN_USER_IDS env var (comma-separated Clerk user IDs).
    //     Tier is read from session claims (Clerk Dashboard → Sessions → Customize token
    //     must include: { "publicMetadata": "{{user.public_metadata}}" }).
    //     If publicMetadata is missing from the token, tier defaults to undefined → free path.
    if (isAdminPageRoute(req) || isAdminApiRoute(req)) {
      const { userId, sessionClaims } = await auth();

      if (!userId || !ADMIN_USER_IDS.has(userId)) {
        // Read tier from JWT session claims (set via Clerk session token customisation)
        const meta = sessionClaims?.publicMetadata as { tier?: string } | undefined;
        const tier = meta?.tier;

        // API routes → 403 JSON (no redirect)
        if (isAdminApiRoute(req)) {
          const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          return applySecurityHeaders(res, false, false, requestId);
        }

        // Page routes → redirect based on tier
        //   paid (not admin) → homepage (they've already paid, nothing to upsell)
        //   free / unknown   → pro-promagen (upsell opportunity)
        const target = tier === 'paid' ? '/' : '/pro-promagen';
        const res = NextResponse.redirect(new URL(target, req.url));
        return applySecurityHeaders(res, false, false, requestId);
      }
    }
  }

  // 4) Continue
  const res = NextResponse.next();
  return applySecurityHeaders(res, false, isDevHealth, requestId);
});

const IS_DEV = process.env.NODE_ENV === 'development';

export default IS_DEV ? devMiddleware : prodMiddleware;

export const config = {
  matcher: [
    // Skip Next.js internals and common static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
