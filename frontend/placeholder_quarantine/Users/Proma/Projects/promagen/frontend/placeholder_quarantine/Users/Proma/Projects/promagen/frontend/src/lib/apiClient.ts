// Unified JSON client. Works whether `@/lib/api` exports a base URL string
// or an object like { baseUrl } — keeps callers happy while the API layer
// settles.

import API_DEFAULT from '@/lib/api';

// Allow both shapes without typing drama.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_ANY = API_DEFAULT as any;
const API_BASE: string =
  typeof API_ANY === 'string'
    ? API_ANY
    : API_ANY?.baseUrl ?? '';

function join(base: string, path: string) {
  if (!base) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = join(API_BASE, path);
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...(init?.headers as Record<string, string> | undefined) },
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export type VersionInfo = { version?: string; commit?: string; buildTime?: string };

export async function fetchVersion(): Promise<VersionInfo> {
  try {
    return await getJSON<VersionInfo>('/version');
  } catch {
    return {};
  }
}

export type HealthResponse = { status: 'ok' | 'degraded' | 'down'; message?: string };

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  try {
    return await getJSON<HealthResponse>('/health', { signal, cache: 'no-store' });
  } catch {
    return { status: 'down', message: 'unreachable' };
  }
}
