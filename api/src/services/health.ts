// BACKEND · EXPRESS
// File: C:\Users\Martin Yarnold\Projects\promagen\api\src\services\health.ts

import { PROVIDERS, ProviderMeta } from "../providers/registry";
import { cache } from "./cache"; // requires src/services/cache.ts from earlier step

// ---------- Types ----------
export type Status = "ok" | "degraded" | "unavailable";

export interface CheckResult {
  id: ProviderMeta["id"];
  name: string;
  integration: ProviderMeta["integration"];
  affiliateEnabled: boolean;
  status: Status;
  latencyMs: number | null;
  checkedAt: string;
  note?: string;
}

// ---------- Helpers ----------
const bearer = (k?: string) => (k ? `Bearer ${k}` : "");

function mk(
  id: CheckResult["id"],
  name: string,
  status: Status,
  latencyMs: number | null,
  note?: string,
  affiliate = false
): CheckResult {
  return {
    id,
    name,
    integration: "api",
    affiliateEnabled: affiliate,
    status,
    latencyMs,
    checkedAt: new Date().toISOString(),
    note,
  };
}

// ---------- API Provider Checks ----------
export async function checkOpenAI(): Promise<CheckResult> {
  const start = Date.now();
  const key = process.env.OPENAI_API_KEY;
  if (!key) return mk("openai", "OpenAI (GPT-Image)", "unavailable", null, "No OPENAI_API_KEY");

  try {
    const r = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: bearer(key) },
      cache: "no-store",
    });
    const dt = Date.now() - start;
    if (r.status === 200) return mk("openai", "OpenAI (GPT-Image)", "ok", dt);
    if (r.status === 429) return mk("openai", "OpenAI (GPT-Image)", "degraded", dt, "Rate limited");
    return mk("openai", "OpenAI (GPT-Image)", "unavailable", dt, `HTTP ${r.status}`);
  } catch (e: any) {
    return mk("openai", "OpenAI (GPT-Image)", "unavailable", null, e?.message || "Network");
  }
}

export async function checkStability(): Promise<CheckResult> {
  const start = Date.now();
  const key = process.env.STABILITY_API_KEY;
  if (!key) return mk("stability", "Stability AI", "unavailable", null, "No STABILITY_API_KEY");

  try {
    const r = await fetch("https://api.stability.ai/v1/engines/list", {
      headers: { Authorization: bearer(key) },
      cache: "no-store",
    });
    const dt = Date.now() - start;
    if (r.status === 200) return mk("stability", "Stability AI", "ok", dt);
    if (r.status === 429) return mk("stability", "Stability AI", "degraded", dt, "Rate limited");
    return mk("stability", "Stability AI", "unavailable", dt, `HTTP ${r.status}`);
  } catch (e: any) {
    return mk("stability", "Stability AI", "unavailable", null, e?.message || "Network");
  }
}

export async function checkLeonardo(): Promise<CheckResult> {
  const start = Date.now();
  const key = process.env.LEONARDO_API_KEY;
  if (!key) return mk("leonardo", "Leonardo AI", "unavailable", null, "No LEONARDO_API_KEY", true);

  try {
    const r = await fetch("https://cloud.leonardo.ai/api/rest/v1/me", {
      headers: { Authorization: bearer(key) },
      cache: "no-store",
    });
    const dt = Date.now() - start;
    if (r.status === 200) return mk("leonardo", "Leonardo AI", "ok", dt, undefined, true);
    if (r.status === 429) return mk("leonardo", "Leonardo AI", "degraded", dt, "Rate limited", true);
    return mk("leonardo", "Leonardo AI", "unavailable", dt, `HTTP ${r.status}`, true);
  } catch (e: any) {
    return mk("leonardo", "Leonardo AI", "unavailable", null, e?.message || "Network", true);
  }
}

// ---------- UI-only Heuristic ----------
export async function checkUiOnly(p: ProviderMeta): Promise<CheckResult> {
  const t0 = Date.now();
  try {
    const r = await fetch(p.website, { method: "HEAD", cache: "no-store" });
    const dt = Date.now() - t0;
    if (r.ok) {
      const status: Status = dt < 800 ? "ok" : "degraded";
      return {
        id: p.id,
        name: p.name,
        integration: p.integration,
        affiliateEnabled: p.affiliateEnabled,
        status,
        latencyMs: dt,
        checkedAt: new Date().toISOString(),
      };
    }
    return {
      id: p.id,
      name: p.name,
      integration: p.integration,
      affiliateEnabled: p.affiliateEnabled,
      status: "degraded",
      latencyMs: dt,
      checkedAt: new Date().toISOString(),
      note: `HTTP ${r.status}`,
    };
  } catch (e: any) {
    return {
      id: p.id,
      name: p.name,
      integration: p.integration,
      affiliateEnabled: p.affiliateEnabled,
      status: "unavailable",
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      note: e?.message || "Network",
    };
  }
}

// ---------- Scoring ----------
export function scoreFromStatus(s: Status, latencyMs: number | null): number {
  const base = s === "ok" ? 90 : s === "degraded" ? 60 : 20;
  const penalty = latencyMs ? Math.min(30, Math.floor(latencyMs / 100)) : 10;
  return Math.max(0, Math.min(100, base - penalty));
}

// ---------- Runners ----------
export async function runAllChecks() {
  const api = [checkOpenAI(), checkStability(), checkLeonardo()];
  const ui = PROVIDERS.filter((p) => p.integration === "ui-only").map(checkUiOnly);
  return Promise.all([...api, ...ui]);
}

export async function runAllChecksCached() {
  const ttl = Number(process.env.CACHE_TTL_MS ?? 120_000); // default 120s
  const key = "providers:health";
  const cached = cache.get<Awaited<ReturnType<typeof runAllChecks>>>(key);
  if (cached) return cached;
  const fresh = await runAllChecks();
  cache.set(key, fresh, ttl);
  return fresh;
}
