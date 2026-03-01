// src/lib/admin/scoring-profiles.ts
// ============================================================================
// CONFIGURATION PROFILES — Types, Diff Engine & Validation
// ============================================================================
//
// Supports named snapshots of the entire scoring configuration.
// Profiles are stored in the learned_weights table with key prefix
// "scoring-profile:" so they coexist with live scoring data.
//
// Features:
//   - Save named snapshots (all tier weights + metadata)
//   - Visual diff between any two profiles
//   - Activate a profile → writes to live scoring-weights
//   - Rollback to any previous snapshot
//
// Pure computation — no I/O, no database access.
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new file).
// ============================================================================

// ============================================================================
// CONSTANTS
// ============================================================================

/** Key prefix for profiles in learned_weights table */
export const PROFILE_KEY_PREFIX = 'scoring-profile:';

/** Key for the profile index (list of all saved profiles) */
export const PROFILE_INDEX_KEY = 'scoring-profiles-index';

/** Maximum profiles allowed (prevent unbounded storage) */
export const MAX_PROFILES = 50;

/** Maximum profile name length */
export const MAX_NAME_LENGTH = 60;

// ============================================================================
// TYPES
// ============================================================================

/** A saved scoring configuration profile */
export interface ScoringProfile {
  /** Unique ID (nanoid-style, 12 chars) */
  id: string;

  /** Human-readable name (e.g. "Conservative v2", "Pre-launch safe") */
  name: string;

  /** Optional description */
  description: string;

  /** Who created it (Clerk userId) */
  createdBy: string;

  /** ISO timestamp */
  createdAt: string;

  /** Whether this is the currently active profile */
  isActive: boolean;

  /** The full scoring weights snapshot */
  weights: ProfileWeights;
}

/** Weights snapshot within a profile */
export interface ProfileWeights {
  /** Per-tier weight profiles (keys: "1", "2", "3", "4") */
  tiers: Record<string, Record<string, number>>;

  /** Global fallback weights */
  global: Record<string, number>;

  /** Total events at time of snapshot */
  eventCount: number;
}

/** Index of all saved profiles (stored as a single learned_weights row) */
export interface ProfileIndex {
  /** All profile metadata (without full weights — those are in separate rows) */
  profiles: ProfileIndexEntry[];

  /** ID of the currently active profile (or null if using live cron weights) */
  activeProfileId: string | null;

  /** Last modified timestamp */
  updatedAt: string;
}

/** Lightweight entry in the profile index */
export interface ProfileIndexEntry {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

// ============================================================================
// DIFF ENGINE
// ============================================================================

/** A single weight change between two profiles */
export interface WeightDiffEntry {
  /** Factor name */
  factor: string;

  /** Tier key (e.g. "1", "2", "global") */
  tier: string;

  /** Tier label for display */
  tierLabel: string;

  /** Weight in profile A */
  weightA: number;

  /** Weight in profile B */
  weightB: number;

  /** Absolute change */
  delta: number;

  /** Percentage change */
  deltaPercent: number;

  /** Direction */
  direction: 'up' | 'down' | 'unchanged';
}

/** Complete diff result */
export interface ProfileDiff {
  /** Total number of weight cells compared */
  totalCells: number;

  /** Number of changed cells */
  changedCells: number;

  /** Number of unchanged cells */
  unchangedCells: number;

  /** Individual changes, sorted by |delta| descending */
  changes: WeightDiffEntry[];

