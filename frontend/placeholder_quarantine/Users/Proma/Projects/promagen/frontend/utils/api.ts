// FRONTEND • utils/api.ts
// Minimal wrapper: timeout, JSON typing, optional X-Request-ID passthrough.

export class ApiError extends Error {
  status: number;
  body: unknown;
  requestId?: string;
  constructor(status: number, body: unknown, requestId?: string) {
    super(typeof (body as any)?.error === 'string' ? (body as any).error : `API ${status}`);
    this.status = status;
    this.body = body;
    this.requestId = requestId;
  }
}

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: HeadersInit;
  body?: any;
  timeoutMs?: number; // default 10s
  requestId?: string; // if provided, forwarded as X-Request-ID
  cache?: RequestCache; // e.g. "no-store"
  next?: NextFetchRequestConfig; // for Next.js caching hints
};

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export async function apiFetch<T = any>(path: string, opts: ApiOptions = {}) {
  const { method = 'GET', headers, body, timeoutMs = 10_000, requestId, cache, next } = opts;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(requestId ? { 'X-Request-ID': requestId } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: controller.signal,
    cache,
    next,
  }).finally(() => clearTimeout(t));

  const resReqId = res.headers.get('x-request-id') ?? requestId;
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new ApiError(res.status, data, resReqId || undefined);
  }

  return {
    data: data as T,
    status: res.status,
    headers: res.headers,
    requestId: resReqId || undefined,
  };
}
