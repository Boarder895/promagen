/**
 * KV façade. Swappable adapter; keep the rest of the app adapter-agnostic.
 */
import * as vercel from "@/lib/kv/adapters/vercel";
import type { Json } from "@/lib/kv/adapters/vercel";

export interface Kv {
  get<T = unknown>(namespace: string, key: string): Promise<T | null>;
  set(namespace: string, key: string, value: Json): Promise<void>;
  del(namespace: string, key: string): Promise<void>;
}

const kv: Kv = {
  get: (ns, key) => vercel.get(ns, key),
  set: (ns, key, v: Json) => vercel.set(ns, key, v),
  del: (ns, key) => vercel.del(ns, key),
};

export default kv;
export type { Json };
