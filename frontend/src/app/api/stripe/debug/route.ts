// TEMPORARY — Tests Stripe key by listing products
// DELETE AFTER CHECKOUT WORKS

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserIdFromSession } from '@/lib/stripe/clerk-session';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const diagnostics: Record<string, unknown> = {};

  // 1. Auth check (JWT cookie approach)
  const userId = getUserIdFromSession(request);
  diagnostics.auth = { userId: userId ?? 'NULL', works: !!userId };

  // 2. Check Stripe key format
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? '';
  diagnostics.stripeKey = {
    length: stripeKey.length,
    prefix: stripeKey.slice(0, 12),
    validFormat: stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_'),
    hasWhitespace: stripeKey !== process.env.STRIPE_SECRET_KEY,
  };

  // 3. Try to use the key — list products from Stripe
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey);
    const products = await stripe.products.list({ limit: 5 });
    diagnostics.stripeApi = {
      works: true,
      productCount: products.data.length,
      productNames: products.data.map((p) => p.name),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    diagnostics.stripeApi = {
      works: false,
      error: message,
    };
  }

  // 4. Check price IDs
  diagnostics.priceIds = {
    monthly: process.env.STRIPE_PRICE_MONTHLY?.slice(0, 15) ?? 'NOT_SET',
    annual: process.env.STRIPE_PRICE_ANNUAL?.slice(0, 15) ?? 'NOT_SET',
  };

  // 5. Try to fetch the monthly price directly
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey);
    const priceId = process.env.STRIPE_PRICE_MONTHLY ?? '';
    const price = await stripe.prices.retrieve(priceId);
    diagnostics.monthlyPrice = {
      works: true,
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    diagnostics.monthlyPrice = {
      works: false,
      error: message,
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
