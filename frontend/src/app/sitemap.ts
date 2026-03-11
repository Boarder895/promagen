import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

/**
 * Sitemap — lists every public, user-facing route for search engines.
 *
 * Routes excluded (and why):
 * - /admin/*          — internal only, behind auth
 * - /api/*            — JSON endpoints, not pages
 * - /dev/*            — developer tooling
 * - /test/*           — QA harnesses
 * - /health-check     — ops endpoint
 * - /bridge/*         — internal fallback
 * - /icons            — asset route
 * - /widget/*         — embedded widgets
 * - /sign-in, /sign-up — Clerk auth pages (Google shouldn't index these)
 * - /settings/*       — behind auth
 * - /saved            — behind auth
 * - /run-across-*     — internal tooling
 * - /providers/[id]   — dynamic, would need generateStaticParams for full coverage
 * - /providers/[id]/prompt-builder — dynamic, same reason
 * - /providers/leaderboard/bulk — internal admin
 *
 * Priority tiers:
 * 1.0  — homepage (money page)
 * 0.9  — pro (conversion page)
 * 0.8  — providers + leaderboard (high-value discovery)
 * 0.7  — Prompt Lab + My Prompts (engagement)
 * 0.6  — secondary public pages
 */

const BASE = env.siteUrl;

interface SitemapEntry {
  path: string;
  priority: number;
  changeFrequency: 'daily' | 'weekly' | 'monthly';
}

const routes: SitemapEntry[] = [
  // --- Tier 1: Money pages ---
  { path: '/', priority: 1.0, changeFrequency: 'daily' },

  // --- Tier 2: Conversion pages ---
  { path: '/pro-promagen', priority: 0.9, changeFrequency: 'weekly' },

  // --- Tier 3: High-value discovery ---
  { path: '/providers', priority: 0.8, changeFrequency: 'daily' },
  { path: '/leaderboard', priority: 0.8, changeFrequency: 'daily' },
  { path: '/providers/trends', priority: 0.8, changeFrequency: 'daily' },
  { path: '/providers/compare', priority: 0.8, changeFrequency: 'daily' },

  // --- Tier 4: Studio sub-pages ---
  { path: '/studio/playground', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/studio/library', priority: 0.7, changeFrequency: 'weekly' },

  // --- Tier 5: Secondary public pages ---
  { path: '/macro', priority: 0.6, changeFrequency: 'daily' },
  { path: '/status', priority: 0.6, changeFrequency: 'daily' },

  // Legacy aliases
  { path: '/providers/leaderboard', priority: 0.5, changeFrequency: 'daily' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
