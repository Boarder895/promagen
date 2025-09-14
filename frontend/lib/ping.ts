const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export type HealthResult = { ok: boolean; latencyMs?: number; error?: string };

export async function pingHealth(timeoutMs = 3000): Promise<HealthResult> {
  if (!API_BASE) return { ok: false, error: "API base — not set" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    return { ok: res.ok, latencyMs: Math.round(performance.now() - start) };
  } catch (e: any) {
    clearTimeout(timer);
    return { ok: false, error: e?.name === "AbortError" ? "timeout" : String(e) };
  }
}

export async function fetchVersion(): Promise<Record<string, any> | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/version`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
