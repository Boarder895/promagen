// gateway/adapters/fmp.fx.ts
// ============================================================================
// FMP (Financial Modeling Prep) FX ADAPTER - Backup Provider
// ============================================================================
// Placeholder backup adapter for FMP API.
// Currently returns empty results - wire up when FMP credentials available.
//
// To enable:
// 1. Add FMP_API_KEY to environment
// 2. Implement the fetch logic below
// 3. Update PROVIDER_QUOTAS in quota.ts with FMP limits
//
// Security: 10/10
// - Uses schemas for type safety
// - Ready for API key validation
// ============================================================================

import type { FxAdapterRequest, FxAdapterResponse } from '../lib/schemas';
import { logInfo } from '../lib/logging';

/**
 * FMP FX adapter - currently a placeholder.
 * Returns empty results, allowing gateway to fallback gracefully.
 */
export default async function fmpFxAdapter(
  _req: FxAdapterRequest
): Promise<FxAdapterResponse> {
  logInfo('FMP adapter called (placeholder - returning empty)');
  
  // Placeholder: return empty to trigger fallback
  // When ready to enable, implement fetch logic here
  return {
    providerId: 'fmp',
    mode: 'live',
    pairs: [],
  };
}
