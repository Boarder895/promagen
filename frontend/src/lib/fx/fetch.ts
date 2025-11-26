// frontend/src/lib/fx/fetch.ts
// Client-side helper for fetching FX snapshots from Promagen's own API.
//
// This file must never talk directly to third-party FX providers or touch
// API keys. The server-side integration lives in:
//
//   - src/app/api/ribbon/fx/route.ts
//   - src/lib/finance/fx-client.ts
//
// The shape here is intentionally minimal: enough for the ribbon and tests.

export type FxSnapshot = {
  id: string; // pair id, e.g. "gbp-usd"
  value: number; // current mid value
  prevClose: number; // yesterday's close
  asOf: string; // ISO-8601 timestamp
};

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

/**
 * Fetches a set of FX snapshots for the given pair ids from the internal API.
 */
export async function fetchFxSnapshot(ids: string[]): Promise<FxSnapshot[]> {
  if (ids.length === 0) {
    return [];
  }

  const searchParams = new URLSearchParams();
  searchParams.set('pairs', ids.join(','));

  const data = await fetchJson(`/api/ribbon/fx?${searchParams.toString()}`);

  if (!Array.isArray(data)) {
    throw new Error('Unexpected FX API payload: expected an array of snapshots');
  }

  return (data as FxSnapshot[]).map((item) => ({
    id: item.id,
    value: Number(item.value),
    prevClose: Number(item.prevClose),
    asOf: item.asOf,
  }));
}

/**
 * Simple stagger helper: split ids into batches and fetch them with delays.
 * Used for calming refresh schedules without hammering the API.
 */
export async function fetchStaggered(
  ids: string[],
  batchMs: number = 5000,
  batchSize: number = 2,
): Promise<FxSnapshot[]> {
  if (ids.length === 0) {
    return [];
  }

  const results: FxSnapshot[] = [];

  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize);

    const snapshot = await fetchFxSnapshot(batch);
    results.push(...snapshot);

    const hasMore = index + batchSize < ids.length;

    if (hasMore && batchMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, batchMs);
      });
    }
  }

  return results;
}
