// src/lib/runAcrossProviders.ts
// Named exports only (project rule).
import { PROVIDERS } from "@/lib/providers";

/**
 * Open the current prompt across all providers.
 * For now this opens a simple route per provider; you can swap in provider-specific URLs later.
 */
export function openAllProviders(promptText: string): void {
  if (typeof window === "undefined") return;

  const q = encodeURIComponent(promptText ?? "");
  for (const p of PROVIDERS) {
    const url = `/providers/${p.id}?q=${q}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
