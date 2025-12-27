// frontend/src/lib/fx/fetch.ts
// Client-side helper for fetching FX snapshots from Promagen's own API.
//
// Pro posture:
// - Treat /api/fx as spend-bearing: keep requests stable so CDN caching works.
// - This file must never talk directly to third-party FX providers or touch API keys.
// - "Refresh gate" lives server-side (Refresh Authority). Clients do not get a force-refresh switch.
//
// Server-side integration lives in:
//   - src/app/api/fx/route.ts (courier)
//   - src/lib/fx/providers.ts (Refresh Authority)
//
// The shape here is intentionally minimal: enough for the ribbon and tests.

export type FxSnapshot = {
  id: string; // pair id, e.g. "gbp-usd"
  value: number; // current mid value
  prevClose: number; // yesterday's close (client uses last-seen as a pragmatic fallback)
  asOf: string; // ISO-8601 timestamp
};

type FxRibbonApiQuote = {
  id: string;
  price: number | null;
};

type FxRibbonApiResponse = {
  meta?: {
    asOf?: string;
    mode?: string;
    budget?: { state?: string; emoji?: string };
    requestId?: string;
    safeMode?: boolean;
  };
  data?: FxRibbonApiQuote[];
  error?: unknown;
};

const lastSeenById = new Map<string, { value: number; asOf: string }>();

function normaliseId(id: string): string {
  return id
    .trim()
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function fetchJson(input: RequestInfo, init?: RequestInit): Promise<unknown> {
  const response = await fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`FX API responded with ${response.status}`);
  }

  return response.json() as Promise<unknown>;
}

function parseFxRibbonApiResponse(raw: unknown): FxRibbonApiResponse | null {
  if (!isRecord(raw)) return null;

  const meta = isRecord(raw.meta) ? (raw.meta as Record<string, unknown>) : undefined;
  const dataRaw = raw.data;

  const data: FxRibbonApiQuote[] | undefined = Array.isArray(dataRaw)
    ? dataRaw
        .filter((item) => isRecord(item))
        .map((item) => {
          const rec = item as Record<string, unknown>;
          const id = readString(rec.id) ?? '';
          const price = readNumber(rec.price);
          return { id, price };
        })
    : undefined;

  const asOf = meta ? readString(meta.asOf) : null;
  const mode = meta ? readString(meta.mode) : null;
  const requestId = meta ? readString(meta.requestId) : null;
  const safeMode = meta
    ? typeof meta.safeMode === 'boolean'
      ? meta.safeMode
      : undefined
    : undefined;

  const budget =
    meta && isRecord(meta.budget)
      ? {
          state: readString((meta.budget as Record<string, unknown>).state) ?? undefined,
          emoji: readString((meta.budget as Record<string, unknown>).emoji) ?? undefined,
        }
      : undefined;

  return {
    meta: {
      ...(asOf ? { asOf } : {}),
      ...(mode ? { mode } : {}),
      ...(budget ? { budget } : {}),
      ...(requestId ? { requestId } : {}),
      ...(typeof safeMode === 'boolean' ? { safeMode } : {}),
    },
    data,
    error: raw.error,
  };
}

/**
 * Fetches a set of FX snapshots for the given pair ids from the internal API.
 *
 * IMPORTANT:
 * - This function intentionally calls /api/fx without query parameters.
 *   Query parameters would fragment the CDN cache and weaken the cost-control story.
 */
export async function fetchFxSnapshot(ids: string[]): Promise<FxSnapshot[]> {
  if (ids.length === 0) {
    return [];
  }

  const normalised = ids.map(normaliseId).filter(Boolean);

  // Spend-bearing endpoint: keep the URL stable for CDN caching.
  const raw = await fetchJson('/api/fx', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const parsed = parseFxRibbonApiResponse(raw);
  if (!parsed || !Array.isArray(parsed.data)) {
    return [];
  }

  const asOf = parsed.meta?.asOf ?? new Date().toISOString();

  const quotesById = new Map<string, FxRibbonApiQuote>();
  for (const q of parsed.data) {
    if (!q || typeof q.id !== 'string') continue;
    quotesById.set(normaliseId(q.id), q);
  }

  const out: FxSnapshot[] = [];

  for (const id of normalised) {
    const q = quotesById.get(id);
    if (!q) continue;

    const value = typeof q.price === 'number' && Number.isFinite(q.price) ? q.price : null;
    if (value === null) continue;

    const prev = lastSeenById.get(id)?.value ?? value;

    out.push({
      id,
      value,
      prevClose: prev,
      asOf,
    });

    lastSeenById.set(id, { value, asOf });
  }

  return out;
}

/**
 * Simple stagger helper: split ids into batches and fetch them with delays.
 *
 * NOTE (Pro posture):
 * - /api/fx returns a ribbon snapshot for *all* configured pairs.
 * - Splitting into batches would just re-hit the same endpoint repeatedly.
 * - For backwards compatibility we keep the API surface, but we coalesce to a single call.
 */
export async function fetchStaggered(
  ids: string[],
  _batchMs: number = 5000,
  _batchSize: number = 2,
): Promise<FxSnapshot[]> {
  return fetchFxSnapshot(ids);
}
