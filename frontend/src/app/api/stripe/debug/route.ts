// TEMPORARY DIAGNOSTIC — DELETE AFTER DEBUGGING

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const diagnostics: Record<string, unknown> = {};

  try {
    const authResult = await auth();
    diagnostics.auth = {
      userId: authResult.userId ?? 'NULL',
      sessionId: authResult.sessionId ?? 'NULL',
      hasUserId: !!authResult.userId,
    };
  } catch (err) {
    diagnostics.auth = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const cookieNames = request.cookies.getAll().map((c) => c.name);
  diagnostics.cookies = {
    clerkCookies: cookieNames.filter(
      (n) => n.startsWith('__clerk') || n.startsWith('__session') || n.startsWith('__client'),
    ),
    hasSessionCookie: cookieNames.includes('__session'),
  };

  diagnostics.runtime = 'nodejs';

  return NextResponse.json(diagnostics, { status: 200 });
}
