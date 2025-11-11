// frontend/src/store/fx.ts
// Thin selector around getRate() so components have one import.

import { getRate, type FxRate } from "@/lib/finance/client";

let fxLive = false;
export function setFxLive(v: boolean) {
  fxLive = v;
}

// You decide how to detect auth in your app; pass it in from the caller.
export async function selectFxRate(
  base: string,
  quote: string,
  options?: { authed?: boolean; timeoutMs?: number },
): Promise<FxRate> {
  return getRate(base, quote, {
    preferLive: fxLive,
    authed: options?.authed ?? false,
    timeoutMs: options?.timeoutMs,
  });
}
