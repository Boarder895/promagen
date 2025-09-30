// src/lib/providerState.ts
import { PROVIDERS, type ProviderId, type ProviderInfo } from "./providers";

export type Health = "ok" | "degraded" | "down";

export interface ProviderMeta extends ProviderInfo {
  health: Health;
  lastLatencyMs: number | null;
  lastCheckedAt: string | null;
}

// Module-level singleton state (persists for the server process)
const state: Record<ProviderId, ProviderMeta> = Object.fromEntries(
  PROVIDERS.map(p => [p.id, { ...p, health: "degraded", lastLatencyMs: null, lastCheckedAt: null }])
) as Record<ProviderId, ProviderMeta>;

export function getProviderState(): ProviderMeta[] {
  // Return in the same order as PROVIDERS
  return PROVIDERS.map(p => state[p.id]);
}

/**
 * Simulated refresh â€” replace later with real calls per provider.
 * For now: mark "official" API providers as ok (lower latency),
 * UI-only as ok/degraded mix (slightly higher latency).
 */
export async function refreshProviders(): Promise<{ updated: number; at: string }> {
  const now = new Date().toISOString();
  let updated = 0;

  for (const p of PROVIDERS) {
    // fake latency band
    const base = p.hasApi === "official" ? 120 : 220;
    const jitter = Math.floor(Math.random() * 80); // 0â€“79
    const latency = base + jitter;

    // simple health heuristic
    const health: Health =
      latency < 180 ? "ok" : latency < 260 ? "degraded" : "down";

    state[p.id].health = health;
    state[p.id].lastLatencyMs = latency;
    state[p.id].lastCheckedAt = now;
    updated++;
  }

  return { updated, at: now };
}
