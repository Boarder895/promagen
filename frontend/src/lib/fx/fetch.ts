// Post-login API fetch stub + scheduler.
// Replace `fetchFxSnapshot` with your real endpoint when available.

export type FxSnapshot = {
  id: string;          // pair id e.g., "gbp-usd"
  value: number;       // current value
  prevClose: number;   // yesterday close
  asOf: string;        // ISO timestamp
};

export async function fetchFxSnapshot(ids: string[]): Promise<FxSnapshot[]> {
  // TODO: call your API; for now return demo values.
  const now = new Date().toISOString();
  return ids.map((id) => ({
    id,
    value: 1.23,
    prevClose: 1.22,
    asOf: now,
  }));
}

// Simple stagger helper: split ids into N buckets and call with delays
export async function fetchStaggered(ids: string[], batchMs = 5000, batchSize = 2) {
  const out: FxSnapshot[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const slice = ids.slice(i, i + batchSize);
    // eslint-disable-next-line no-await-in-loop
    const snap = await fetchFxSnapshot(slice);
    out.push(...snap);
    if (i + batchSize < ids.length) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(r => setTimeout(r, batchMs));
    }
  }
  return out;
}
