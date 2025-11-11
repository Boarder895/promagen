/**
 * Tiny client helper to fetch providers with a timeout and runtime validation.
 */

import { Routes } from "@/lib/routes";

export type Provider = {
  id: string;
  name: string;
  url?: string;
  score?: number;
  trend?: "up" | "down" | "flat";
};

export type ProvidersApiResponse = {
  ok: boolean;
  count: number;
  providers: Provider[];
  ts: string;
  buildId?: string;
  mode?: "live" | "demo";
};

function isProvider(x: unknown): x is Provider {
  const a = x as any;
  return !!a && typeof a.id === "string" && typeof a.name === "string";
}

function isResponse(x: unknown): x is ProvidersApiResponse {
  const a = x as any;
  return (
    !!a &&
    typeof a.ok === "boolean" &&
    Array.isArray(a.providers) &&
    (a.providers.length === 0 || isProvider(a.providers[0])) &&
    typeof a.ts === "string"
  );
}

export async function getProviders(timeoutMs = 10_000): Promise<ProvidersApiResponse> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(Routes.api.providers, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as unknown;
    if (!isResponse(json)) throw new Error("Invalid providers payload");
    return json;
  } finally {
    clearTimeout(t);
  }
}
