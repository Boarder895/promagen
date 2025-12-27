// frontend/src/lib/fx/route.ts
//
// Server-only helpers for FX API routes.
//
// Pro posture (Vercel):
// - Treat /api/fx as spend-bearing: caching headers become a cost-control surface.
// - Keep /api/fx/trace hidden in Vercel production unless explicitly authorised.
// - Keep all headers ASCII (undici/WebIDL ByteString).
//
// Existing features preserved: Yes.

import 'server-only';

import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

import { env } from '@/lib/env';

function constantTimeEquals(a: string, b: string): boolean {
  const aa = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function getFxBuildId(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (typeof sha === 'string' && sha.trim().length > 0) return sha.slice(0, 12);

  const build =
    process.env.NEXT_PUBLIC_BUILD_ID ??
    process.env.BUILD_ID ??
    process.env.VERCEL_GIT_COMMIT_REF ??
    process.env.VERCEL_ENV;

  if (typeof build === 'string' && build.trim().length > 0) return build.trim();

  return 'local-dev';
}

export function getFxRequestId(req: NextRequest): string {
  const vercelId = req.headers.get('x-vercel-id');
  if (vercelId && vercelId.trim()) return vercelId.trim().slice(0, 96);

  const reqId = req.headers.get('x-request-id');
  if (reqId && reqId.trim()) return reqId.trim().slice(0, 96);

  return crypto.randomUUID();
}

export function buildFxCacheControl(ttlSeconds: number, hasError: boolean): string {
  const ttl = Number.isFinite(ttlSeconds) ? Math.max(0, Math.floor(ttlSeconds)) : 0;

  // CDN-honest caching:
  // - Browser: do not cache (max-age=0)
  // - Edge/CDN: cache for policy TTL
  // - If payload carries an error, cache briefly so we don't amplify failures.
  const sMaxAgeSeconds = hasError ? Math.min(60, ttl) : ttl;
  const staleWhileRevalidateSeconds = Math.min(120, ttl);

  return `public, max-age=0, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`;
}

export function allowFxTrace(req: NextRequest): boolean {
  // Only lock down in *Vercel production*. Preview deployments are for debugging.
  const vercelEnv = process.env.VERCEL_ENV ?? '';
  if (vercelEnv !== 'production') return true;

  const expected = env.cron.secret?.trim() ?? '';
  if (expected.length < 16) return false;

  const url = new URL(req.url);

  const providedFromHeaders =
    req.headers.get('x-promagen-cron') ??
    req.headers.get('x-cron-secret') ??
    req.headers.get('x-promagen-cron-secret') ??
    '';

  const providedFromQuery = url.searchParams.get('secret') ?? '';

  const auth = req.headers.get('authorization') ?? '';
  const providedFromBearer = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice('bearer '.length).trim()
    : '';

  const provided = (providedFromHeaders || providedFromBearer || providedFromQuery).trim();

  if (!provided) return false;

  return constantTimeEquals(provided, expected);
}
