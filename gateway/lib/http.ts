// C:\Users\Proma\Projects\promagen\gateway\lib\http.ts

import { logError, logInfo } from './logging';

// ----------------------------------------------
// Types
// ----------------------------------------------

export interface ProviderConfig {
  id: string;
  base_url: string;
  api_key_env: string | null;
  headers?: Record<string, string>;
  adapters: {
    fx_quotes: string;
  };
}

// ----------------------------------------------
// Generic GET JSON helper
// ----------------------------------------------

export async function httpGetJson(url: string, config: ProviderConfig): Promise<unknown> {
  const apiKey = config.api_key_env ? process.env[config.api_key_env] : undefined;

  const finalUrl =
    apiKey && url.includes('?')
      ? `${url}&apikey=${apiKey}`
      : apiKey
      ? `${url}?apikey=${apiKey}`
      : url;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(config.headers ?? {}),
  };

  logInfo(`HTTP GET → ${finalUrl}`);

  const res = await fetch(finalUrl, { method: 'GET', headers });

  if (!res.ok) {
    const msg = `HTTP GET failed for provider '${config.id}' with status ${res.status}`;
    logError(msg);
    throw new Error(msg);
  }

  return res.json();
}

// ----------------------------------------------
// FMP: fetch array of FX pairs
// base_url example: https://financialmodelingprep.com/api/v3/fx
// ----------------------------------------------

export async function fetchFmpForex(baseUrl: string, config: ProviderConfig): Promise<unknown> {
  return httpGetJson(baseUrl, config);
}

// ----------------------------------------------
// TwelveData: fetch multiple pairs (sequence of calls)
// base_url example: https://api.twelvedata.com/forex_pair?symbol=GBP/USD
// ----------------------------------------------

export async function fetchTwelveDataForex(
  baseUrl: string,
  config: ProviderConfig,
): Promise<unknown> {
  // We expect the adapter to know the pairs it needs.
  // This is a single-call design, so we just call the base URL.
  return httpGetJson(baseUrl, config);
}
