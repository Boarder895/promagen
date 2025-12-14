// C:\Users\Proma\Projects\promagen\gateway\adapters\twelvedata.fx.ts

import type { FxAdapterRequest, FxAdapterResponse, FxRibbonPairQuote } from '../lib/types';

type TwelveDataBatchResponse = {
  code?: number;
  status?: string;
  data?: Record<
    string,
    {
      status?: string;
      response?: {
        rate?: number;
        symbol?: string;
        timestamp?: number;
      };
      message?: string;
    }
  >;
  message?: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (typeof v !== 'string' || v.trim().length === 0) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v.trim();
}

export default async function twelvedataFxAdapter(
  req: FxAdapterRequest,
): Promise<FxAdapterResponse> {
  const apiKey = requireEnv('TWELVEDATA_API_KEY');

  // Build one batch request containing one exchange_rate call per pair
  const body: Record<string, { url: string }> = {};
  req.requestedPairs.forEach((p, idx) => {
    const symbol = `${p.base}/${p.quote}`;
    body[`req_${idx + 1}`] = {
      url: `/exchange_rate?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(
        apiKey,
      )}`,
    };
  });

  const res = await fetch('https://api.twelvedata.com/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`TwelveData batch failed: ${res.status} ${res.statusText} ${txt}`.trim());
  }

  const json = (await res.json()) as TwelveDataBatchResponse;
  const data = json.data ?? {};

  const quotes: FxRibbonPairQuote[] = [];
  req.requestedPairs.forEach((p, idx) => {
    const key = `req_${idx + 1}`;
    const item = data[key];

    const rate = item?.response?.rate;
    if (typeof rate !== 'number' || !Number.isFinite(rate)) return;

    quotes.push({
      pair: p.id,
      base: p.base,
      quote: p.quote,
      label: p.label,
      price: rate,
      timestamp: typeof item?.response?.timestamp === 'number' ? item.response.timestamp : null,
      change: null,
      changePct: null,
    });
  });

  return {
    providerId: 'twelvedata',
    mode: 'live',
    pairs: quotes,
  };
}
