// Simple in-memory cache for small objects/arrays. CJS-safe (no import.meta/require shims).
type Entry<T> = { value: T; expiresAt: number };
const store = new Map<string, Entry<unknown>>();

export function setCache<T>(key: string, value: T, ttlMs: number): void {
  const expiresAt = Date.now() + Math.max(0, ttlMs | 0);
  store.set(key, { value, expiresAt });
}

export function getCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function delCache(key: string): void {
  store.delete(key);
}

export function resetCache(): void {
  store.clear();
}

