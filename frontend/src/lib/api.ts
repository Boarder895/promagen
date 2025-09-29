// Shared API helpers for Promagen (server & client-safe)

export const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.promagen.com").replace(/\/+$/, "");

type FetchJSONOptions = RequestInit & { timeoutMs?: number };

export async function fetchJSON<T = unknown>(
  path: string,
  { timeoutMs = 12000, ...init }: FetchJSONOptions = {}
): Promise<T> {
  const url = `${API_BASE}/${path.replace(/^\/+/, "")}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { Accept: "application/json", ...(init.headers || {}) },
      signal: ctrl.signal,
    });

    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!res.ok) {
      const msg =
        typeof body === "object" && body && "message" in (body as any)
          ? (body as any).message
          : text || `HTTP ${res.status}`;
      throw new Error(`Request failed: ${res.status} ${res.statusText} — ${msg}`);
    }

    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export type MetaResponse = {
  schema: string;
  dbProvider: string;
  env?: string;
  node?: string;
  latestAudit?: string;
  generatedAt?: string;
  [k: string]: unknown;
};

export function getMeta() {
  return fetchJSON<MetaResponse>("api/v1/meta");
}
