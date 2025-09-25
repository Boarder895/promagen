// BACKEND · EXPRESS
// File: C:\Users\Martin Yarnold\Projects\promagen\api\src\services\cache.ts

type CacheEntry<T> = { at: number; ttl: number; value: T };

export class SimpleCache {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const e = this.store.get(key);
    if (!e) return null;
    const now = Date.now();
    if (now - e.at > e.ttl) {
      this.store.delete(key);
      return null;
    }
    return e.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.store.set(key, { at: Date.now(), ttl: ttlMs, value });
  }

  clear(key?: string) {
    if (key) this.store.delete(key);
    else this.store.clear();
  }
}

export const cache = new SimpleCache();
