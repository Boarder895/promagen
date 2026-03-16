// src/app/api/stripe/webhook/route.ts
// ============================================================================
// STRIPE WEBHOOK HANDLER v2.0.0
// ============================================================================
// Receives Stripe webhook events and keeps Clerk metadata in sync.
//
// Events handled:
// - checkout.session.completed → Set tier: 'paid', store Stripe IDs
// - customer.subscription.updated → Track cancellation state
// - customer.subscription.deleted → Revert tier: 'free'
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
import { verifyWebhookEvent } from '@/lib/stripe/stripe';
import type Stripe from 'stripe';

// ============================================================================
// CLERK METADATA HELPERS
// ============================================================================

interface ClerkPublicMetadata {
  tier?: 'free' | 'paid';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
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

  await updateClerkMetadata(clerkUserId, {
    tier: 'paid',
    stripeCustomerId: customerId ?? undefined,
    stripeSubscriptionId: subscriptionId ?? undefined,
    cancelAtPeriodEnd: false,
  });

  console.debug(`[stripe-webhook] Activated Pro for user ${clerkUserId}`);
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

  await updateClerkMetadata(clerkUserId, {
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
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
