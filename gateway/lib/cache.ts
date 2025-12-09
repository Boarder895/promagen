// C:\Users\Proma\Projects\promagen\gateway\lib\cache.ts

/**
 * Minimal TTL cache for gateway responses.
 *
 * Cache is intentionally in-memory only:
 * - Safe for local development
 * - Stateless for Vercel / serverless (cache will be cold per invocation)
 */

interface CacheItem<T> {
  expiresAt: number;
  value: T;
}

const CACHE = new Map<string, CacheItem<unknown>>();

export function saveToCache<T>(key: string, value: T, ttlSeconds: number): void {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  CACHE.set(key, { expiresAt, value });
}

export function getFromCache<T>(key: string): T | null {
  const entry = CACHE.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }

  return entry.value as T;
}
