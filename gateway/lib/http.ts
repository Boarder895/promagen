// gateway/lib/http.ts

import type { ProviderEndpointConfig } from './config.js';
import { logError, logInfo } from './logging.js';

export type FetchJsonOptions = {
  providerId: string;
  endpoint: ProviderEndpointConfig;
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

/**
 * Minimal JSON fetch helper with sane errors.
 * Node 18+ provides global fetch; we rely on @types/node for typing.
 */
export async function fetchJson<T>(opts: FetchJsonOptions): Promise<T> {
  const { providerId, url, timeoutMs = 10_000 } = opts;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logInfo('fetchJson request', { providerId, url });

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...(opts.headers ?? {}),
      },
      signal: controller.signal,
    });

    const text = await res.text();

    if (!res.ok) {
      const msg = `[${providerId}] HTTP ${res.status} ${res.statusText} for ${url}`;
      logError(msg, { body: text.slice(0, 300) });
      throw new Error(msg);
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      const msg = `[${providerId}] Invalid JSON for ${url}`;
      logError(msg, { body: text.slice(0, 300) });
      throw new Error(msg);
    }
  } finally {
    clearTimeout(t);
  }
}
