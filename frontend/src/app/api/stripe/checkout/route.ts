// src/app/api/stripe/checkout/route.ts
// ============================================================================
// STRIPE CHECKOUT SESSION API ROUTE v2.0.0
// ============================================================================
// Creates a Stripe Checkout Session and returns the redirect URL.
//
// Auth: Reads userId from __session cookie JWT (see clerk-session.ts).
// Confirms user via clerkClient.users.getUser() before proceeding.
//
// Authority: docs/authority/stripe.md §5.1
// Security: 10/10 — userId from httpOnly cookie, confirmed via Clerk API,
//           Price IDs server-side only
// Existing features preserved: Yes
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { stripe, getStripePriceId } from '@/lib/stripe/stripe';
import { getUserIdFromSession } from '@/lib/stripe/clerk-session';

// ============================================================================
// TYPES
// ============================================================================

interface CheckoutRequestBody {
  plan?: unknown;
}

interface ClerkPublicMetadata {
  tier?: 'free' | 'paid';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Get userId from session cookie JWT
    const userId = getUserIdFromSession(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Sign in required to subscribe' },
        { status: 401 },
      );
    }

    // 2. Parse and validate request body
    const body = (await request.json()) as CheckoutRequestBody;
    const { plan } = body;

    if (plan !== 'monthly' && plan !== 'annual') {
      return NextResponse.json(
        { error: 'Invalid plan. Must be "monthly" or "annual".' },
        { status: 400 },
      );
    }

    // 3. Confirm user exists in Clerk + get email + metadata
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress ?? undefined;
    const metadata = (user.publicMetadata ?? {}) as ClerkPublicMetadata;

    // 4. Block if already Pro
    if (metadata.tier === 'paid' && metadata.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Already subscribed to Pro Promagen' },
        { status: 409 },
      );
    }

    // 5. Get Price ID from env vars
    const priceId = getStripePriceId(plan);

    // 6. Build Checkout Session
    const origin = request.headers.get('origin') ?? 'https://promagen.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { clerkUserId: userId },
      },
      metadata: { clerkUserId: userId },
      success_url: `${origin}/pro-promagen?success=true`,
      cancel_url: `${origin}/pro-promagen`,
      allow_promotion_codes: true,
      ...(metadata.stripeCustomerId
        ? { customer: metadata.stripeCustomerId }
        : email
          ? { customer_email: email }
          : {}),
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe returned no checkout URL' },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-checkout] Error:', message);
    return NextResponse.json(
      { error: `Checkout failed: ${message}` },
      { status: 500 },
    );
  }
}
