// src/lib/crypto/catalog.ts
/**
 * Typed helper layer over src/data/crypto (SSOT).
 *
 * Goals:
 * - Keep components/routes away from raw JSON imports.
 * - Provide a small, predictable API for default selections.
 */

import { assetsCatalog, cryptoDefaults } from '@/data/crypto';

export type CryptoAsset = (typeof assetsCatalog)[number];

/**
 * Default free-tier crypto assets for the homepage ribbon.
 *
 * SSOT rule: order MUST match defaults.json (no sorting).
 */
export function getDefaultFreeCryptoAssets(): CryptoAsset[] {
  const byId = new Map(assetsCatalog.map((a) => [a.id, a] as const));

  return cryptoDefaults.ids
    .map((id) => byId.get(id))
    .filter((a): a is CryptoAsset => Boolean(a))
    .filter((a) => a.isActive !== false && a.isSelectableInRibbon !== false);
}

/**
 * Default free-tier crypto ids for the homepage ribbon.
 */
export function getDefaultFreeCryptoIds(): string[] {
  return getDefaultFreeCryptoAssets().map((a) => a.id);
}
