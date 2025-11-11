export type HealthStatus = 'ok' | 'degraded' | 'down' | 'up' | 'idle';

export type PingResult = {
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  error?: string;
  ok?: boolean; // many components check this
};

export async function pingHealth(timeoutMs: number = 3000): Promise<PingResult> {
  // Stub: pretend we're OK with a small latency.
  return { status: 'ok', latencyMs: Math.max(42, Math.min(timeoutMs, 250)), ok: true };
}

export async function fetchVersion(): Promise<{ version: string; commit?: string; buildTime?: string }> {
  return { version: '0.0.0-dev', commit: 'stub', buildTime: new Date().toISOString() };
}

// Some components import from '@/lib/health'
export type HealthResponse = PingResult;
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  void signal; // ignored in stub
  return pingHealth();
}







