// frontend/src/data/providers.ts
// Make sure tsconfig.json has: "resolveJsonModule": true and "esModuleInterop": true

import providersJson from "./providers.json";
import type { Provider } from "@/types/providers";

/**
 * Single source of truth: providers.json
 * Coerce the loaded JSON into Provider[] for the app. We intentionally avoid
 * over-strict inference here so dev can evolve the JSON without wrestling TS.
 */
export const PROVIDERS: Provider[] = (providersJson as unknown) as Provider[];

/**
 * Derived map: providerId -> styleLabel (if present in JSON).
 * Components can either read provider.styleLabel directly or use this map.
 */
export const PROVIDER_STYLE_LABEL: Record<string, string> = Object.fromEntries(
  PROVIDERS
    .filter((p) => typeof (p as any).styleLabel === "string" && (p as any).styleLabel!.length > 0)
    .map((p) => [p.id, (p as any).styleLabel as string])
);

/** Convenience type for IDs, if you need it elsewhere. */
export type ProviderId = Provider["id"];


