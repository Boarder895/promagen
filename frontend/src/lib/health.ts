export type HealthStatus = "ok" | "degraded" | "down";
export interface HealthResponse {
  status: HealthStatus;
  message?: string;
  lastCheck?: number;
}

export async function fetchHealth(): Promise<HealthResponse> {
  // Stub: pretend we're fine.
  return { status: "ok", lastCheck: Date.now() };
}







