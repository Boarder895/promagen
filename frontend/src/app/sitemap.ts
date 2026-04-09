import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { getAuthorityPlatformIds, getLastUpdated } from '@/lib/authority/platform-data';
import { getComparisonSlugs } from '@/lib/authority/comparison-pairs';
import { getUseCaseSlugs } from '@/lib/authority/use-case-recommendations';

/**
 * Sitemap — every public, user-facing route for search engines.
 *
 * RULE: Only list URLs that return 200. Do not list planned/unbuilt pages.
 * Listing 404s harms crawl budget and SEO trust signals.
 *
 * Live authority pages:
 *   - Priority 1: /platforms (hub) — LIVE
 *   - Priority 2: /platforms/[id] (40 profiles) — LIVE, dynamic from SSOT
 *   - Priority 3: /platforms/negative-prompts — LIVE
 *   - Priority 4: /platforms/compare/[slug] (8 pairs) — LIVE, from comparison-pairs.ts
 *   - Priority 5: /guides/prompt-formats — LIVE
 *   - Priority 6: /about/how-we-score — LIVE
 *   - Priority 7: /guides/best-generator-for/[use-case] (4 pages) — LIVE
 *
 * All 7 spec priorities are now live.
 *
 * Authority: promagen-ai-authority-pages-FINAL-v1.2.md §5.4
 */

const BASE = env.siteUrl;

interface SitemapEntry {
  path: string;
  priority: number;
  changeFrequency: 'daily' | 'weekly' | 'monthly';
}

export default function sitemap(): MetadataRoute.Sitemap {
  const platformIds = getAuthorityPlatformIds();
  const comparisonSlugs = getComparisonSlugs();
  const useCaseSlugs = getUseCaseSlugs();

  // Authority pages use SSOT date so the sitemap reflects when content
  // actually changed, not when it was generated. Product pages use now.
  const ssotDate = new Date(getLastUpdated());
  const now = new Date();

  const staticRoutes: SitemapEntry[] = [
    { path: '/', priority: 1.0, changeFrequency: 'daily' },
    { path: '/pro-promagen', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/platforms', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/platforms/negative-prompts', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/guides/prompt-formats', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/about/how-we-score', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/guides/best-generator-for', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/providers', priority: 0.8, changeFrequency: 'daily' },
    { path: '/leaderboard', priority: 0.8, changeFrequency: 'daily' },
    { path: '/providers/trends', priority: 0.8, changeFrequency: 'daily' },
    { path: '/providers/compare', priority: 0.8, changeFrequency: 'daily' },
    { path: '/inspire', priority: 0.7, changeFrequency: 'daily' },
    { path: '/studio/library', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/world-context', priority: 0.7, changeFrequency: 'daily' },
    { path: '/macro', priority: 0.6, changeFrequency: 'daily' },
    { path: '/status', priority: 0.6, changeFrequency: 'daily' },
    { path: '/providers/leaderboard', priority: 0.5, changeFrequency: 'daily' },
  ];

  const profileRoutes: SitemapEntry[] = platformIds.map((id) => ({
    path: `/platforms/${id}`,
    priority: 0.8,
    changeFrequency: 'monthly' as const,
  }));

  const comparisonRoutes: SitemapEntry[] = comparisonSlugs.map((slug) => ({
    path: `/platforms/compare/${slug}`,
    priority: 0.8,
    changeFrequency: 'monthly' as const,
  }));

  // Authority use-case recommendations (Priority 7 — LIVE, from use-case-recommendations.ts)
  const useCaseRoutes: SitemapEntry[] = useCaseSlugs.map((slug) => ({
    path: `/guides/best-generator-for/${slug}`,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
  }));

  const all = [...staticRoutes, ...profileRoutes, ...comparisonRoutes, ...useCaseRoutes];

  return all.map(({ path, priority, changeFrequency }) => {
    const isAuthority = path.startsWith('/platforms') || path.startsWith('/guides') || path.startsWith('/about');
    return {
      url: `${BASE}${path}`,
      lastModified: isAuthority ? ssotDate : now,
      changeFrequency,
      priority,
    };
  });
}
