// ============================================================================
// ROBOTS.TXT — AI CRAWLER WELCOME MAT
// ============================================================================
// Explicitly welcomes major AI crawlers alongside standard search engines.
//
// Bot distinctions:
//   OAI-SearchBot  → ChatGPT search results (citations)
//   GPTBot         → OpenAI model training/grounding (independent)
//   ClaudeBot      → Anthropic Claude grounding
//   PerplexityBot  → Perplexity search indexing
//   Perplexity-User→ Perplexity user-triggered fetches
//   Google-Extended→ Gemini training + grounding (NOT AI Overviews)
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md §3.5
// ============================================================================

import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const host = env.siteUrl;
  const disallow = ['/admin', '/api', '/dev', '/test', '/bridge'];

  return {
    rules: [
      { userAgent: '*', allow: ['/'], disallow },
      { userAgent: 'OAI-SearchBot', allow: ['/'], disallow },
      { userAgent: 'GPTBot', allow: ['/'], disallow },
      { userAgent: 'ClaudeBot', allow: ['/'], disallow },
      { userAgent: 'PerplexityBot', allow: ['/'], disallow },
      { userAgent: 'Perplexity-User', allow: ['/'], disallow },
      { userAgent: 'Google-Extended', allow: ['/'], disallow },
    ],
    sitemap: `${host}/sitemap.xml`,
    host,
  };
}
