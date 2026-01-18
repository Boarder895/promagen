// src/app/api/crypto/config/route.ts
/**
 * /api/crypto/config — SSOT endpoint for gateway Crypto feed initialisation.
 *
 * Option A (selected.json list):
 * - Free-tier defaults come ONLY from src/data/crypto/crypto.selected.json (ordered).
 * - Paid users may select any IDs from src/data/crypto/assets.catalog.json (validated in gateway).
 *
 * Strict SSOT rules:
 * - No demo/synthetic prices are emitted.
 * - Defaults must be a subset of the catalogue; if not, this route throws.
 */

import { NextResponse } from 'next/server';

import cryptoCatalogJson from '@/data/crypto/assets.catalog.json';
import cryptoSelectedJson from '@/data/crypto/crypto.selected.json';

type CryptoCatalogItem = {
  id: string;
  symbol: string;
  name: string;
  ribbonLabel?: string;
  rankHint?: number;
  isActive?: boolean;
  isSelectableInRibbon?: boolean;
};

type CryptoSelected = {
  ids: string[];
};

export const runtime = 'edge';
export const revalidate = 3600; // 1 hour cache

export async function GET(): Promise<Response> {
  const all = cryptoCatalogJson as CryptoCatalogItem[];
  const selected = cryptoSelectedJson as CryptoSelected;

  const active = all.filter((c) => c.isActive !== false);

  const idSet = new Set(active.map((c) => c.id));
  const defaultCryptoIds = Array.isArray(selected.ids) ? selected.ids : [];

  if (defaultCryptoIds.length !== 8) {
    throw new Error(
      `crypto SSOT integrity error: crypto.selected.json must contain exactly 8 ids (got ${defaultCryptoIds.length})`,
    );
  }

  const missing = defaultCryptoIds.filter((id) => !idSet.has(id));
  if (missing.length > 0) {
    throw new Error(
      `crypto SSOT integrity error: crypto.selected.json contains ids not present in assets.catalog.json: ${missing.join(', ')}`,
    );
  }

  const crypto = active.map((c) => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    ribbonLabel: c.ribbonLabel ?? c.name,
    rankHint: c.rankHint ?? null,
    isActive: c.isActive ?? true,
    isSelectableInRibbon: c.isSelectableInRibbon ?? true,
    priority: c.rankHint ?? null,
  }));

  return NextResponse.json(
    {
      version: 1,
      ssot: {
        catalog: 'frontend/src/data/crypto/assets.catalog.json',
        selected: 'frontend/src/data/crypto/crypto.selected.json',
      },
      generatedAt: new Date().toISOString(),
      defaultCryptoIds,
      crypto,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    },
  );
}
