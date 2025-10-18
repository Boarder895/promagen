import type { NextRequest } from 'next/server';

export function middleware(_req: NextRequest) {
  // no-op middleware
  return;
}

export const config = { matcher: [] };

