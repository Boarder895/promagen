// frontend/src/lib/rate-limit.ts
//
// Lightweight in-app rate limiting (defence in depth).
//
// Important reality check:
// - On Vercel serverless, this is *per runtime instance* (memory resets on cold start).
// - That’s fine: Pro WAF is your front line; this is your second line.
// - Keep limits generous and use it primarily to dampen bot storms and open-redirect probing.
//
// Existing features preserved: Yes.

import 'server-only';

import type { NextRequest } from 'next/server';

export type RateLimitDecision =
  | {
      allowed: true;
      limit: number;
      remaining: number;
      resetAt: string;
    }
  | {
      allowed: false;
      limit: number;
      remaining: 0;
      resetAt: string;
      retryAfterSeconds: number;
      reason: 'rate_limited';
    };

type Bucket = {
  windowStartMs: number;
  count: number;
  lastSeenMs: number;
};

const buckets = new Map<string, Bucket>();

// Keep memory bounded.
const MAX_KEYS = 5_000;

function nowMs(): number {
  return Date.now();
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  const direct =
    req.headers.get('x-real-ip') ??
    req.headers.get('x-vercel-forwarded-for') ??
    req.headers.get('x-client-ip');

  if (direct && direct.trim()) return direct.trim();

  return 'unknown';
}

function safeKey(input: string): string {
  // Keep it ASCII-ish and compact.
  return input.replace(/[^a-zA-Z0-9:_\-|.]/g, '').slice(0, 200) || 'key';
}

function pruneIfNeeded(_now: number): void {
  if (buckets.size <= MAX_KEYS) return;

  // Remove least-recently seen buckets.
  const entries = Array.from(buckets.entries());
  entries.sort((a, b) => a[1].lastSeenMs - b[1].lastSeenMs);

  const removeCount = Math.max(1, Math.floor(entries.length * 0.1));
  for (let i = 0; i < removeCount; i += 1) {
    const key = entries[i]?.[0];
    if (key) buckets.delete(key);
  }
}

export function rateLimit(
  req: NextRequest,
  opts: {
    keyPrefix: string;
    max: number;
    windowSeconds: number;
    keyParts?: string[];
  },
): RateLimitDecision {
  const now = nowMs();

  const ip = getClientIp(req);
  const parts = [opts.keyPrefix, ip, ...(opts.keyParts ?? [])].map(safeKey);
  const key = parts.join('|');

  pruneIfNeeded(now);

  const windowMs = Math.max(1_000, Math.floor(opts.windowSeconds * 1_000));
  const limit = Math.max(1, Math.floor(opts.max));

  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartMs >= windowMs) {
    const resetAtMs = now + windowMs;
    buckets.set(key, { windowStartMs: now, count: 1, lastSeenMs: now });
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt: new Date(resetAtMs).toISOString(),
    };
  }

  bucket.lastSeenMs = now;

  if (bucket.count >= limit) {
    const resetAtMs = bucket.windowStartMs + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: new Date(resetAtMs).toISOString(),
      retryAfterSeconds,
      reason: 'rate_limited',
    };
  }

  bucket.count += 1;

  const resetAtMs = bucket.windowStartMs + windowMs;

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: new Date(resetAtMs).toISOString(),
  };
}
