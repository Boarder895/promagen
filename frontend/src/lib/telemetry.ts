/**
 * Local, privacy-friendly telemetry for Stage 2.
 * - Records prompt copies and designer/bridge opens with timestamps.
 * - Computes trending (Top 3 in last N minutes).
 * - Provides a capped "live score nudge" (±3) to overlay on base scores.
 *
 * Storage:
 *   localStorage['pmg.telemetry'] = {
 *     copies: { [providerId]: number[] /* timestamps (ms) *\/ },
 *     opens:  { [providerId]: number[] },
 *     bridges:{ [providerId]: number[] }
 *   }
 */

const KEY = 'pmg.telemetry';

type Buckets = 'copies' | 'opens' | 'bridges';

interface TelemetryStore {
  copies: Record<string, number[]>;
  opens: Record<string, number[]>;
  bridges: Record<string, number[]>;
}

function load(): TelemetryStore {
  if (typeof window === 'undefined') return { copies: {}, opens: {}, bridges: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { copies: {}, opens: {}, bridges: {} };
    const parsed = JSON.parse(raw) as TelemetryStore;
    return { copies: parsed.copies ?? {}, opens: parsed.opens ?? {}, bridges: parsed.bridges ?? {} };
  } catch {
    return { copies: {}, opens: {}, bridges: {} };
  }
}

function save(next: TelemetryStore) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(next));
}

function pruneOlderThan(arr: number[], cutoff: number): number[] {
  // Keep events newer than cutoff
  return arr.filter(ts => ts >= cutoff);
}

export function recordEvent(bucket: Buckets, providerId: string, ts = Date.now()) {
  if (typeof window === 'undefined') return;
  const store = load();
  const map = store[bucket];
  map[providerId] = map[providerId] ?? [];
  map[providerId].push(ts);
  save(store);
}

export function getWindowCounts(windowMinutes = 120) {
  const store = load();
  const cutoff = Date.now() - windowMinutes * 60_000;

  const counts: Record<string, number> = {};
  (['copies', 'opens', 'bridges'] as Buckets[]).forEach(bucket => {
    const map = store[bucket];
    for (const [pid, timestamps] of Object.entries(map)) {
      const pruned = pruneOlderThan(timestamps, cutoff);
      map[pid] = pruned; // in-place prune for future saves
      counts[pid] = (counts[pid] ?? 0) + pruned.length;
    }
  });

  // Persist pruned state
  save(store);
  return counts;
}

export function getTopN(n = 3, windowMinutes = 120): Array<{ providerId: string; count: number }> {
  const counts = getWindowCounts(windowMinutes);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([providerId, count]) => ({ providerId, count }));
}

/**
 * Calculates a small live score nudge based on activity share in the recent window.
 * - If a provider accounts for, say, 20% of total recent actions, map that to a nudge in [-3, +3].
 * - Centered, conservative. This is LOCAL ONLY (Stage 3: replace with server telemetry).
 */
export function liveNudges(windowMinutes = 120): Record<string, number> {
  const counts = getWindowCounts(windowMinutes);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return {};
  const nudges: Record<string, number> = {};
  for (const [pid, c] of Object.entries(counts)) {
    const share = c / total; // 0..1
    // Map share (0..1) to roughly [-1, +3] but compress middle; clamp to ±3
    const raw = Math.min(3, Math.max(-3, Math.round((share - 0.05) * 40) / 2)); // step 0.5
    nudges[pid] = raw;
  }
  return nudges;
}




