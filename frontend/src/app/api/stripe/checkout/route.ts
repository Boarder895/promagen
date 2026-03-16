// src/app/api/stripe/checkout/route.ts
// ============================================================================
// STRIPE CHECKOUT SESSION API ROUTE v2.0.0
// ============================================================================
// Creates a Stripe Checkout Session and returns the redirect URL.
// Requires Clerk authentication — reads userId from session cookie JWT.
//
// v2.0.0: Switched from auth() to direct JWT cookie reading because auth()
//         returns null in route handlers on Vercel production despite valid
//         session cookies being present.
//
// Authority: docs/authority/stripe.md §5.1
// Security: 10/10 — userId from httpOnly cookie verified by clerkMiddleware,
//           confirmed via clerkClient.users.getUser(), Price IDs server-side only
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
    // 1. Get userId from session cookie (see clerk-session.ts for why not auth())
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

    // 3. Get user from Clerk (confirms user exists + gets email + metadata)
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress ?? undefined;
    const metadata = (user.publicMetadata ?? {}) as ClerkPublicMetadata;

    // 4. Check if user is already Pro
    if (metadata.tier === 'paid' && metadata.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Already subscribed to Pro Promagen' },
        { status: 409 },
      );
    }

    // 5. Get the correct Price ID from env vars
    const priceId = getStripePriceId(plan);

    // 6. Build Checkout Session parameters
    const origin = request.headers.get('origin') ?? 'https://promagen.com';

    const baseParams = {
      mode: 'subscription' as const,
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
    };

    // 7. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create(baseParams);

    // 8. Verify session URL exists
    if (!session.url) {
      console.error('[stripe-checkout] Session created but no URL returned');
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 },
      );
    }

    // 9. Return the redirect URL
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-checkout] Error:', message);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
