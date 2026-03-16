// src/app/api/stripe/webhook/health/route.ts
// ============================================================================
// STRIPE WEBHOOK HEALTH CHECK v1.0.0
// ============================================================================
// Quick-glance JSON diagnostic for the webhook pipeline.
// Hit GET /api/stripe/webhook/health to see if everything is wired up.
//
// Returns: webhookSecret, stripeKey, clerkClient, eventsHandled, metadata schema
//
// Authority: docs/authority/stripe.md
// Security: Does NOT expose secrets — only shows prefix/length/format checks
// Existing features preserved: Yes
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  const diagnostics: Record<string, unknown> = {};

  // 1. Webhook secret check
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim();
  diagnostics.webhookSecret = {
    set: webhookSecret.length > 0,
    prefix: webhookSecret.length > 0 ? webhookSecret.slice(0, 10) + '...' : 'NOT_SET',
    validFormat: webhookSecret.startsWith('whsec_'),
  };

  // 2. Stripe key check
  const stripeKey = (process.env.STRIPE_SECRET_KEY ?? '').trim();
  diagnostics.stripeKey = {
    set: stripeKey.length > 0,
    prefix: stripeKey.length > 0 ? stripeKey.slice(0, 12) + '...' : 'NOT_SET',
    validFormat: stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_'),
    mode: stripeKey.startsWith('sk_test_') ? 'sandbox' : stripeKey.startsWith('sk_live_') ? 'live' : 'unknown',
  };

  // 3. Events handled
  diagnostics.eventsHandled = [
    'checkout.session.completed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ];

  // 4. Metadata schema (what gets stored in Clerk)
  diagnostics.metadataSchema = {
    tier: "'free' | 'paid'",
    stripeCustomerId: 'string (cus_...)',
    stripeSubscriptionId: 'string (sub_...)',
    cancelAtPeriodEnd: 'boolean',
    periodEndDate: 'number (Unix timestamp, seconds) — NEW v3.0.0',
  };

  // 5. Try a lightweight Stripe API call to verify connectivity
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey);
    // Retrieve the balance — cheapest possible Stripe API call
    const balance = await stripe.balance.retrieve();
    diagnostics.stripeApi = {
      works: true,
      mode: balance.livemode ? 'live' : 'sandbox',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    diagnostics.stripeApi = {
      works: false,
      error: message,
    };
  }

  // 6. Overall status
  const allGood =
    diagnostics.webhookSecret &&
    (diagnostics.webhookSecret as Record<string, unknown>).validFormat === true &&
    diagnostics.stripeApi &&
    (diagnostics.stripeApi as Record<string, unknown>).works === true;

  diagnostics.status = allGood ? '✅ Webhook pipeline healthy' : '⚠️ Check configuration';
  diagnostics.version = '3.0.0';
  diagnostics.timestamp = new Date().toISOString();

  return NextResponse.json(diagnostics, { status: 200 });
}
