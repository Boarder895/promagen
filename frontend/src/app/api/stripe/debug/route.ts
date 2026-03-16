// src/app/api/stripe/debug/route.ts
// TEMPORARY DIAGNOSTIC — DELETE AFTER DEBUGGING

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const diagnostics: Record<string, unknown> = {};

  // 1. Test auth()
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

  // 2. Check what cookies the browser sent (names only, not values)
  const cookieNames = request.cookies.getAll().map((c) => c.name);
  const clerkCookies = cookieNames.filter(
    (n) => n.startsWith('__clerk') || n.startsWith('__session') || n.startsWith('__client'),
  );
  diagnostics.cookies = {
    totalCount: cookieNames.length,
    allNames: cookieNames,
    clerkCookies: clerkCookies,
    hasSessionCookie: cookieNames.includes('__session'),
    hasClerkDbJwt: cookieNames.includes('__clerk_db_jwt'),
  };

  // 3. Check relevant headers
  diagnostics.headers = {
    host: request.headers.get('host'),
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    hasAuthHeader: !!request.headers.get('authorization'),
  };

  // 4. Env check
  diagnostics.envVars = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV ?? 'NOT_SET',
  };

  // 5. Check Clerk env vars
  diagnostics.clerkEnv = {
    hasPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    hasSecretKey: !!process.env.CLERK_SECRET_KEY,
    publishableKeyPrefix: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.slice(0, 12) ?? 'NOT_SET',
  };

  return NextResponse.json(diagnostics, { status: 200 });
}
