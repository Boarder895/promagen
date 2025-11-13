/**
 * Minimal Vercel KV adapter used by snapshot API.
 * The interface is intentionally tiny: get / set / del with a namespace + key.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [k: string]: Json }
  | Json[];

const BASE = process.env.VERCEL_KV_HTTP_BASE ?? "";
const TOKEN = process.env.VERCEL_KV_TOKEN;

function headers() {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

async function http<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`KV HTTP ${res.status}`);
   
  return (await res.json()) as T;
}

export async function get<T = unknown>(namespace: string, key: string): Promise<T | null> {
  if (!BASE) return null;
  const data = await http<{ value: T | null }>(`${BASE}/get/${namespace}:${key}`);
  return data.value ?? null;
}

export async function set(namespace: string, key: string, value: Json): Promise<void> {
  if (!BASE) return;
  await http(`${BASE}/set/${namespace}:${key}`, {
    method: "POST",
    body: JSON.stringify({ value }),
  });
}

export async function del(namespace: string, key: string): Promise<void> {
  if (!BASE) return;
  await http(`${BASE}/del/${namespace}:${key}`, { method: "POST" });
}
