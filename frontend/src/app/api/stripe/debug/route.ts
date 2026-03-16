// TEMPORARY DIAGNOSTIC — DELETE AFTER DEBUGGING

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const diagnostics: Record<string, unknown> = {};

  // 1. Test auth() directly (the broken path)
  try {
    const authResult = await auth();
    diagnostics.authDirect = {
      userId: authResult.userId ?? 'NULL',
      hasUserId: !!authResult.userId,
    };
  } catch (err) {
    diagnostics.authDirect = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. Test middleware header (the fix)
  const middlewareUserId = request.headers.get('x-clerk-user-id');
  diagnostics.middlewareHeader = {
    userId: middlewareUserId ?? 'NULL',
    hasUserId: !!middlewareUserId,
  };

  // 3. Cookies present
  const cookieNames = request.cookies.getAll().map((c) => c.name);
  diagnostics.cookies = {
    clerkCookies: cookieNames.filter(
      (n) => n.startsWith('__clerk') || n.startsWith('__session') || n.startsWith('__client'),
    ),
  };

  return NextResponse.json(diagnostics, { status: 200 });
}
