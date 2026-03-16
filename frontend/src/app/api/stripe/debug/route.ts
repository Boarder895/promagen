// TEMPORARY DIAGNOSTIC — DELETE AFTER CONFIRMING CHECKOUT WORKS

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserIdFromSession } from '@/lib/stripe/clerk-session';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const diagnostics: Record<string, unknown> = {};

  // 1. auth() — the broken path
  try {
    const authResult = await auth();
    diagnostics.authDirect = {
      userId: authResult.userId ?? 'NULL',
      works: !!authResult.userId,
    };
  } catch (err) {
    diagnostics.authDirect = { error: err instanceof Error ? err.message : String(err) };
  }

  // 2. JWT cookie reading — the new approach
  const cookieUserId = getUserIdFromSession(request);
  diagnostics.cookieJwt = {
    userId: cookieUserId ?? 'NULL',
    works: !!cookieUserId,
  };

  // 3. Session cookies present
  const cookieNames = request.cookies.getAll().map((c) => c.name);
  diagnostics.sessionCookies = cookieNames.filter((n) => n.startsWith('__session'));

  return NextResponse.json(diagnostics, { status: 200 });
}
