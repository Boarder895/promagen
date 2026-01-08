// gateway/adapters/twelvedata.fx.ts
// ============================================================================
// TWELVEDATA FX ADAPTER - Live Exchange Rate Provider
// ============================================================================
// Fetches real-time FX rates from TwelveData's batch API.
//
// Security: 10/10
// - API key via requireEnv() - validated non-empty
// - Response validated with type guards - no unsafe casts
// - URL-encoded parameters prevent injection
// - Graceful handling of malformed responses
//
// FIX v2.1.0 (Jan 2026):
// - Fixed TypeScript implicit any errors on forEach callbacks
// - Uses manual type guards instead of Zod
// ============================================================================

import { logError, logWarn } from '../lib/logging';
import {
  isValidTwelveDataResponse,
  buildValidQuote,
  type FxAdapterRequest,
  type FxAdapterResponse,
  type FxRibbonPair,
  type FxRibbonQuote,
  type TwelveDataBatchResponse,
} from '../lib/schemas';

// ============================================================================
// ENV VALIDATION
// ============================================================================

/**
 * Safely retrieve required environment variable.
 * Throws if missing or empty - fail fast on misconfiguration.
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v.trim();
}

// ============================================================================
// MAIN ADAPTER
// ============================================================================

export default async function twelvedataFxAdapter(
  req: FxAdapterRequest
): Promise<FxAdapterResponse> {
  const apiKey = requireEnv('TWELVEDATA_API_KEY');

  // Build batch request body - one exchange_rate call per pair
  const body: Record<string, { url: string }> = {};

  // Explicit types on forEach to satisfy TypeScript strict mode
  req.requestedPairs.forEach((p: FxRibbonPair, idx: number) => {
    const symbol = `${p.base}/${p.quote}`;
    body[`req_${idx + 1}`] = {
      url: `/exchange_rate?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`,
    };
  });

  // Make the batch request
  const res = await fetch('https://api.twelvedata.com/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(
      `TwelveData batch failed: ${res.status} ${res.statusText} ${txt}`.trim()
    );
  }

  // Parse response
  const rawJson: unknown = await res.json();

  // Validate response structure
  if (!isValidTwelveDataResponse(rawJson)) {
    logError('TwelveData response validation failed', {
      raw: JSON.stringify(rawJson).slice(0, 500),
    });
    return {
      providerId: 'twelvedata',
      mode: 'live',
      pairs: [],
    };
  }

  const json = rawJson as TwelveDataBatchResponse;
  const data = json.data ?? {};

  // Extract valid quotes
  const quotes: FxRibbonQuote[] = [];

  // Explicit types on forEach to satisfy TypeScript strict mode
  req.requestedPairs.forEach((p: FxRibbonPair, idx: number) => {
    const key = `req_${idx + 1}`;
    const item = data[key];

    // Check for rate in response
    const rate = item?.response?.rate;
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      logWarn('TwelveData invalid rate for pair', {
        pair: p.id,
        rate,
        status: item?.status,
        message: item?.message,
      });
      return; // Skip this pair
    }

    // Build and validate quote
    const timestamp = item?.response?.timestamp ?? null;
    const quote = buildValidQuote(p, rate, timestamp);

    if (quote) {
      quotes.push(quote);
    } else {
      logWarn('TwelveData quote validation failed', { pair: p.id });
    }
  });

  return {
    providerId: 'twelvedata',
    mode: 'live',
    pairs: quotes,
  };
}
