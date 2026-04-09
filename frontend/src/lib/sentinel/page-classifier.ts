/**
 * Sentinel Page Classifier
 *
 * Maps a URL path to one of the 8 page classes defined in sentinel.md §3.3.
 * Different page classes have different regression thresholds.
 *
 * Classification rules (evaluated in order — first match wins):
 *   /                           → homepage
 *   /platforms                  → hub
 *   /platforms/negative-prompts → guide
 *   /platforms/compare/*        → comparison
 *   /platforms/[id]             → profile
 *   /guides/best-generator-for/*→ use_case
 *   /guides/*                   → guide
 *   /about/*                    → methodology
 *   everything else             → product
 *
 * Authority: sentinel.md v1.2.0 §3.3
 * Existing features preserved: Yes
 */

import type { PageClass } from '@/types/sentinel';

/**
 * Classify a URL path (or full URL) into a Sentinel page class.
 *
 * Accepts either a path ("/platforms/midjourney") or a full URL
 * ("https://promagen.com/platforms/midjourney"). Full URLs are
 * stripped to path before classification.
 */
export function classifyPage(urlOrPath: string): PageClass {
  // Normalise: strip origin if present, remove trailing slash, lowercase
  let path: string;
  try {
    const parsed = new URL(urlOrPath, 'https://promagen.com');
    path = parsed.pathname;
  } catch {
    path = urlOrPath;
  }

  // Remove trailing slash (but keep root "/" intact)
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  path = path.toLowerCase();

  // ── ORDER MATTERS — most specific patterns first ──

  // Homepage
  if (path === '/' || path === '') {
    return 'homepage';
  }

  // Hub (exactly /platforms, not /platforms/something)
  if (path === '/platforms') {
    return 'hub';
  }

  // Guide — negative prompts lives under /platforms but is a guide
  if (path === '/platforms/negative-prompts') {
    return 'guide';
  }

  // Comparison — /platforms/compare/*
  if (path.startsWith('/platforms/compare/')) {
    return 'comparison';
  }
  if (path === '/platforms/compare') {
    return 'comparison';
  }

  // Profile — /platforms/[id] (anything else under /platforms/)
  if (path.startsWith('/platforms/')) {
    return 'profile';
  }

  // Use case — /guides/best-generator-for/*
  if (path.startsWith('/guides/best-generator-for/')) {
    return 'use_case';
  }
  if (path === '/guides/best-generator-for') {
    return 'use_case';
  }

  // Guide — /guides/*
  if (path.startsWith('/guides/') || path === '/guides') {
    return 'guide';
  }

  // Methodology — /about/*
  if (path.startsWith('/about/') || path === '/about') {
    return 'methodology';
  }

  // Everything else is a product page
  return 'product';
}

/**
 * Authority page classes — these get strict regression thresholds
 * and are included in tripwire daily checks.
 */
export const AUTHORITY_PAGE_CLASSES: ReadonlySet<PageClass> = new Set([
  'hub',
  'profile',
  'guide',
  'comparison',
  'use_case',
  'methodology',
]);

/**
 * Check if a page class is an authority page.
 * Used by tripwire to filter which pages to check.
 */
export function isAuthorityPage(pageClass: PageClass): boolean {
  return AUTHORITY_PAGE_CLASSES.has(pageClass);
}
