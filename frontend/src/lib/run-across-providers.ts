// Utility: run an async function across all providers and collect results.

import { providers, type Provider } from "@/lib/providers";

export type Runner<T> = (p: Provider) => Promise<T>;

export async function runAcrossProviders<T>(
  fn: Runner<T>
): Promise<Array<{ id: string; ok: boolean; value?: T; error?: unknown }>> {
  const out: Array<{ id: string; ok: boolean; value?: T; error?: unknown }> = [];
  for (const p of providers) {
    try {
      const value = await fn(p);
      out.push({ id: p.id, ok: true, value });
    } catch (err) {
      out.push({ id: p.id, ok: false, error: err });
    }
  }
  return out;
}










