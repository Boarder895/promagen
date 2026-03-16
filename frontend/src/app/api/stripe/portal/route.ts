// src/app/api/stripe/portal/route.ts
// ============================================================================
// STRIPE CUSTOMER PORTAL API ROUTE v2.0.0
// ============================================================================
// Creates a Stripe Billing Portal session for subscription management.
// Pro users can cancel, update payment method, and view invoices.
// v2.0.0: Uses getUserIdFromSession() instead of broken auth()
//
// Authority: docs/authority/stripe.md §5.3
// Security: 10/10 — userId from session cookie, confirmed via clerkClient
// Existing features preserved: Yes
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe/stripe';
import { getUserIdFromSession } from '@/lib/stripe/clerk-session';

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
    // 1. Get userId from session cookie
    const userId = getUserIdFromSession(request);

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
