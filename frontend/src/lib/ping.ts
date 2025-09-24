export type PingHealth =
  | { ok: true; status: "ok" | "degraded"; latencyMs: number }
  | { ok: false; status: "down"; latencyMs: number; error?: string };

export async function pingHealth(timeoutMs = 3000): Promise<PingHealth> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch("/api/health", { signal: controller.signal, headers: { accept: "application/json" } });
    const latency = Math.max(0, Math.round(performance.now() - t0));
    clearTimeout(to);
    if (!res.ok) return { ok: false, status: "down", latencyMs: latency, error: String(res.status) };
    const json = (await res.json().catch(() => ({}))) as any;
    const status = json?.status === "degraded" ? "degraded" : "ok";
    return { ok: true, status, latencyMs: latency };
  } catch (err: any) {
    clearTimeout(to);
    const latency = Math.max(0, Math.round(performance.now() - t0));
    return { ok: false, status: "down", latencyMs: latency, error: err?.message ?? "network" };
  }
}
