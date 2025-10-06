'use client';

/**
 * API-first data gateway (frontend seam).
 * - Reads NEXT_PUBLIC_API_BASE_URL (default http://localhost:3001).
 * - Exposes named functions that components consume.
 * - If the API call fails, returns a safe empty structure to keep UI stable.
 * - No default exports (project rule).
 */

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:3001';

type AnyJson = any;

/** tiny fetch helper with timeout + JSON parse */
async function getJSON<T = AnyJson>(path: string, timeoutMs = 8000): Promise<T> {
  const url = `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { 'content-type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(to);
  }
}

/** Providers â€” scores */
export type ProviderScore = {
  id: string;           // canonical provider id (e.g., "openai")
  total?: number;       // 0â€“100
  delta?: number;       // +/- points since last snapshot
  trend?: 'hot' | 'warm' | 'cool';
  // any extra fields are tolerated
  [k: string]: unknown;
};

/**
 * getProvidersScores
 * Expected API: GET /api/v1/providers/scores -> ProviderScore[]
 * Returns [] on failure (UI will show skeletons / empty state gracefully).
 */
export async function getProvidersScores(): Promise<ProviderScore[]> {
  try {
    const data = await getJSON<ProviderScore[]>('/api/v1/providers/scores');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Exchanges â€” status */
export type ExchangeStatus = {
  id: string;                 // canonical exchange id (e.g., "lse", "nyse")
  isOpen?: boolean;
  nextFlipTs?: number;        // unix ms when open/close flips
  localTs?: number;           // local unix ms at exchange
  holiday?: boolean;
  // any extra fields are tolerated
  [k: string]: unknown;
};

/**
 * getExchangesStatus
 * Expected API: GET /api/v1/exchanges/status -> ExchangeStatus[]
 * Returns [] on failure.
 */
export async function getExchangesStatus(): Promise<ExchangeStatus[]> {
  try {
    const data = await getJSON<ExchangeStatus[]>('/api/v1/exchanges/status');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}


