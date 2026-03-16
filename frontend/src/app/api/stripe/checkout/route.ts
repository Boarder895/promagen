// src/app/api/stripe/checkout/route.ts
// v2.1.0 — Per-step error trapping to identify exact failure point

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getStripePriceId } from '@/lib/stripe/stripe';
import { getUserIdFromSession } from '@/lib/stripe/clerk-session';
import Stripe from 'stripe';

interface CheckoutRequestBody { plan?: unknown; }
interface ClerkPublicMetadata {
  tier?: 'free' | 'paid';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Step 1: Auth
  const userId = getUserIdFromSession(request);
  if (!userId) {
    return NextResponse.json({ error: 'Step 1 failed: No userId in session cookie' }, { status: 401 });
  }

  // Step 2: Parse body
  let plan: string;
  try {
    const body = (await request.json()) as CheckoutRequestBody;
    plan = body.plan as string;
    if (plan !== 'monthly' && plan !== 'annual') {
      return NextResponse.json({ error: 'Step 2 failed: Invalid plan' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: `Step 2 failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 400 });
  }

  // Step 3: Clerk user lookup
  let email: string | undefined;
  let metadata: ClerkPublicMetadata;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    email = user.emailAddresses[0]?.emailAddress ?? undefined;
    metadata = (user.publicMetadata ?? {}) as ClerkPublicMetadata;
  } catch (err) {
    return NextResponse.json({ error: `Step 3 failed (Clerk getUser): ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  // Step 4: Already Pro check
  if (metadata.tier === 'paid' && metadata.stripeSubscriptionId) {
    return NextResponse.json({ error: 'Step 4: Already subscribed' }, { status: 409 });
  }

  // Step 5: Price ID
  let priceId: string;
  try {
    priceId = getStripePriceId(plan as 'monthly' | 'annual');
  } catch (err) {
    return NextResponse.json({ error: `Step 5 failed (Price ID): ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  // Step 6: Create Stripe instance fresh (not singleton — avoids cached old key)
  let stripeClient: Stripe;
  try {
    const key = (process.env.STRIPE_SECRET_KEY ?? '').trim();
    if (!key) {
      return NextResponse.json({ error: 'Step 6 failed: STRIPE_SECRET_KEY not set' }, { status: 500 });
    }
    stripeClient = new Stripe(key);
  } catch (err) {
    return NextResponse.json({ error: `Step 6 failed (Stripe init): ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }

  // Step 7: Create Checkout Session
  try {
    const origin = request.headers.get('origin') ?? 'https://promagen.com';

    const session = await stripeClient.checkout.sessions.create({
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
      return NextResponse.json({ error: 'Step 7 failed: No URL returned' }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[stripe-checkout] Step 7 error:', message);
    return NextResponse.json({ error: `Step 7 failed (Stripe session): ${message}` }, { status: 500 });
  }
}
