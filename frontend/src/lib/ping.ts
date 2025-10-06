// frontend/lib/ping.ts ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â COMPLETE
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export type HealthResult = {
  ok: boolean;
  status?: "ok" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
};

export async function pingHealth(timeoutMs = 3000): Promise<HealthResult> {
  if (!API_BASE) return { ok: false, error: "API base ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â not set" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE}/healthz/deep`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    const json = await res.json().catch(() => ({}));
    const latencyMs = Math.round(performance.now() - start);
    // Treat non-200 as down but still return latency/status if present
    const status = json?.status as "ok" | "degraded" | "down" | undefined;
    return {
      ok: res.ok || status === "ok" || status === "degraded",
      status,
      latencyMs,
      error: res.ok ? undefined : `http ${res.status}`,
    };
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




