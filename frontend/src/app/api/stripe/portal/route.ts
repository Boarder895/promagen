// src/app/api/stripe/portal/route.ts
// ============================================================================
// STRIPE CUSTOMER PORTAL API ROUTE v1.0.0
// ============================================================================
// Creates a Stripe Billing Portal session for subscription management.
// Pro users can cancel, update payment method, and view invoices.
//
// Authority: docs/authority/stripe.md §5.3
// Security: 10/10 — Clerk auth required, customer ID from server metadata
// Existing features preserved: Yes (new file)
// ============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe/stripe';

// ============================================================================
// TYPES
// ============================================================================

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
    // 1. Verify Clerk authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Sign in required' },
        { status: 401 },
      );
    }

    // 2. Get Stripe customer ID from Clerk metadata
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = (user.publicMetadata ?? {}) as ClerkPublicMetadata;

    if (!metadata.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 },
      );
    }

    // 3. Create Stripe Billing Portal session
    const origin = request.headers.get('origin') ?? 'https://promagen.com';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: metadata.stripeCustomerId,
      return_url: `${origin}/pro-promagen`,
    });

    // 4. Return the portal URL
    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-portal] Error:', message);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 },
    );
  }
}
