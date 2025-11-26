// frontend/src/lib/fx/live-source.ts
//
// Server-side only: talks to the real FX provider (FastForex) and returns
// normalised snapshots for a list of FX pairs.
//
// This module must never be imported from a client component.

import {
  mapFastForexToSnapshot,
  type FxPairMeta,
  type FastForexFetchOneResponse,
} from './map-api-to-quotes';
import type { FxSnapshot } from './fetch';

const FASTFOREX_BASE_URL = 'https://api.fastforex.io/fetch-one';
const FX_REQUEST_TIMEOUT_MS = 4_000;

/**
 * Basic timeout wrapper around fetch. Next.js provides the global fetch.
 */
async function fetchWithTimeout(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FX_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function getApiKey(): string {
  const apiKey = process.env.FASTFOREX_API_KEY;

  if (!apiKey) {
    throw new Error('FASTFOREX_API_KEY is not set; live FX provider cannot be used.');
  }

  return apiKey;
}

/**
 * Calls the FastForex /fetch-one endpoint for a single pair.
 */
async function fetchFastForexForPair(meta: FxPairMeta): Promise<FxSnapshot | null> {
  const apiKey = getApiKey();

  const url = new URL(FASTFOREX_BASE_URL);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('from', meta.base);
  url.searchParams.set('to', meta.quote);

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`FastForex responded with ${response.status} for pair ${meta.id}`);
  }

  const json = (await response.json()) as FastForexFetchOneResponse;

  const now = new Date();
  return mapFastForexToSnapshot(meta, json, now);
}

/**
 * Fetches live FX snapshots for the requested pairs from FastForex.
 *
 * Any hard failure (timeout, non-2xx, malformed body) will naturally
 * bubble up to the caller, which decides whether to fall back to demo.
 */
export async function fetchLiveFxSnapshots(pairs: FxPairMeta[]): Promise<FxSnapshot[]> {
  if (pairs.length === 0) {
    return [];
  }

  const snapshots: FxSnapshot[] = [];

  // Sequential on purpose; if we want to go parallel later we can add
  // smarter rate-limit handling.
  for (const meta of pairs) {
    const snapshot = await fetchFastForexForPair(meta);
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  return snapshots;
}
