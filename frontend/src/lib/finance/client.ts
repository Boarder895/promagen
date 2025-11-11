// frontend/src/lib/finance/client.ts
// Tiny client helper to read demo or live based on flags.

import pairs from "@/data/fx/pairs.json";

export type FxRate = {
  id: string;
  base: string;
  quote: string;
  value: number;
  asOf: string;
  source: "live" | "demo" | "cache";
};

type Options = {
  preferLive?: boolean;   // UI feature flag (e.g., from settings)
  authed?: boolean;       // caller decides (e.g., user session present)
  timeoutMs?: number;     // default 800
};

const DEMO: Record<string, { value: number; asOf: string }> = Object.fromEntries(
  (pairs as any[]).map((p) => {
    const v = p?.demo?.value ?? p?.demo?.prevClose ?? 1;
    return [String(p.id).toUpperCase(), { value: Number(v), asOf: new Date().toISOString() }];
  }),
);

export async function getRate(
  base: string,
  quote: string,
  opts: Options = {},
): Promise<FxRate> {
  const id = `${base}${quote}`.toUpperCase();
  const preferLive =
    opts.preferLive ?? (process.env.NEXT_PUBLIC_FX_LIVE === "true");
  const authed = Boolean(opts.authed);
  const timeout = opts.timeoutMs ?? 800;

  // If not both live+authed -> demo locally
  if (!(preferLive && authed)) {
    const d = DEMO[id];
    return {
      id,
      base: base.toUpperCase(),
      quote: quote.toUpperCase(),
      value: d?.value ?? 1,
      asOf: d?.asOf ?? new Date().toISOString(),
      source: "demo",
    };
  }

  // Try API with hard timeout; on error, fall back to demo
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(
      `/api/fx?base=${encodeURIComponent(base)}&quote=${encodeURIComponent(
        quote,
      )}`,
      { signal: ctrl.signal, cache: "no-store" },
    );
    const json = (await res.json()) as FxRate;
    if (!res.ok || !isFinite(json.value)) {throw new Error("bad fx");}
    return json;
  } catch {
    const d = DEMO[id];
    return {
      id,
      base: base.toUpperCase(),
      quote: quote.toUpperCase(),
      value: d?.value ?? 1,
      asOf: d?.asOf ?? new Date().toISOString(),
      source: "demo",
    };
  } finally {
    clearTimeout(t);
  }
}
