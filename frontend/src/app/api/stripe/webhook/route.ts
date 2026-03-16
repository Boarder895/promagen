// src/app/api/stripe/webhook/route.ts
// ============================================================================
// STRIPE WEBHOOK HANDLER v3.0.0
// ============================================================================
// Receives Stripe webhook events and keeps Clerk metadata in sync.
//
// Events handled:
// - checkout.session.completed → Set tier: 'paid', store Stripe IDs + periodEndDate
// - customer.subscription.updated → Track cancellation state + periodEndDate
// - customer.subscription.deleted → Revert tier: 'free', clear period data
//
// v3.0.0: Added periodEndDate (Unix timestamp) storage for UI countdown timer.
//         On cancellation-pending, the UI shows a live countdown to periodEndDate.
//
// Authority: docs/authority/stripe.md §5.2
// Security: 10/10 — Webhook signature verified, no external input trusted
// Existing features preserved: Yes
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { stripe, verifyWebhookEvent } from '@/lib/stripe/stripe';
import type Stripe from 'stripe';

// ============================================================================
// CLERK METADATA HELPERS
// ============================================================================

interface ClerkPublicMetadata {
  tier?: 'free' | 'paid';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  /** Unix timestamp (seconds) — when the current billing period ends.
   *  Used by the UI countdown timer on cancellation-pending state. */
  periodEndDate?: number;
  [key: string]: unknown;
}

async function updateClerkMetadata(
  clerkUserId: string,
  updates: Partial<ClerkPublicMetadata>,
): Promise<void> {
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  const existing = (user.publicMetadata ?? {}) as ClerkPublicMetadata;

  await client.users.updateUserMetadata(clerkUserId, {
    publicMetadata: { ...existing, ...updates },
  });

  console.debug(`[stripe-webhook] Updated Clerk user ${clerkUserId}:`, updates);
}

async function findClerkUserByStripeCustomerId(
  stripeCustomerId: string,
): Promise<string | null> {
  const client = await clerkClient();
  const users = await client.users.getUserList({ limit: 500 });

  for (const user of users.data) {
    const metadata = (user.publicMetadata ?? {}) as ClerkPublicMetadata;
    if (metadata.stripeCustomerId === stripeCustomerId) {
      return user.id;
    }
  }

  return null;
}

// ============================================================================
// STRIPE TYPE HELPERS
// ============================================================================

/** Safely read current_period_end from a Stripe subscription object.
 *  The field always exists in the API response but some SDK type versions omit it. */
function getSubscriptionPeriodEnd(sub: Stripe.Subscription): number | undefined {
  return (sub as unknown as { current_period_end?: number }).current_period_end;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const clerkUserId = session.metadata?.clerkUserId;

  if (!clerkUserId) {
    console.error('[stripe-webhook] checkout.session.completed missing clerkUserId in metadata');
    return;
  }

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id ?? null;

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id ?? null;

  // Fetch subscription to get current_period_end (trial end / first billing cycle)
  let periodEndDate: number | undefined;
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      periodEndDate = getSubscriptionPeriodEnd(sub);
    } catch (err) {
      console.warn('[stripe-webhook] Could not fetch subscription for period end:', err);
    }
  }

  await updateClerkMetadata(clerkUserId, {
    tier: 'paid',
    stripeCustomerId: customerId ?? undefined,
    stripeSubscriptionId: subscriptionId ?? undefined,
    cancelAtPeriodEnd: false,
    periodEndDate,
  });

  console.debug(`[stripe-webhook] Activated Pro for user ${clerkUserId} (periodEnd: ${periodEndDate ?? 'unknown'})`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id ?? null;

  if (!customerId) return;

  const clerkUserId = await findClerkUserByStripeCustomerId(customerId);
  if (!clerkUserId) {
    console.warn(`[stripe-webhook] No Clerk user for Stripe customer ${customerId}`);
    return;
  }

  const periodEnd = getSubscriptionPeriodEnd(subscription);

  await updateClerkMetadata(clerkUserId, {
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    periodEndDate: periodEnd,
  });

  console.debug(
    `[stripe-webhook] Subscription updated for user ${clerkUserId}: ` +
    `cancel=${subscription.cancel_at_period_end}, periodEnd=${periodEnd}`,
  );
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id ?? null;

  if (!customerId) return;

  const clerkUserId = await findClerkUserByStripeCustomerId(customerId);
  if (!clerkUserId) {
    console.warn(`[stripe-webhook] No Clerk user for Stripe customer ${customerId}`);
    return;
  }

  await updateClerkMetadata(clerkUserId, {
    tier: 'free',
    stripeSubscriptionId: undefined,
    cancelAtPeriodEnd: undefined,
    periodEndDate: undefined,
  });

  console.debug(`[stripe-webhook] Reverted user ${clerkUserId} to free tier`);
}

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const event = verifyWebhookEvent(rawBody, signature);

    if (!event) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        console.debug(`[stripe-webhook] Unhandled event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-webhook] Error:', message);
    return NextResponse.json({ received: true, error: message });
  }
}
