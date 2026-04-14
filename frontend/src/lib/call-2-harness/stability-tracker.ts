// src/lib/call-2-harness/stability-tracker.ts
// ============================================================================
// Call 2 Quality Harness — Stability Band Tracker (Phase 2)
// ============================================================================
// GPT is stochastic. A rule at 4.8% one run and 3.8% the next hasn't
// changed — that's noise. This module tracks stability bands per rule
// across consecutive runs.
//
// Per §3.5:
//   ±2% across 3 consecutive runs = STABLE (do not investigate)
//   Movement outside the band     = REAL CHANGE (investigate)
//
// Authority: api-call-2-v2_1_0.md §3.5
// Existing features preserved: Yes (new file).
// ============================================================================

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StabilityBand {
  readonly rule_id: string;
  /** Stage D fail rates from the last N runs (most recent last) */
  readonly last_runs: readonly number[];
  /** Max minus min across the tracked runs */
  readonly band_width: number;
  /** True if band_width ≤ STABILITY_THRESHOLD */
  readonly stable: boolean;
  /** True if the most recent run moved outside the band of prior runs */
  readonly real_change: boolean;
  /** Direction of change if real_change is true */
  readonly direction: 'improving' | 'regressing' | 'none';
}

export interface StabilityReport {
  readonly bands: Readonly<Record<string, StabilityBand>>;
  readonly runs_analysed: number;
  readonly stable_count: number;
  readonly real_change_count: number;
  readonly insufficient_data_count: number;
}

interface PreviousRunSummary {
  readonly version: string;
  readonly run_timestamp: string;
  readonly by_rule: Record<string, { stage_d_fail_rate: number }>;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** ±2% band = 0.04 total width */
const STABILITY_THRESHOLD = 0.04;

/** How many prior runs to include in the stability band */
const RUNS_TO_TRACK = 3;

// ── Loader ─────────────────────────────────────────────────────────────────

/**
 * Load the N most recent run JSONs from the runs directory.
 * Sorted by run_timestamp descending (newest first).
 * Skips files that can't be parsed.
 */
async function loadRecentRuns(
  runsDir: string,
  maxRuns: number,
): Promise<PreviousRunSummary[]> {
  let files: string[];
  try {
    files = await readdir(runsDir);
  } catch {
    return []; // Directory doesn't exist yet — first run
  }

  const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();
  const runs: PreviousRunSummary[] = [];

  for (const file of jsonFiles.slice(0, maxRuns * 2)) {
    // Load more than needed in case some fail to parse
    if (runs.length >= maxRuns) break;
    try {
      const raw = await readFile(join(runsDir, file), 'utf8');
      const data = JSON.parse(raw) as Partial<PreviousRunSummary>;
      if (data.by_rule && data.run_timestamp) {
        runs.push({
          version: data.version ?? 'unknown',
          run_timestamp: data.run_timestamp,
          by_rule: data.by_rule as Record<string, { stage_d_fail_rate: number }>,
        });
      }
    } catch {
      // Skip unparseable files
    }
  }

  // Sort newest first
  runs.sort((a, b) => b.run_timestamp.localeCompare(a.run_timestamp));
  return runs.slice(0, maxRuns);
}

// ── Tracker ────────────────────────────────────────────────────────────────

/**
 * Compute stability bands for all rules by comparing the current run
 * against previous runs in the runs directory.
 *
 * @param currentByRule - The by_rule data from the current run
 * @param runsDir - Path to the directory containing previous run JSONs
 * @param maxPriorRuns - How many prior runs to load (default 3)
 */
export async function computeStabilityBands(
  currentByRule: Readonly<Record<string, { stage_d_fail_rate: number }>>,
  runsDir: string,
  maxPriorRuns: number = RUNS_TO_TRACK,
): Promise<StabilityReport> {
  const priorRuns = await loadRecentRuns(runsDir, maxPriorRuns);

  const bands: Record<string, StabilityBand> = {};
  let stableCount = 0;
  let realChangeCount = 0;
  let insufficientCount = 0;

  for (const ruleId of Object.keys(currentByRule)) {
    const currentRate = currentByRule[ruleId]?.stage_d_fail_rate ?? 0;

    // Collect this rule's fail rate from prior runs (oldest to newest)
    const priorRates: number[] = [];
    for (const run of [...priorRuns].reverse()) {
      const entry = run.by_rule[ruleId];
      if (entry !== undefined) {
        priorRates.push(entry.stage_d_fail_rate);
      }
    }

    // All rates including current (oldest to newest, current last)
    const allRates = [...priorRates, currentRate];

    if (allRates.length < 2) {
      // Not enough data for stability analysis
      bands[ruleId] = {
        rule_id: ruleId,
        last_runs: allRates,
        band_width: 0,
        stable: true, // Assume stable with insufficient data
        real_change: false,
        direction: 'none',
      };
      insufficientCount += 1;
      continue;
    }

    const min = Math.min(...allRates);
    const max = Math.max(...allRates);
    const bandWidth = max - min;
    const stable = bandWidth <= STABILITY_THRESHOLD;

    // Check if the current run moved outside the prior band
    let realChange = false;
    let direction: 'improving' | 'regressing' | 'none' = 'none';

    if (priorRates.length >= 2) {
      const priorMin = Math.min(...priorRates);
      const priorMax = Math.max(...priorRates);
      const priorBand = priorMax - priorMin;
      const margin = Math.max(priorBand, STABILITY_THRESHOLD);

      if (currentRate > priorMax + margin / 2) {
        realChange = true;
        direction = 'regressing';
      } else if (currentRate < priorMin - margin / 2) {
        realChange = true;
        direction = 'improving';
      }
    }

    bands[ruleId] = {
      rule_id: ruleId,
      last_runs: allRates,
      band_width: bandWidth,
      stable,
      real_change: realChange,
      direction,
    };

    if (realChange) {
      realChangeCount += 1;
    } else if (stable) {
      stableCount += 1;
    }
  }

  return {
    bands: Object.freeze(bands),
    runs_analysed: priorRuns.length + 1,
    stable_count: stableCount,
    real_change_count: realChangeCount,
    insufficient_data_count: insufficientCount,
  };
}
