// src/lib/crypto/route.ts
/**
 * Small helpers for /api/crypto routes.
 * Keep ASCII-only headers, provide request/build ids, and CDN-honest caching.
 */

import { randomUUID } from 'crypto';

export function getCryptoRequestId(): string {
  return randomUUID();
}

export function getCryptoBuildId(): string {
  // Keep stable-ish across a deployment; if Vercel provides an id, use it.
  return (
    process.env['VERCEL_GIT_COMMIT_SHA'] ??
    process.env['VERCEL_DEPLOYMENT_ID'] ??
    process.env['VERCEL_BUILD_ID'] ??
    'dev'
  );
}

/**
 * Cache policy for crypto ribbon.
 * Mirrors the “calm” posture (default 5 minutes, allow SWR).
 */
export function buildCryptoCacheControl(opts?: { sMaxAgeSeconds?: number }): string {
  const sMaxAge = Math.max(0, opts?.sMaxAgeSeconds ?? 300); // 5 min
  const swr = 86400; // 24h stale-while-revalidate
  return `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`;
}
