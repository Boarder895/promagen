import data from "@/data/providers.json";

export type ProviderItem = {
  id: string; name: string; url: string; affiliateUrl: string | null; tagline: string | null;
};

export function getTop20Providers(): ProviderItem[] {
  return (data as any[]).slice(0, 20).map((p, i) => ({
    id: String(p.id ?? i),
    name: String(p.name ?? p.displayName ?? "Unknown"),
    url: String(p.url ?? p.website ?? "#"),
    affiliateUrl: p.affiliateUrl ?? null,
    tagline: p.tagline ?? null,
  }));
}


