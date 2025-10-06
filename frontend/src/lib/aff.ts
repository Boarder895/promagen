// src/lib/aff.ts
// Helper to add utm params to affiliate links without cloaking.

export function buildAffiliateUrl(base: string, utm?: Partial<Record<string,string>>): string {
  try {
    const u = new URL(base);
    if (utm) {
      Object.entries(utm).forEach(([k,v]) => {
        if (v) u.searchParams.set(`utm_${k}`, v);
      });
    }
    return u.toString();
  } catch {
    return base;
  }
}