  /** Summary: total absolute weight shift */
  totalShift: number;
}

/** Tier labels for display */
const TIER_LABELS: Record<string, string> = {
  '1': 'Tier 1 (CLIP)',
  '2': 'Tier 2 (MJ)',
  '3': 'Tier 3 (NL)',
  '4': 'Tier 4 (Plain)',
  global: 'Global',
};

/**
 * Compute a detailed diff between two weight configurations.
 * Shows every factor/tier cell that changed, sorted by magnitude.
 */
export function computeProfileDiff(
  profileA: ProfileWeights,
  profileB: ProfileWeights,
): ProfileDiff {
  const changes: WeightDiffEntry[] = [];
  let unchangedCells = 0;

  // Collect all tier keys
  const allTierKeys = new Set<string>([
    ...Object.keys(profileA.tiers),
    ...Object.keys(profileB.tiers),
    'global',
  ]);

  for (const tierKey of allTierKeys) {
    const weightsA = tierKey === 'global' ? profileA.global : (profileA.tiers[tierKey] ?? {});
    const weightsB = tierKey === 'global' ? profileB.global : (profileB.tiers[tierKey] ?? {});
    const tierLabel = TIER_LABELS[tierKey] ?? `Tier ${tierKey}`;

    // All factors across both sides
    const allFactors = new Set([...Object.keys(weightsA), ...Object.keys(weightsB)]);

    for (const factor of allFactors) {
      const wA = weightsA[factor] ?? 0;
      const wB = weightsB[factor] ?? 0;
      const delta = wB - wA;

      if (Math.abs(delta) < 0.0001) {
        unchangedCells++;
        continue;
      }

      const deltaPercent = wA > 0 ? (delta / wA) * 100 : wB > 0 ? Infinity : 0;

      changes.push({
        factor,
        tier: tierKey,
        tierLabel,
        weightA: wA,
        weightB: wB,
        delta,
        deltaPercent,
        direction: delta > 0 ? 'up' : 'down',
      });
    }
  }

  // Sort by absolute delta descending
  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const totalShift = changes.reduce((sum, c) => sum + Math.abs(c.delta), 0);

  return {
    totalCells: changes.length + unchangedCells,
    changedCells: changes.length,
    unchangedCells,
    changes,
    totalShift,
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/** Validate a profile name */
export function validateProfileName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Profile name cannot be empty';
  if (trimmed.length > MAX_NAME_LENGTH) return `Name must be ${MAX_NAME_LENGTH} characters or fewer`;
  if (!/^[a-zA-Z0-9\s\-_.]+$/.test(trimmed)) return 'Name can only contain letters, numbers, spaces, hyphens, dots, underscores';
  return null; // Valid
}

/** Validate weight value */
export function validateWeight(value: number): string | null {
  if (!isFinite(value)) return 'Weight must be a finite number';
  if (value < 0) return 'Weight cannot be negative';
  if (value > 1) return 'Weight cannot exceed 1.0';
  return null; // Valid
}

/**
 * Normalise a set of weights so they sum to 1.0.
 * If all zero, returns uniform distribution.
 */
export function normaliseWeights(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights);
  if (entries.length === 0) return {};

  const sum = entries.reduce((s, [, v]) => s + v, 0);

  if (sum === 0) {
    // All zero → uniform
    const uniform = 1 / entries.length;
    return Object.fromEntries(entries.map(([k]) => [k, uniform]));
  }

  return Object.fromEntries(entries.map(([k, v]) => [k, v / sum]));
}

/**
 * Generate a simple 12-char ID for profiles.
 * Uses timestamp + random to avoid collisions without nanoid dependency.
 */
export function generateProfileId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${ts}${rand}`.slice(0, 12);
}

/**
 * Extract ProfileWeights from a ScoringWeights object (the live format).
 */
export function extractProfileWeights(scoringWeights: {
  tiers: Record<string, { weights: Record<string, number>; eventCount?: number }>;
  global: { weights: Record<string, number>; eventCount?: number };
  eventCount?: number;
}): ProfileWeights {
  const tiers: Record<string, Record<string, number>> = {};

  for (const [tierKey, tierData] of Object.entries(scoringWeights.tiers)) {
    tiers[tierKey] = { ...(tierData.weights ?? {}) };
  }

  return {
    tiers,
    global: { ...(scoringWeights.global?.weights ?? {}) },
    eventCount: scoringWeights.eventCount ?? 0,
  };
}
