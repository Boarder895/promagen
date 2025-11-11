// Shared API response shapes

export type ApiOk<T> = {
  ok: true;
  data: T;
  // Optional server hint for client polling/backoff
  nextUpdateAt?: string; // ISO timestamp
};

export type ApiErr = {
  ok: false;
  error: string;
  status?: number;
};

export type ApiResp<T> = ApiOk<T> | ApiErr;

export type FxQuote = {
  id: string;        // e.g. "EURUSD"
  label: string;     // e.g. "EUR / USD"
  value: number;     // latest price (demo or live)
  prevClose: number; // reference value
  precision?: number;
  asOf: string;      // ISO timestamp
};

export type FxQuotesPayload = {
  quotes: FxQuote[];
};

export type ProviderSummary = {
  id: string;
  name: string;
  score?: number;            // 0–100
  trend?: 'up' | 'down' | 'flat';
  tags?: string[];
  url?: string;
};

export type ProvidersPayload = {
  items: ProviderSummary[];
};

export type ExchangeSummary = {
  id: string;
  exchange: string;
  city: string;
  iso2: string;
  tz: string;
};

export type ExchangesPayload = {
  items: ExchangeSummary[];
};
