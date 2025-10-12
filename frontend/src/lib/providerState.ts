// src/lib/providerState.ts
import { PROVIDERS, providersWithApi } from "@/lib/providers";
import type { ProviderId } from "@/lib/providers";

export type Health = "ok" | "degraded" | "down";

export type ProviderState = Record<
  ProviderId,
  {
    health: Health;
    api: "official" | "manual";
  }
>;

/** Build the initial per-provider state from the canonical registry. */
export const initialProviderState = (): ProviderState => {
  const state = {} as ProviderState;

  // Whatever iterable comes back (ids or objects), normalize to ProviderId[]
  const upstream: Iterable<unknown> =
    (Symbol.iterator in Object(providersWithApi())
      ? (providersWithApi() as Iterable<unknown>)
      : []) as Iterable<unknown>;

  const apiIds: ProviderId[] = Array.from(upstream)
    .map((v) => {
      if (typeof v === "string") return v as ProviderId;
      if (v && typeof v === "object" && "id" in (v as Record<string, unknown>)) {
        const id = (v as { id?: unknown }).id;
        if (typeof id === "string") return id as ProviderId;
      }
      return null;
    })
    .filter((x): x is ProviderId => typeof x === "string" && x.length > 0);

  const apiSet = new Set<ProviderId>(apiIds);

  for (const p of PROVIDERS) {
    state[p.id] = {
      health: "ok",
      api: apiSet.has(p.id) ? "official" : "manual",
    };
  }

  return state;
};

/** Minimal refresh used by admin sync routes. */
export const refreshProviders = (): ProviderState => {
  return initialProviderState();
};
