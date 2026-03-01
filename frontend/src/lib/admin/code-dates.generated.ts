// src/lib/admin/code-dates.generated.ts
// ============================================================================
// AUTO-GENERATED — Do not edit manually.
// Run: npx ts-node scripts/generate-code-dates.ts
// Generated: 2026-03-01T00:00:00.000Z (default — run script to update from git)
// ============================================================================
//
// Provides git-derived last-modified dates for the Code Evolution Radar's
// Confidence Thermometer.  When the generate script runs, it reads `git log`
// for each monitored file and overwrites this module with real dates.
//
// Until then, these sensible defaults prevent build failures.
//
// Version: 1.0.0 — Phase 7.11j Git-Aware Confidence
// ============================================================================

export interface CodeDateEntry {
  /** YYYY-MM-DD date when this file was last modified in git */
  lastModified: string;
  /** Last commit message touching this file */
  commitMessage: string;
  /** Total number of commits to this file */
  commits: number;
}

/**
 * Git-derived last-modified dates for monitored pipeline files.
 * Used by the Code Evolution Radar to compute Confidence Thermometer decay.
 *
 * These are DEFAULTS — run `npx ts-node scripts/generate-code-dates.ts`
 * to auto-populate from your actual git history.
 */
export const CODE_DATES: Record<string, CodeDateEntry> = {
  'weight-recalibration.ts': {
    lastModified: '2026-02-25',
    commitMessage: 'Phase 6: weight recalibration engine',
    commits: 12,
  },
  'outcome-score.ts': {
    lastModified: '2026-02-25',
    commitMessage: 'Phase 7.10e: feedback signals in outcome score',
    commits: 8,
  },
  'anti-pattern-detection.ts': {
    lastModified: '2026-02-20',
    commitMessage: 'Phase 7.1: anti-pattern collision detection',
    commits: 6,
  },
  'vocabulary system': {
    lastModified: '2026-02-15',
    commitMessage: 'Phase 0: vocabulary merge + 11 categories',
    commits: 15,
  },
  'temporal-intelligence.ts': {
    lastModified: '2026-02-28',
    commitMessage: 'Phase 7.4: seasonal pattern intelligence',
    commits: 4,
  },
};

/**
 * Estimated data volume at time each file was last modified.
 * Updated manually or via build-time DB query.
 * Falls back to reasonable defaults.
 */
export const DATA_VOLUME_AT_WRITE: Record<string, number> = {
  'weight-recalibration.ts': 5000,
  'outcome-score.ts': 5000,
  'anti-pattern-detection.ts': 3000,
  'vocabulary system': 8000,
  'temporal-intelligence.ts': 10000,
};
