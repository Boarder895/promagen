// src/app/api/stripe/portal/route.ts
// ============================================================================
// STRIPE CUSTOMER PORTAL API ROUTE v2.1.0
// ============================================================================
// Creates a Stripe Billing Portal session for subscription management.
//
// v2.1.0:
// - FIX: Lazy Stripe client creation — missing STRIPE_SECRET_KEY no longer
//   crashes the module at import time, which was causing noisy 500 errors.
// - FIX: Session check happens before Clerk/Stripe work.
// - KEPT: Same response contract ({ url } or { error }).
//
// Authority: docs/authority/stripe.md §5.3
// Security: 10/10 — userId from signed session, metadata read server-side
// Existing features preserved: Yes
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';
import { getUserIdFromSession } from '@/lib/stripe/clerk-session';

interface ClerkPublicMetadata {
  tier?: 'free' | 'paid';
  stripeCustomerId?: string;
}

function getStripeClient(): Stripe {
  const stripeKey = (process.env.STRIPE_SECRET_KEY ?? '').trim();

  if (!stripeKey) {
    throw new Error('Stripe not configured');
  }

  return new Stripe(stripeKey, { typescript: true });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserIdFromSession(request);

    if (!userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = (user.publicMetadata ?? {}) as ClerkPublicMetadata;

    if (!metadata.stripeCustomerId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    const stripe = getStripeClient();
    const origin = request.headers.get('origin') ?? 'https://promagen.com';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: metadata.stripeCustomerId,
      return_url: `${origin}/pro-promagen`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-portal] Error:', message);
    return NextResponse.json(
      { error: message === 'Stripe not configured' ? message : 'Failed to create portal session' },
      { status: 500 },
    );
  }
}
