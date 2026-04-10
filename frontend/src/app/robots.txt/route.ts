// src/app/robots.txt/route.ts
// ============================================================================
// ROBOTS.TXT — AI CRAWLER WELCOME MAT (Route Handler)
// ============================================================================
// Converted from Next.js Metadata API (robots.ts) to a route handler so we
// control response headers directly. The Metadata API sets
// `cache-control: public, max-age=0, must-revalidate` which means zero CDN
// caching — every crawl request hits the serverless function. If the function
// cold-starts or Clerk middleware hiccups, crawlers get "robots.txt
// unreachable" and Google blocks the entire site.
//
// This route handler sets aggressive CDN caching with stale-while-revalidate
// so crawlers NEVER see a failure — Vercel's CDN serves the last good
// response even while revalidating in the background.
//
// Bot distinctions:
//   OAI-SearchBot  → ChatGPT search results (citations)
//   GPTBot         → OpenAI model training/grounding (independent)
//   ClaudeBot      → Anthropic Claude grounding
//   PerplexityBot  → Perplexity search indexing
//   Perplexity-User→ Perplexity user-triggered fetches
//   Google-Extended→ Gemini training + grounding (NOT AI Overviews)
//   Applebot-Extended → Apple Intelligence grounding
//
// Cache strategy:
//   max-age=3600        → browser re-checks hourly
//   s-maxage=86400      → CDN caches for 24 hours (aligned with ISR daily)
//   stale-while-revalidate=604800 → CDN serves stale up to 7 days while
//                                    revalidating in background. Crawlers
//                                    NEVER see a cold-start failure.
//
// Authority: promagen-ai-authority-pages-FINAL-v2.0.md §3.5
// ============================================================================

import { NextResponse } from 'next/server';

// ISR revalidation — Next.js regenerates this route every 24 hours.
export const revalidate = 86400;

// ── CDN cache headers applied to every response ─────────────────────────────
const CACHE_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  'X-Content-Type-Options': 'nosniff',
} as const;

// ── Disallowed paths (shared across all user-agent blocks) ──────────────────
const DISALLOW = ['/admin', '/api', '/dev', '/test', '/bridge'];

// ── Bot user agents to explicitly welcome ───────────────────────────────────
const AI_BOTS = [
  'OAI-SearchBot',
  'GPTBot',
  'ClaudeBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
];

function buildRobotsTxt(host: string): string {
  const disallowLines = DISALLOW.map((p) => `Disallow: ${p}`).join('\n');

  // Default rule for all crawlers
  const blocks = [`User-Agent: *\nAllow: /\n${disallowLines}`];

  // Explicit welcome for each AI bot (some AI systems only crawl if
  // explicitly allowed by a named User-Agent block)
  for (const bot of AI_BOTS) {
    blocks.push(`User-Agent: ${bot}\nAllow: /\n${disallowLines}`);
  }

  // Sitemap and Host directives
  blocks.push(`Host: ${host}`);
  blocks.push(`Sitemap: ${host}/sitemap.xml`);

  return blocks.join('\n\n') + '\n';
}

// ── Minimal fallback if env loading fails ───────────────────────────────────
// Google treats a robots.txt error (5xx) as "disallow all" for up to 30 days.
// Serving a minimal valid robots.txt is vastly better than a 500.
const FALLBACK_ROBOTS = `User-Agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: https://promagen.com/sitemap.xml\n`;

export async function GET() {
  try {
    const { env } = await import('@/lib/env');
    const host: string = env.siteUrl;

    return new NextResponse(buildRobotsTxt(host), { headers: CACHE_HEADERS });
  } catch {
    // If env fails (missing vars, parse error), serve the fallback.
    // A valid robots.txt with Allow: / is infinitely better than a 500
    // which Google treats as "block everything for 30 days".
    return new NextResponse(FALLBACK_ROBOTS, { headers: CACHE_HEADERS });
  }
}
