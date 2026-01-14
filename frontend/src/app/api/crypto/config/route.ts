// src/app/api/crypto/config/route.ts
/**
 * /api/crypto/config — SSOT endpoint for gateway Crypto feed initialization.
 *
 * Returns cryptocurrency catalog with default cryptos for the ribbon.
 * Gateway fetches this on startup to know which cryptos to query.
 *
 * Data source: frontend/src/data/crypto/assets.catalog.json
 */

import { NextResponse } from 'next/server';

import cryptoCatalogJson from '@/data/crypto/assets.catalog.json';

// Type for crypto from catalog
interface CryptoCatalog {
  id: string;
  symbol: string;
  name: string;
  ribbonLabel?: string;
  brandColor?: string;
  rankHint?: number;
  isActive?: boolean;
  isSelectableInRibbon?: boolean;
  isDefaultFree?: boolean;
  isDefaultPaid?: boolean;
  demoPrice?: number;
  priority?: number;
}

// Demo prices for top cryptos (used when live data unavailable)
const DEMO_PRICES: Record<string, number> = {
  btc: 95000,
  eth: 3200,
  usdt: 1.0,
  bnb: 680,
  sol: 185,
  usdc: 1.0,
  xrp: 2.35,
  ton: 5.5,
  doge: 0.32,
  ada: 0.95,
  trx: 0.24,
  avax: 35,
  link: 22,
  shib: 0.000022,
  dot: 7.5,
  bch: 450,
  ltc: 105,
  xlm: 0.42,
};

export const runtime = 'edge';
export const revalidate = 3600; // 1 hour cache

export async function GET(): Promise<Response> {
  const allCryptos = cryptoCatalogJson as CryptoCatalog[];

  // Filter active cryptos only
  const activeCryptos = allCryptos.filter((c) => c.isActive !== false);

  // Default cryptos: first 8 by rankHint (top market cap)
  // Use isDefaultFree if set, otherwise take first 8 active
  let defaultCryptoIds = activeCryptos.filter((c) => c.isDefaultFree === true).map((c) => c.id);

  // If no explicit defaults, use first 8 by rank
  if (defaultCryptoIds.length === 0) {
    defaultCryptoIds = activeCryptos
      .sort((a, b) => (a.rankHint ?? 999) - (b.rankHint ?? 999))
      .slice(0, 8)
      .map((c) => c.id);
  }

  // Build response format expected by gateway
  // NOTE: Key must be 'crypto' (not 'cryptos') for gateway compatibility
  const crypto = activeCryptos.map((c) => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    ribbonLabel: c.ribbonLabel ?? c.name,
    brandColor: c.brandColor ?? '#FFFFFF',
    rankHint: c.rankHint ?? null,
    isActive: c.isActive ?? true,
    isSelectableInRibbon: c.isSelectableInRibbon ?? true,
    isDefaultFree: c.isDefaultFree ?? defaultCryptoIds.includes(c.id),
    isDefaultPaid: c.isDefaultPaid ?? false,
    demoPrice: c.demoPrice ?? DEMO_PRICES[c.id] ?? null,
    priority: c.priority ?? c.rankHint ?? null,
  }));

  return NextResponse.json(
    {
      version: 1,
      ssot: 'frontend/src/data/crypto/assets.catalog.json',
      generatedAt: new Date().toISOString(),
      defaultCryptoIds,
      crypto, // Gateway expects 'crypto' not 'cryptos'
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
