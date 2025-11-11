import type { KvAdapter } from '@/lib/kv/adapter';

// In-memory dev KV (server runtime). Not persistent across cold starts — demo-only.
const memory = new Map<string, { v: string; exp?: number }>();

export default function localAdapter(): KvAdapter {
  return {
    async get<T>(key: string): Promise<T | null> {
      const rec = memory.get(key);
      if (!rec) return null;
      if (rec.exp && rec.exp < Date.now()) {
        memory.delete(key);
        return null;
      }
      try {
        return JSON.parse(rec.v) as T;
      } catch {
        return null;
      }
    },
    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
      memory.set(key, {
        v: JSON.stringify(value),
        exp: typeof ttlSeconds === 'number' ? Date.now() + ttlSeconds * 1000 : undefined,
      });
    },
    async del(key: string): Promise<void> {
      memory.delete(key);
    },
  };
}
