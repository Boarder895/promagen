// src/lib/stripe/stripe.ts
// ============================================================================
// STRIPE CLIENT SINGLETON v1.0.0
// ============================================================================
// Server-side Stripe client. NEVER import this from client components.
//
// Authority: docs/authority/stripe.md §5
// Security: 10/10 — Server-only, env var validated at init
// Existing features preserved: Yes
// ============================================================================

import Stripe from 'stripe';

// ============================================================================
// SINGLETON
// ============================================================================

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(
    '[stripe] STRIPE_SECRET_KEY is not set. Add it to .env.local or Vercel env vars.',
  );
}

export const stripe = new Stripe(stripeSecretKey, {
  typescript: true,
});

// ============================================================================
// PRICE HELPERS
// ============================================================================

export function getStripePriceId(plan: 'monthly' | 'annual'): string {
  const key = plan === 'monthly' ? 'STRIPE_PRICE_MONTHLY' : 'STRIPE_PRICE_ANNUAL';
  const priceId = process.env[key];

  if (!priceId) {
    throw new Error(`[stripe] ${key} is not set.`);
  }

  return priceId;
}

// ============================================================================
// WEBHOOK VERIFICATION
// ============================================================================

export function verifyWebhookEvent(
  rawBody: string | Buffer,
  signature: string,
): Stripe.Event | null {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[stripe] STRIPE_WEBHOOK_SECRET is not set.');
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[stripe] Webhook verification failed:', message);
    return null;
  }
}
