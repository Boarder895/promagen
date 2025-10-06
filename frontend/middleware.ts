import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Edge runtime only – no fs/path/process.cwd/etc.
export const config = {
  matcher: [
    // Only run on real app routes; skip Next assets and sitemap stuff
    '/((?!_next/|favicon.ico|robots.txt|sitemap.xml|static/).*)'
  ]
};

export function middleware(_req: NextRequest) {
  // Keep it tiny and pure: e.g., add a response header
  const res = NextResponse.next();
  res.headers.set('x-promagen', '1');
  return res;
}
