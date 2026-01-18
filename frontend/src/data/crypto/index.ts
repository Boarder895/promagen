// src/data/crypto/index.ts

import assetsCatalogJson from './assets.catalog.json';
import selectedJson from './crypto.selected.json';
import {
  cryptoAssetsCatalogSchema,
  cryptoDefaultsSchema,
  type CryptoAssetsCatalog,
  type CryptoDefaults,
} from './crypto.schema';

/**
 * Master crypto catalogue (top 100).
 *
 * Build-time validated via Zod so the ribbon and gateway never consume
 * malformed or drifted SSOT data.
 */
export const assetsCatalog: CryptoAssetsCatalog =
  cryptoAssetsCatalogSchema.parse(assetsCatalogJson);

/**
 * Default free-tier crypto selection for the homepage ribbon (exactly 8 ids).
 */
export const cryptoDefaults: CryptoDefaults = cryptoDefaultsSchema.parse(selectedJson);

// ---------------------------------------------------------------------------
// Cross-file integrity checks (defence in depth)
// ---------------------------------------------------------------------------

const idSet = new Set(assetsCatalog.map((a) => a.id));
const missingDefaults = cryptoDefaults.ids.filter((id) => !idSet.has(id));

if (missingDefaults.length > 0) {
  throw new Error(
    `crypto SSOT integrity error: crypto.selected.json contains ids not present in assets.catalog.json: ${missingDefaults.join(
      ', ',
    )}`,
  );
}
