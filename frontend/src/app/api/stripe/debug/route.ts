// src/app/api/stripe/debug/route.ts
// TEMPORARY DIAGNOSTIC — DELETE AFTER DEBUGGING
// Tests auth() and env vars to find the checkout bug

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(): Promise<NextResponse> {
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

  // 2. Test env vars exist (don't expose values)
  diagnostics.envVars = {
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_MONTHLY: !!process.env.STRIPE_PRICE_MONTHLY,
    STRIPE_PRICE_ANNUAL: !!process.env.STRIPE_PRICE_ANNUAL,
    STRIPE_SECRET_KEY_PREFIX: process.env.STRIPE_SECRET_KEY?.slice(0, 8) ?? 'NOT_SET',
    STRIPE_PRICE_MONTHLY_PREFIX: process.env.STRIPE_PRICE_MONTHLY?.slice(0, 10) ?? 'NOT_SET',
    STRIPE_PRICE_ANNUAL_PREFIX: process.env.STRIPE_PRICE_ANNUAL?.slice(0, 10) ?? 'NOT_SET',
  };

  // 3. Test Stripe import
  try {
    const { stripe } = await import('@/lib/stripe/stripe');
    diagnostics.stripe = {
      loaded: true,
      type: typeof stripe,
    };
  } catch (err) {
    diagnostics.stripe = {
      loaded: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}

export async function POST(): Promise<NextResponse> {
  // Same test but via POST to match checkout route method
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

  return NextResponse.json(diagnostics, { status: 200 });
}
