// gateway/lib/cache.ts
// Simple in-memory cache for the gateway (per process).

export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export function getFromCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry.value as T;
}

export function saveToCache<T>(key: string, value: T, ttlMs: number): void {
  const expiresAt = Date.now() + Math.max(0, ttlMs);
  store.set(key, { value, expiresAt });
}

export function clearCache(): void {
  store.clear();
}
