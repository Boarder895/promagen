// frontend/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
const USER = process.env.BASIC_AUTH_USER;
const PASS = process.env.BASIC_AUTH_PASS;
export function middleware(req: NextRequest) {
  if (!USER || !PASS) return NextResponse.next();
  const a = req.headers.get('authorization');
  if (a?.startsWith('Basic ')) {
    const [u, p] = Buffer.from(a.split(' ')[1], 'base64').toString().split(':');
    if (u === USER && p === PASS) return NextResponse.next();
  }
  return new NextResponse('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Promagen Preview"' },
  });
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };