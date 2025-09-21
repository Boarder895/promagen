// src/lib/rateLimit.ts
import type { NextRequest } from 'next/server';

type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();

/**
 * Default export – simple in-memory rate limiter for admin endpoints.
 * NOTE: Good enough for single-process dev/prod on one machine.
 * For multi-instance deploys move this to Redis.
 *
 * @param req      NextRequest (used to key on IP)
 * @param name     string to namespace the bucket (e.g., 'admin:ping')
 * @param limit    max requests in window
 * @param windowMs window size in ms
 *
 * @returns { ok, retryAfterMs }
 */
export default function rateLimit(
  req: NextRequest,
  name: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterMs: number } {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    (req as any).ip ||
    '127.0.0.1';

  const key = `${name}:${ip}`;
  const now = Date.now();

  let b = memoryBuckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    memoryBuckets.set(key, b);
  }

  if (b.count >= limit) {
    return { ok: false, retryAfterMs: b.resetAt - now };
  }

  b.count += 1;
  return { ok: true, retryAfterMs: 0 };
}
