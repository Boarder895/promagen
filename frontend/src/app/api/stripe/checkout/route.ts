// src/app/api/stripe/checkout/route.ts
// ============================================================================
// STRIPE CHECKOUT SESSION API ROUTE v3.0.0
// ============================================================================
// Creates a Stripe Checkout Session and returns the redirect URL.
//
// Auth: Reads all data from __session cookie JWT. Does NOT call clerkClient
// (which throws Unauthorized on Vercel production).
//
// Authority: docs/authority/stripe.md §5.1
// Existing features preserved: Yes
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromCookie } from '@/lib/stripe/clerk-session';
import Stripe from 'stripe';

// ============================================================================
// TYPES
// ============================================================================

interface CheckoutRequestBody {
  plan?: unknown;
  email?: unknown;
}

// ============================================================================
// HELPERS
// ============================================================================

function getStripePriceId(plan: 'monthly' | 'annual'): string {
  const key = plan === 'monthly' ? 'STRIPE_PRICE_MONTHLY' : 'STRIPE_PRICE_ANNUAL';
  const priceId = (process.env[key] ?? '').trim();
  if (!priceId) throw new Error(`${key} is not set`);
  return priceId;
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Get session data from JWT cookie (no Clerk API calls)
    const session = getSessionFromCookie(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Sign in required to subscribe' },
        { status: 401 },
      );
    }

    // 2. Parse and validate request body
    const body = (await request.json()) as CheckoutRequestBody;
    const plan = body.plan;
    // Email from client (Clerk useUser hook) — used to pre-fill Stripe Checkout
    const clientEmail = typeof body.email === 'string' && body.email.includes('@')
      ? body.email : undefined;

    if (plan !== 'monthly' && plan !== 'annual') {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "monthly" or "annual".' },
        { status: 400 },
      );
    }

    // 3. Block if already Pro (from JWT metadata)
    if (session.tier === 'paid' && session.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Already subscribed to Pro Promagen' },
        { status: 409 },
      );
    }

    // 4. Get Price ID
    const priceId = getStripePriceId(plan);

    // 5. Create fresh Stripe client
    const stripeKey = (process.env.STRIPE_SECRET_KEY ?? '').trim();
    if (!stripeKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }
    const stripeClient = new Stripe(stripeKey);

    // 6. Create Checkout Session
    const origin = request.headers.get('origin') ?? 'https://promagen.com';

    const checkoutSession = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { clerkUserId: session.userId },
      },
      metadata: { clerkUserId: session.userId },
      success_url: `${origin}/pro-promagen?success=true`,
      cancel_url: `${origin}/pro-promagen`,
      allow_promotion_codes: true,
      ...(session.stripeCustomerId
        ? { customer: session.stripeCustomerId }
        : (clientEmail ?? session.email)
          ? { customer_email: clientEmail ?? session.email }
          : {}),
    });

    if (!checkoutSession.url) {
      return NextResponse.json({ error: 'No checkout URL returned' }, { status: 500 });
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-checkout] Error:', message);
    return NextResponse.json(
      { error: `Checkout failed: ${message}` },
      { status: 500 },
    );
  }
}
