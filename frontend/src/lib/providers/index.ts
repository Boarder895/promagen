import baseProvidersJson from "@/data/providers.json";
import capsJson from "@/data/providers.capabilities.json";
import type { z } from "zod";
import { providerSchema } from "./schema";

type Provider = z.infer<typeof providerSchema>;

/** Normalize raw JSON -> typed Provider list. */
const list: Provider[] = (baseProvidersJson as any[]).map((p: any) => {
  // Ensure required shape (schema will confirm)
  const normalized = {
    id: String(p.id),
    name: String(p.name),
    tagline: String(p.tagline ?? ""),
    website: String(p.website ?? p.url ?? ""),
    url: String(p.url ?? p.website ?? ""), // <- satisfy schema.url
    affiliateUrl: p.affiliateUrl ?? null,
    requiresDisclosure: Boolean(p.requiresDisclosure ?? false),
    score: Number(p.score ?? 0),
    trend: String(p.trend ?? ""),
    tip: String(p.tip ?? ""),
    supportsPrefill: Boolean(p.supportsPrefill ?? false)
  };

  const parsed = providerSchema.parse(normalized);
  return parsed;
});

/** Merge capability flags (optional per-provider overrides). */
const DEFAULTS = (capsJson as any)._defaults ?? {};
const CAP_OVERRIDES: Record<string, any> = Object.fromEntries(
  Object.entries(capsJson as Record<string, any>)
    .filter(([k]) => k !== "_defaults")
);

export function providers(): Provider[] {
  return list.map((p) => ({
    ...p,
    ...DEFAULTS,
    ...(CAP_OVERRIDES[p.id] ?? {})
  })) as Provider[];
}

export function getProvider(id: string): Provider | undefined {
  return providers().find((p) => p.id === id);
}



