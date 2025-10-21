import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/prompt/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace('/prompt/', '/prompts/');
    return NextResponse.redirect(url, 308);
  }
  if (pathname === '/prompt') {
    const url = request.nextUrl.clone();
    url.pathname = '/prompts';
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/prompt', '/prompt/:path*'] };
