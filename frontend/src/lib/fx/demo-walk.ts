// frontend/src/lib/fx/demo-walk.ts
//
// Deterministic demo generator for FX snapshots.
//
// - Uses src/data/fx/pairs.json "demo" values as the baseline.
// - Applies a bounded random walk so values "breathe" without drifting.
// - Returns FxSnapshot objects, the same shape used by live-source.ts and
//   fetchFxSnapshot, so demo and live can be swapped freely.

import pairsJson from '@/data/fx/fx-pairs.json';
import type { FxSnapshot } from './fetch';
import { seededStep, type WalkParams } from './randomwalk';

type PairDemoConfig = {
  id: string;
  base: string;
  quote: string;
  demo?: {
    value: number;
    prevClose: number;
  };
};

const pairs = pairsJson as PairDemoConfig[];

const DEFAULT_WALK_PARAMS: WalkParams = {
  maxStepPct: 0.015,
  intervalMin: 15,
  intervalMax: 30,
};

/**
 * Look up the base demo values for a pair id from src/data/fx/pairs.json.
 * Falls back to 1 / 1 if no explicit demo values are present.
 */
function getDemoBaseValues(id: string): { value: number; prevClose: number } {
  const match = pairs.find((p) => p.id === id);

  if (match?.demo && Number.isFinite(match.demo.value) && Number.isFinite(match.demo.prevClose)) {
    return {
      value: match.demo.value,
      prevClose: match.demo.prevClose,
    };
  }

  return {
    value: 1,
    prevClose: 1,
  };
}

/**
 * Build a single deterministic demo snapshot for a given pair id.
 *
 * - Seeded by pair id + current day, so values are stable within a day.
 * - Bounded by WalkParams so the series never drifts far from the base demo value.
 */
export function buildDemoSnapshot(
  id: string,
  now: Date = new Date(),
  params: WalkParams = DEFAULT_WALK_PARAMS,
): FxSnapshot {
  const base = getDemoBaseValues(id);

  const seed = `${id}:${now.toISOString().slice(0, 10)}`;

  const value = seededStep(base.value, seed, {
    maxStepPct: params.maxStepPct,
  });

  return {
    id,
    value,
    prevClose: base.prevClose,
    asOf: now.toISOString(),
  };
}

/**
 * Convenience helper: build demo snapshots for a list of pair ids.
 * This is what you’d use when you want the row’s 5 free-tier pairs
 * to run entirely in demo mode.
 */
export function buildDemoSnapshots(
  ids: string[],
  now: Date = new Date(),
  params: WalkParams = DEFAULT_WALK_PARAMS,
): FxSnapshot[] {
  if (ids.length === 0) {
    return [];
  }

  return ids.map((id) => buildDemoSnapshot(id, now, params));
}
