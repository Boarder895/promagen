// src/app/sitemap.xml/route.ts
// ============================================================================
// SITEMAP.XML — Search Engine Discovery (Route Handler)
// ============================================================================
// Converted from Next.js Metadata API (sitemap.ts) to a route handler so we
// control response headers directly. Same motivation as robots.txt — the
// Metadata API sets max-age=0 which means zero CDN caching.
//
// RULE: Only list URLs that return 200. Do not list planned/unbuilt pages.
// Listing 404s harms crawl budget and SEO trust signals.
//
// Live authority pages (all 7 spec priorities):
//   Priority 1: /platforms (hub)
//   Priority 2: /platforms/[id] (40 profiles, dynamic from SSOT)
//   Priority 3: /platforms/negative-prompts
//   Priority 4: /platforms/compare/[slug] (8 pairs, from comparison-pairs.ts)
//   Priority 5: /guides/prompt-formats
//   Priority 6: /about/how-we-score
//   Priority 7: /guides/best-generator-for/[use-case] (4 pages)
//
// Cache strategy:
//   max-age=3600        → browser re-checks hourly
//   s-maxage=86400      → CDN caches for 24 hours (aligned with ISR daily)
//   stale-while-revalidate=604800 → CDN serves stale up to 7 days while
//                                    revalidating in background
//
// Authority: promagen-ai-authority-pages-FINAL-v2.0.md §5.4
// ============================================================================

import { NextResponse } from 'next/server';

// ISR revalidation — Next.js regenerates this route every 24 hours.
export const revalidate = 86400;

// ── CDN cache headers ───────────────────────────────────────────────────────
const CACHE_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  'X-Content-Type-Options': 'nosniff',
} as const;

// ── Types ───────────────────────────────────────────────────────────────────
interface SitemapEntry {
  path: string;
  priority: number;
  changeFrequency: 'daily' | 'weekly' | 'monthly';
}

// ── XML helpers ─────────────────────────────────────────────────────────────
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toXmlEntry(
  base: string,
  path: string,
  lastmod: string,
  changefreq: string,
  priority: number,
): string {
  return [
    '<url>',
    `<loc>${escapeXml(base)}${escapeXml(path)}</loc>`,
    `<lastmod>${lastmod}</lastmod>`,
    `<changefreq>${changefreq}</changefreq>`,
    `<priority>${priority}</priority>`,
    '</url>',
  ].join('\n');
}

function buildSitemapXml(base: string, entries: Array<{ path: string; lastmod: string; changefreq: string; priority: number }>): string {
  const urlEntries = entries
    .map((e) => toXmlEntry(base, e.path, e.lastmod, e.changefreq, e.priority))
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
}

// ── Minimal fallback if SSOT loading fails ──────────────────────────────────
// An empty or missing sitemap just slows discovery — it doesn't block
// indexing. But a 500 wastes crawl budget. Serve at least the homepage.
function fallbackSitemap(): string {
  const now = new Date().toISOString();
  return buildSitemapXml('https://promagen.com', [
    { path: '/', lastmod: now, changefreq: 'daily', priority: 1.0 },
    { path: '/platforms', lastmod: now, changefreq: 'weekly', priority: 0.9 },
  ]);
}

export async function GET() {
  try {
    const { env } = await import('@/lib/env');
    const { getAuthorityPlatformIds, getLastUpdated } = await import('@/lib/authority/platform-data');
    const { getComparisonSlugs } = await import('@/lib/authority/comparison-pairs');
    const { getUseCaseSlugs } = await import('@/lib/authority/use-case-recommendations');

    const BASE: string = env.siteUrl;
    const platformIds: string[] = getAuthorityPlatformIds();
    const comparisonSlugs: string[] = getComparisonSlugs();
    const useCaseSlugs: string[] = getUseCaseSlugs();

    // Authority pages use SSOT date so the sitemap reflects when content
    // actually changed, not when it was generated. Product pages use now.
    const ssotDate = new Date(getLastUpdated()).toISOString();
    const now = new Date().toISOString();

    const staticRoutes: SitemapEntry[] = [
      { path: '/', priority: 1.0, changeFrequency: 'daily' },
      { path: '/sentinel', priority: 1.0, changeFrequency: 'weekly' },
      { path: '/inspire', priority: 0.9, changeFrequency: 'daily' },
      { path: '/platforms', priority: 0.9, changeFrequency: 'weekly' },
      { path: '/platforms/negative-prompts', priority: 0.7, changeFrequency: 'monthly' },
      { path: '/guides/prompt-formats', priority: 0.7, changeFrequency: 'monthly' },
      { path: '/about/how-we-score', priority: 0.5, changeFrequency: 'monthly' },
      { path: '/guides/best-generator-for', priority: 0.7, changeFrequency: 'monthly' },
      { path: '/providers', priority: 0.8, changeFrequency: 'daily' },
      { path: '/leaderboard', priority: 0.8, changeFrequency: 'daily' },
      { path: '/providers/trends', priority: 0.8, changeFrequency: 'daily' },
      { path: '/providers/compare', priority: 0.8, changeFrequency: 'daily' },
      { path: '/prompt-lab', priority: 0.9, changeFrequency: 'daily' },
      { path: '/studio/library', priority: 0.7, changeFrequency: 'weekly' },
      { path: '/macro', priority: 0.6, changeFrequency: 'daily' },
      { path: '/status', priority: 0.6, changeFrequency: 'daily' },
      { path: '/providers/leaderboard', priority: 0.5, changeFrequency: 'daily' },
    ];
    // Removed (v10.0.0): /world-context — page deleted; /pro-promagen — demoted from sitemap pending full removal.

    const profileRoutes: SitemapEntry[] = platformIds.map((id: string) => ({
      path: `/platforms/${id}`,
      priority: 0.8,
      changeFrequency: 'monthly' as const,
    }));

    const comparisonRoutes: SitemapEntry[] = comparisonSlugs.map((slug: string) => ({
      path: `/platforms/compare/${slug}`,
      priority: 0.8,
      changeFrequency: 'monthly' as const,
    }));

    const useCaseRoutes: SitemapEntry[] = useCaseSlugs.map((slug: string) => ({
      path: `/guides/best-generator-for/${slug}`,
      priority: 0.7,
      changeFrequency: 'monthly' as const,
    }));

    const all = [...staticRoutes, ...profileRoutes, ...comparisonRoutes, ...useCaseRoutes];

    const entries = all.map(({ path, priority, changeFrequency }) => {
      const isAuthority =
        path.startsWith('/platforms') ||
        path.startsWith('/guides') ||
        path.startsWith('/about');
      return {
        path,
        lastmod: isAuthority ? ssotDate : now,
        changefreq: changeFrequency,
        priority,
      };
    });

    const xml = buildSitemapXml(BASE, entries);
    return new NextResponse(xml, { headers: CACHE_HEADERS });
  } catch {
    // If SSOT or env fails, serve a minimal valid sitemap.
    // Better than a 500 that wastes crawl budget.
    return new NextResponse(fallbackSitemap(), { headers: CACHE_HEADERS });
  }
}
