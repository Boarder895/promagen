// Lightweight fetch helpers for the Promagen API (works on server & client)

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "https://api.promagen.com";

type FetchJSONOptions = RequestInit & { timeoutMs?: number };

export async function fetchJSON<T = unknown>(
  path: string,
  { timeoutMs = 12000, ...init }: FetchJSONOptions = {}
): Promise<T> {
  const url = `${API_BASE}/${path.replace(/^\/+/, "")}`;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      // Never cache admin/meta probes
      cache: "no-store",
      headers: {
        "Accept": "application/json",
        ...(init?.headers || {}),
      },
      signal: ctrl.signal,
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // Non-JSON fallback
      data = text;
    }

    if (!res.ok) {
      const msg = typeof data === "object" && data && "message" in (data as any)
        ? (data as any).message
        : text || `HTTP ${res.status}`;
      throw new Error(`Request failed: ${res.status} ${res.statusText} — ${msg}`);
    }

    return data as T;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

// Convenience wrappers
export type MetaResponse = {
  schema: string;
  dbProvider: string;
  node?: string;
  env?: string;
  latestAudit?: string;
  generatedAt?: string;
  [k: string]: unknown;
};

export const getMeta = () => fetchJSON<MetaResponse>("/api/v1/meta");
