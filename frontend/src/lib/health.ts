// FRONTEND • lib/health.ts
export type HealthStatus = "ok" | "degraded" | "down";
export interface HealthResponse {
  status: HealthStatus;
  message?: string;
  details?: Record<string, unknown>;
}

const BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.promagen.com";

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  try {
    const res = await fetch(`${BASE}/health`, { signal, cache: "no-store" });
    if (!res.ok) {
      return { status: "down", message: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as HealthResponse;
    if (!data?.status) return { status: "down", message: "Malformed health payload" };
    return data;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "down", message: msg };
  }
}


