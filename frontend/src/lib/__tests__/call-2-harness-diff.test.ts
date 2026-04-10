// src/lib/__tests__/call-2-harness-diff.test.ts
// ============================================================================
// Tests for the Call 2 Quality Harness Version Diff Module (Phase E)
// ============================================================================
// Covers:
//   - classifySignificance: all four DecisionClass buckets, both signs
//   - pairedRuleAnalysis: clean, improvement, regression, the hero case,
//     the cleanup-introducing-failure case, missing-rule edge cases
//   - diffInventories: paired analysis, sorting, cluster rollup, all five
//     warning types, same-version comparison
//   - attachDiff: non-mutating attachment, round-trip via write/loadInventory
//
// Authority: call-2-harness-build-plan-v1.md §9
// Architecture references:
//   - §11.3 (three patterns to watch for)
//   - §14 (failure-mode inventory schema with diff_vs_previous example)
//   - §16.1 (run class operational thresholds)
//   - §16.3 (paired analysis as preferred mode)
// Jest project: util (testMatch: src/lib/__tests__/**/*.test.ts)
// ============================================================================

import { describe, it, expect, afterAll } from '@jest/globals';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  diffInventories,
  pairedRuleAnalysis,
  classifySignificance,
  MECHANICAL_DECISION_THRESHOLDS,
  type DiffReport,
  type PairedDelta,
} from '@/lib/call-2-harness/diff';

import {
  attachDiff,
  writeInventoryToDisk,
  loadInventory,
  inventoryFilename,
  type FailureModeInventory,
  type RuleInventoryEntry,
  type ClusterInventoryEntry,
} from '@/lib/call-2-harness/inventory-writer';

import { ALL_CLUSTERS, type Cluster } from '@/lib/call-2-harness/mechanical-scorer';
import type { RunClass } from '@/lib/call-2-harness/run-classes';

// ============================================================================
// SYNTHETIC INVENTORY HELPERS
// ============================================================================
//
// Phase E tests build synthetic FailureModeInventory objects directly rather
// than going through buildInventory(). This keeps the diff tests focused on
// diff math and decoupled from the mechanical scorer's behaviour. If the
// mechanical scorer's rule set or shape changes, these tests don't break.

function makeRuleEntry(
  overrides: Partial<RuleInventoryEntry> = {},
): RuleInventoryEntry {
  return {
    stage_a_fail_rate: 0,
    stage_b_fail_rate: 0,
    stage_c_fail_rate: 0,
    stage_d_fail_rate: 0,
    rescue_dependency: 0,
    health: 'HEALTHY',
    interpretation: 'Model produces this rule correctly on its own.',
    evaluation_count: 100,
    ...overrides,
  };
}

function makeEmptyClusterMap(): Record<Cluster, ClusterInventoryEntry> {
  const map = {} as Record<Cluster, ClusterInventoryEntry>;
  for (const c of ALL_CLUSTERS) {
    map[c] = {
      fail_rate: 0,
      contributing_rules: [],
      stage_d_fail_count: 0,
      rule_count: 0,
    };
  }
  return map;
}

interface InventoryOverrides {
  version?: string;
  run_class?: RunClass;
  scene_count?: number;
  samples_per_scene?: number;
  cluster_schema_version?: string;
  by_rule?: Record<string, RuleInventoryEntry>;
  by_cluster?: Partial<Record<Cluster, ClusterInventoryEntry>>;
}

function makeInventory(overrides: InventoryOverrides = {}): FailureModeInventory {
  const byCluster = makeEmptyClusterMap();
  if (overrides.by_cluster) {
    for (const [k, v] of Object.entries(overrides.by_cluster)) {
      if (v) byCluster[k as Cluster] = v;
    }
  }
  return {
    version: overrides.version ?? 'v4.5',
    harness_version: '0.3.1',
    cluster_schema_version: overrides.cluster_schema_version ?? 'v1',
    model_version: 'gpt-5.4-mini-2026-02-15',
    run_timestamp: '2026-04-10T14:32:11.000Z',
    scene_count: overrides.scene_count ?? 60,
    samples_per_scene: overrides.samples_per_scene ?? 5,
    wall_clock_seconds: 167,
    run_class: overrides.run_class ?? 'smoke_alarm',
    by_rule: overrides.by_rule ?? {},
    by_cluster: byCluster,
    by_judge: null,
    metamorphic_stability: null,
    spot_audit: null,
    coverage_gaps: [],
    diff_vs_previous: null,
    holdout_run: null,
  };
}

// ============================================================================

describe('classifySignificance — operational decision thresholds', () => {
  it('exports the mechanical threshold table from architecture §16.1', () => {
    expect(MECHANICAL_DECISION_THRESHOLDS.smoke_alarm).toBeGreaterThan(
      MECHANICAL_DECISION_THRESHOLDS.decision_support,
    );
    expect(MECHANICAL_DECISION_THRESHOLDS.decision_support).toBeGreaterThan(
      MECHANICAL_DECISION_THRESHOLDS.dispute_resolution,
    );
  });

  it('|delta| ≥ 0.30 → smoke_alarm', () => {
    expect(classifySignificance(0.35, 'smoke_alarm')).toBe('smoke_alarm');
    expect(classifySignificance(0.50, 'smoke_alarm')).toBe('smoke_alarm');
    expect(classifySignificance(0.30, 'smoke_alarm')).toBe('smoke_alarm');
  });

  it('|delta| in [0.10, 0.30) → decision_support', () => {
    expect(classifySignificance(0.10, 'decision_support')).toBe('decision_support');
    expect(classifySignificance(0.15, 'decision_support')).toBe('decision_support');
    expect(classifySignificance(0.29, 'decision_support')).toBe('decision_support');
  });

  it('|delta| in [0.05, 0.10) → dispute_resolution', () => {
    expect(classifySignificance(0.05, 'dispute_resolution')).toBe('dispute_resolution');
    expect(classifySignificance(0.07, 'dispute_resolution')).toBe('dispute_resolution');
    expect(classifySignificance(0.099, 'dispute_resolution')).toBe('dispute_resolution');
  });

  it('|delta| < 0.05 → below_noise', () => {
    expect(classifySignificance(0.04, 'smoke_alarm')).toBe('below_noise');
    expect(classifySignificance(0.01, 'smoke_alarm')).toBe('below_noise');
    expect(classifySignificance(0, 'smoke_alarm')).toBe('below_noise');
  });

  it('uses absolute value — negative and positive deltas of same magnitude classify the same', () => {
    // Symmetry probe: a smoke_alarm-magnitude delta on a smoke_alarm run still
    // returns smoke_alarm regardless of sign.
    expect(classifySignificance(-0.35, 'smoke_alarm')).toBe('smoke_alarm');
    expect(classifySignificance(0.35, 'smoke_alarm')).toBe('smoke_alarm');
    // Below the smoke_alarm threshold, a smoke_alarm run cannot credibly
    // resolve the delta — it collapses to below_noise (run-class cap).
    // The previous version of this test expected decision_support /
    // dispute_resolution here; that was the bug ChatGPT flagged in Phase E.
    expect(classifySignificance(-0.02, 'smoke_alarm')).toBe('below_noise');
    expect(classifySignificance(0.02, 'smoke_alarm')).toBe('below_noise');
  });

  // ── Run-class cap (Phase E follow-up fix) ─────────────────────────────────
  // The fix in this drop: classifySignificance now USES its runClass argument
  // instead of ignoring it. The cap means a run class can never return a tier
  // finer than its sample size supports. Architecture §16.6 — "prevent you
  // from acting on smoke-alarm runs as if they were decision-support runs".

  it('cap: decision_support-magnitude delta on smoke_alarm run → below_noise', () => {
    // 0.15 magnitude clears the decision_support threshold (0.10) but a
    // 5-sample smoke_alarm run cannot credibly resolve it.
    expect(classifySignificance(0.15, 'smoke_alarm')).toBe('below_noise');
    expect(classifySignificance(-0.15, 'smoke_alarm')).toBe('below_noise');
  });

  it('cap: dispute_resolution-magnitude delta on smoke_alarm run → below_noise', () => {
    // 0.07 magnitude clears the dispute_resolution threshold (0.05) but
    // smoke_alarm cannot resolve a 7pp delta either.
    expect(classifySignificance(0.07, 'smoke_alarm')).toBe('below_noise');
    expect(classifySignificance(-0.07, 'smoke_alarm')).toBe('below_noise');
  });

  it('cap: dispute_resolution-magnitude delta on decision_support run → below_noise', () => {
    // 0.07 magnitude clears the dispute_resolution threshold but a 30-sample
    // decision_support run can only credibly resolve down to 10pp.
    expect(classifySignificance(0.07, 'decision_support')).toBe('below_noise');
  });

  it('cap: smoke_alarm-magnitude delta on smoke_alarm run survives the cap', () => {
    // The cap should only collapse claims FINER than the run class supports.
    // A delta at the run class's own tier passes through unchanged.
    expect(classifySignificance(0.35, 'smoke_alarm')).toBe('smoke_alarm');
    expect(classifySignificance(0.10, 'decision_support')).toBe('decision_support');
    expect(classifySignificance(0.05, 'dispute_resolution')).toBe('dispute_resolution');
  });

  it('cap: mutation run uses the same floor as smoke_alarm', () => {
    // mutation is a 5-sample run too — it gets the smoke_alarm floor.
    expect(classifySignificance(0.15, 'mutation')).toBe('below_noise');
    expect(classifySignificance(0.35, 'mutation')).toBe('smoke_alarm');
  });

  it('cap: milestone run uses the same floor as decision_support', () => {
    // milestone is 30 samples + holdout + spot audit — same callable floor
    // as decision_support for the mechanical-delta classification.
    expect(classifySignificance(0.07, 'milestone')).toBe('below_noise');
    expect(classifySignificance(0.15, 'milestone')).toBe('decision_support');
    expect(classifySignificance(0.35, 'milestone')).toBe('smoke_alarm');
  });
});

// ============================================================================

describe('pairedRuleAnalysis', () => {
  it('clean v4.5 vs clean v4.6 → all-zero delta, below_noise', () => {
    const prev = makeInventory({
      version: 'v4.5',
      by_rule: { 'T1.subject_highest_weight': makeRuleEntry() },
    });
    const curr = makeInventory({
      version: 'v4.6',
      by_rule: { 'T1.subject_highest_weight': makeRuleEntry() },
    });
    const delta = pairedRuleAnalysis(prev, curr, 'T1.subject_highest_weight');
    expect(delta).not.toBeNull();
    expect(delta!.stage_d_delta).toBe(0);
    expect(delta!.rescue_dependency_delta).toBe(0);
    expect(delta!.decision_class).toBe('below_noise');
    expect(delta!.note).toBeUndefined();
  });

  it('improvement: Stage D 0.30 → 0.05 → negative delta, decision_support', () => {
    // NOTE: Phase E follow-up — these inventories were previously the default
    // smoke_alarm run class, which under the run-class cap would collapse a
    // 25pp delta to below_noise. The test intent is "a 25pp improvement IS
    // decision_support territory", so we run on a decision_support inventory
    // (30 samples) where the cap doesn't kick in.
    const prev = makeInventory({
      run_class: 'decision_support',
      samples_per_scene: 30,
      by_rule: {
        'T2.no_exactly_once': makeRuleEntry({
          stage_d_fail_rate: 0.30,
          rescue_dependency: 0.10,
        }),
      },
    });
    const curr = makeInventory({
      run_class: 'decision_support',
      samples_per_scene: 30,
      by_rule: {
        'T2.no_exactly_once': makeRuleEntry({
          stage_d_fail_rate: 0.05,
          rescue_dependency: 0.10,
        }),
      },
    });
    const delta = pairedRuleAnalysis(prev, curr, 'T2.no_exactly_once');
    expect(delta).not.toBeNull();
    expect(delta!.stage_d_delta).toBe(-0.25);
    expect(delta!.decision_class).toBe('decision_support'); // 0.25 magnitude
    expect(delta!.note).toBeUndefined(); // no rescue rise, no cleanup intro
  });

  it('regression: Stage D 0.05 → 0.30 → positive delta, decision_support', () => {
    // Phase E follow-up: same fix as the improvement test above — the 25pp
    // magnitude only passes the cap on a decision_support-or-larger run.
    const prev = makeInventory({
      run_class: 'decision_support',
      samples_per_scene: 30,
      by_rule: {
        'T3.no_banned_phrases': makeRuleEntry({ stage_d_fail_rate: 0.05 }),
      },
    });
    const curr = makeInventory({
      run_class: 'decision_support',
      samples_per_scene: 30,
      by_rule: {
        'T3.no_banned_phrases': makeRuleEntry({ stage_d_fail_rate: 0.30 }),
      },
    });
    const delta = pairedRuleAnalysis(prev, curr, 'T3.no_banned_phrases');
    expect(delta!.stage_d_delta).toBe(0.25);
    expect(delta!.decision_class).toBe('decision_support');
  });

  it('hero diagnostic: Stage D improved AND rescue dependency rose → note set', () => {
    // Architecture §14 example: T2.no_exactly_once across v4.4 and v4.5.
    // Stage D went from 0.40 to 0.02 (a 38pp improvement) but rescue
    // dependency went from 0.70 to 0.85. The rule looks better but the
    // model is now even more dependent on cleanup.
    const prev = makeInventory({
      by_rule: {
        'T2.no_exactly_once': makeRuleEntry({
          stage_a_fail_rate: 0.50,
          stage_d_fail_rate: 0.40,
          rescue_dependency: 0.70,
        }),
      },
    });
    const curr = makeInventory({
      by_rule: {
        'T2.no_exactly_once': makeRuleEntry({
          stage_a_fail_rate: 0.80,
          stage_d_fail_rate: 0.02,
          rescue_dependency: 0.85,
        }),
      },
    });
    const delta = pairedRuleAnalysis(prev, curr, 'T2.no_exactly_once');
    expect(delta!.stage_d_delta).toBe(-0.38);
    expect(delta!.rescue_dependency_delta).toBeCloseTo(0.15, 4);
    expect(delta!.note).toBeDefined();
    expect(delta!.note).toContain('rescue dependency rose');
    expect(delta!.note).toContain('cleanup is now doing more work');
  });

  it('cleanup-introducing-failure: Stage A improved but Stage D regressed → note set', () => {
    // Architecture §11.3 pattern 2: cleanup is INTRODUCING the failure.
    // The model got better (Stage A fail rate dropped) but Stage D got worse.
    // Cleanup has a bug.
    const prev = makeInventory({
      by_rule: {
        'T1.weight_steps_0_1': makeRuleEntry({
          stage_a_fail_rate: 0.50,
          stage_d_fail_rate: 0.05,
        }),
      },
    });
    const curr = makeInventory({
      by_rule: {
        'T1.weight_steps_0_1': makeRuleEntry({
          stage_a_fail_rate: 0.10,
          stage_d_fail_rate: 0.20,
        }),
      },
    });
    const delta = pairedRuleAnalysis(prev, curr, 'T1.weight_steps_0_1');
    expect(delta!.stage_a_delta).toBe(-0.40);
    expect(delta!.stage_d_delta).toBeCloseTo(0.15, 4);
    expect(delta!.note).toBeDefined();
    expect(delta!.note).toContain('cleanup layer is introducing');
  });

  it('rule missing in current inventory → returns null', () => {
    const prev = makeInventory({
      by_rule: { 'T1.subject_highest_weight': makeRuleEntry() },
    });
    const curr = makeInventory({ by_rule: {} });
    expect(pairedRuleAnalysis(prev, curr, 'T1.subject_highest_weight')).toBeNull();
  });

  it('rule missing in previous inventory → returns null', () => {
    const prev = makeInventory({ by_rule: {} });
    const curr = makeInventory({
      by_rule: { 'T1.subject_highest_weight': makeRuleEntry() },
    });
    expect(pairedRuleAnalysis(prev, curr, 'T1.subject_highest_weight')).toBeNull();
  });

  it('rounds deltas to 4 decimal places', () => {
    const prev = makeInventory({
      by_rule: {
        'T1.subject_highest_weight': makeRuleEntry({ stage_d_fail_rate: 0.123456789 }),
      },
    });
    const curr = makeInventory({
      by_rule: {
        'T1.subject_highest_weight': makeRuleEntry({ stage_d_fail_rate: 0.111111111 }),
      },
    });
    const delta = pairedRuleAnalysis(prev, curr, 'T1.subject_highest_weight');
    // Both source values get rounded to 4dp, then so does the delta
    expect(delta!.stage_d_delta.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
  });
});

// ============================================================================

describe('diffInventories — full reports', () => {
  it('same inventory compared to itself → no improvements, no regressions, no warnings', () => {
    const inv = makeInventory({
      by_rule: {
        'T1.subject_highest_weight': makeRuleEntry({ stage_d_fail_rate: 0.10 }),
        'T2.no_exactly_once': makeRuleEntry({ stage_d_fail_rate: 0.05 }),
      },
    });
    const diff = diffInventories(inv, inv);
    expect(diff.rules_improved).toEqual([]);
    expect(diff.rules_regressed).toEqual([]);
    expect(diff.rules_unchanged).toBe(2);
    expect(diff.warnings).toEqual([]);
  });

  it('previous_version and current_version are populated from the inputs', () => {
    const prev = makeInventory({ version: 'v4.4' });
    const curr = makeInventory({ version: 'v4.5' });
    const diff = diffInventories(prev, curr);
    expect(diff.previous_version).toBe('v4.4');
    expect(diff.current_version).toBe('v4.5');
  });

  it('multi-rule scenario: improvements sorted by absolute Stage D delta descending', () => {
    // Phase E follow-up: this test exercises 0.10 / 0.20 / 0.50 magnitudes.
    // Under the new run-class cap, 0.10 and 0.20 collapse to below_noise on
    // a smoke_alarm run. We switch to a decision_support inventory so all
    // three rules survive the cap and the sort assertion holds.
    const prev = makeInventory({
      run_class: 'decision_support',
      samples_per_scene: 30,
      by_rule: {
        'T1.subject_highest_weight': makeRuleEntry({ stage_d_fail_rate: 0.10 }),
        'T2.no_exactly_once': makeRuleEntry({ stage_d_fail_rate: 0.50 }),
        'T3.no_banned_phrases': makeRuleEntry({ stage_d_fail_rate: 0.20 }),
      },
    });
    const curr = makeInventory({
      run_class: 'decision_support',
      samples_per_scene: 30,
      by_rule: {
        'T1.subject_highest_weight': makeRuleEntry({ stage_d_fail_rate: 0.00 }), // -0.10
        'T2.no_exactly_once': makeRuleEntry({ stage_d_fail_rate: 0.00 }),        // -0.50
        'T3.no_banned_phrases': makeRuleEntry({ stage_d_fail_rate: 0.00 }),      // -0.20
      },
    });
    const diff = diffInventories(prev, curr);
    expect(diff.rules_improved.length).toBe(3);
    // Sorted by absolute delta descending: 0.50 > 0.20 > 0.10
    expect(diff.rules_improved[0]?.rule).toBe('T2.no_exactly_once');
    expect(diff.rules_improved[1]?.rule).toBe('T3.no_banned_phrases');
    expect(diff.rules_improved[2]?.rule).toBe('T1.subject_highest_weight');
    expect(diff.rules_regressed).toEqual([]);
  });

  it('mixed scenario: some improvements, some regressions, some unchanged', () => {
    // Phase E follow-up: same fix as the sort test above. The 0.10 and 0.25
    // magnitudes only survive the run-class cap on a decision_support run.
    // T4's 0.01 delta is genuinely below_noise on any run class.
    const prev = makeInventory({
      run_class: 'decision_support',
      samples_per_scene: 30,
      by_rule: {
        'T1.subject_highest_weight': makeRuleEntry({ stage_d_fail_rate: 0.10 }),
        'T2.no_exactly_once': makeRuleEntry({ stage_d_fail_rate: 0.05 }),
        'T3.no_banned_phrases': makeRuleEntry({ stage_d_fail_rate: 0.20 }),
        'T4.char_count_under_325': makeRuleEntry({ stage_d_fail_rate: 0.08 }),
      },
    });
    const curr = makeInventory({
      run_class: 'decision_support',
      samples_per_scene: 30,
      by_rule: {
        'T1.subject_highest_weight': makeRuleEntry({ stage_d_fail_rate: 0.00 }), // improved -0.10
        'T2.no_exactly_once': makeRuleEntry({ stage_d_fail_rate: 0.05 }),        // unchanged
        'T3.no_banned_phrases': makeRuleEntry({ stage_d_fail_rate: 0.45 }),      // regressed +0.25
        'T4.char_count_under_325': makeRuleEntry({ stage_d_fail_rate: 0.09 }),   // below_noise +0.01
      },
    });
    const diff = diffInventories(prev, curr);
    expect(diff.rules_improved.length).toBe(1);
    expect(diff.rules_improved[0]?.rule).toBe('T1.subject_highest_weight');
    expect(diff.rules_regressed.length).toBe(1);
    expect(diff.rules_regressed[0]?.rule).toBe('T3.no_banned_phrases');
    expect(diff.rules_unchanged).toBe(2); // T2 (zero delta) + T4 (below noise)
  });

  it('hero rule with rescue-dependency-rose note also surfaces in top-level warnings', () => {
    const prev = makeInventory({
      by_rule: {
        'T2.no_exactly_once': makeRuleEntry({
          stage_d_fail_rate: 0.40,
          rescue_dependency: 0.70,
        }),
      },
    });
    const curr = makeInventory({
      by_rule: {
        'T2.no_exactly_once': makeRuleEntry({
          stage_d_fail_rate: 0.02,
          rescue_dependency: 0.85,
        }),
      },
    });
    const diff = diffInventories(prev, curr);

    // Rule lands in improved AND has the warning note inline
    expect(diff.rules_improved.length).toBe(1);
    expect(diff.rules_improved[0]?.note).toContain('rescue dependency rose');

    // AND the same case is surfaced as a top-level warning
    const warning = diff.warnings.find((w) => w.type === 'rescue_dependency_rose');
    expect(warning).toBeDefined();
    if (warning && warning.type === 'rescue_dependency_rose') {
      expect(warning.ruleId).toBe('T2.no_exactly_once');
      expect(warning.message).toContain('cleanup is now doing more work');
    }
  });

  it('cleanup-introducing-failure also surfaces in top-level warnings', () => {
    const prev = makeInventory({
      by_rule: {
        'T1.weight_steps_0_1': makeRuleEntry({
          stage_a_fail_rate: 0.50,
          stage_d_fail_rate: 0.05,
        }),
      },
    });
    const curr = makeInventory({
      by_rule: {
        'T1.weight_steps_0_1': makeRuleEntry({
          stage_a_fail_rate: 0.10,
          stage_d_fail_rate: 0.20,
        }),
      },
    });
    const diff = diffInventories(prev, curr);
    const warning = diff.warnings.find((w) => w.type === 'cleanup_introducing_failure');
    expect(warning).toBeDefined();
    if (warning && warning.type === 'cleanup_introducing_failure') {
      expect(warning.ruleId).toBe('T1.weight_steps_0_1');
    }
  });

  it('cluster rollup: cluster fail rate improvement → in clusters_improved', () => {
    const prev = makeInventory({
      by_cluster: {
        negative_handling_leak: {
          fail_rate: 0.40,
          contributing_rules: ['T2.no_exactly_once'],
          stage_d_fail_count: 40,
          rule_count: 1,
        },
      },
    });
    const curr = makeInventory({
      by_cluster: {
        negative_handling_leak: {
          fail_rate: 0.05,
          contributing_rules: ['T2.no_exactly_once'],
          stage_d_fail_count: 5,
          rule_count: 1,
        },
      },
    });
    const diff = diffInventories(prev, curr);
    expect(diff.clusters_improved).toContain('negative_handling_leak');
    expect(diff.clusters_regressed).not.toContain('negative_handling_leak');
  });

  it('cluster rollup: cluster fail rate regression → in clusters_regressed', () => {
    const prev = makeInventory({
      by_cluster: {
        syntax_leak: {
          fail_rate: 0.05,
          contributing_rules: ['T1.weight_syntax_correct'],
          stage_d_fail_count: 5,
          rule_count: 1,
        },
      },
    });
    const curr = makeInventory({
      by_cluster: {
        syntax_leak: {
          fail_rate: 0.40,
          contributing_rules: ['T1.weight_syntax_correct'],
          stage_d_fail_count: 40,
          rule_count: 1,
        },
      },
    });
    const diff = diffInventories(prev, curr);
    expect(diff.clusters_regressed).toContain('syntax_leak');
  });

  it('cluster_schema_mismatch: previous v1, current v2 → top-level warning', () => {
    const prev = makeInventory({ cluster_schema_version: 'v1' });
    const curr = makeInventory({ cluster_schema_version: 'v2' });
    const diff = diffInventories(prev, curr);
    const warning = diff.warnings.find((w) => w.type === 'cluster_schema_mismatch');
    expect(warning).toBeDefined();
    expect(warning?.message).toContain('v1');
    expect(warning?.message).toContain('v2');
  });

  it('run_class_mismatch: smoke_alarm vs decision_support → top-level warning', () => {
    const prev = makeInventory({ run_class: 'smoke_alarm', samples_per_scene: 5 });
    const curr = makeInventory({ run_class: 'decision_support', samples_per_scene: 30 });
    const diff = diffInventories(prev, curr);
    const warning = diff.warnings.find((w) => w.type === 'run_class_mismatch');
    expect(warning).toBeDefined();
    expect(warning?.message).toContain('smoke_alarm');
    expect(warning?.message).toContain('decision_support');
  });

  it('scene_count_mismatch: 60 vs 75 → top-level warning', () => {
    const prev = makeInventory({ scene_count: 60 });
    const curr = makeInventory({ scene_count: 75 });
    const diff = diffInventories(prev, curr);
    const warning = diff.warnings.find((w) => w.type === 'scene_count_mismatch');
    expect(warning).toBeDefined();
    expect(warning?.message).toContain('60');
    expect(warning?.message).toContain('75');
  });

  it('rule present in only one inventory is silently dropped from improved/regressed', () => {
    const prev = makeInventory({
      by_rule: {
        'T1.subject_highest_weight': makeRuleEntry({ stage_d_fail_rate: 0.30 }),
      },
    });
    const curr = makeInventory({ by_rule: {} });
    const diff = diffInventories(prev, curr);
    expect(diff.rules_improved).toEqual([]);
    expect(diff.rules_regressed).toEqual([]);
    expect(diff.rules_unchanged).toBe(0);
  });
});

// ============================================================================

describe('attachDiff — non-mutating diff attachment', () => {
  it('returns a new inventory with diff_vs_previous populated', () => {
    const prev = makeInventory({ version: 'v4.4' });
    const curr = makeInventory({ version: 'v4.5' });
    const diff = diffInventories(prev, curr);
    const attached = attachDiff(curr, diff);

    expect(attached.diff_vs_previous).not.toBeNull();
    expect(attached.diff_vs_previous?.previous_version).toBe('v4.4');
    expect(attached.diff_vs_previous?.current_version).toBe('v4.5');
  });

  it('does not mutate the original inventory (still has null diff)', () => {
    const prev = makeInventory({ version: 'v4.4' });
    const curr = makeInventory({ version: 'v4.5' });
    const diff = diffInventories(prev, curr);
    const attached = attachDiff(curr, diff);

    expect(curr.diff_vs_previous).toBeNull();
    expect(attached).not.toBe(curr); // different reference
    expect(attached.diff_vs_previous).not.toBeNull();
  });

  it('preserves every other field on the inventory', () => {
    const prev = makeInventory({ version: 'v4.4' });
    const curr = makeInventory({
      version: 'v4.5',
      run_class: 'decision_support',
      scene_count: 60,
    });
    const diff = diffInventories(prev, curr);
    const attached = attachDiff(curr, diff);

    expect(attached.version).toBe(curr.version);
    expect(attached.run_class).toBe(curr.run_class);
    expect(attached.scene_count).toBe(curr.scene_count);
    expect(attached.by_rule).toBe(curr.by_rule);
    expect(attached.by_cluster).toBe(curr.by_cluster);
    expect(attached.coverage_gaps).toBe(curr.coverage_gaps);
  });
});

// ============================================================================

describe('attachDiff round-trip via writeInventoryToDisk + loadInventory', () => {
  let tempDir: string;

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('writes a diff-attached inventory to disk and reads it back unchanged', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'harness-diff-'));

    const prev = makeInventory({
      version: 'v4.4',
      by_rule: {
        'T2.no_exactly_once': makeRuleEntry({
          stage_d_fail_rate: 0.40,
          rescue_dependency: 0.70,
        }),
      },
    });
    const curr = makeInventory({
      version: 'v4.5',
      by_rule: {
        'T2.no_exactly_once': makeRuleEntry({
          stage_d_fail_rate: 0.02,
          rescue_dependency: 0.85,
        }),
      },
    });
    const diff = diffInventories(prev, curr);
    const attached = attachDiff(curr, diff);

    const filePath = join(tempDir, inventoryFilename(attached));
    await writeInventoryToDisk(attached, filePath);
    const loaded = await loadInventory(filePath);

    expect(loaded.diff_vs_previous).not.toBeNull();
    expect(loaded.diff_vs_previous?.previous_version).toBe('v4.4');
    expect(loaded.diff_vs_previous?.current_version).toBe('v4.5');

    // The hero diagnostic survives the round-trip
    const heroRule = loaded.diff_vs_previous?.rules_improved.find(
      (r: PairedDelta) => r.rule === 'T2.no_exactly_once',
    );
    expect(heroRule).toBeDefined();
    expect(heroRule?.note).toContain('rescue dependency rose');

    // The top-level warning survives too
    const warning = loaded.diff_vs_previous?.warnings.find(
      (w: { type: string }) => w.type === 'rescue_dependency_rose',
    );
    expect(warning).toBeDefined();
  });
});

// ============================================================================

describe('integration: architecture §14 example reproduction', () => {
  it('reproduces the v4.4 → v4.5 T2.no_exactly_once example from §14', () => {
    // The architecture's example shows:
    //   "rule": "T2.no_appears_once",
    //   "stage_d_delta": -0.38,
    //   "rescue_dependency_delta": +0.15,
    //   "decision_class": "decision_support",
    //   "note": "Stage D pass rate improved but rescue dependency rose..."
    //
    // Our rule ID is the canonical T2.no_exactly_once. We reproduce the
    // numbers exactly and assert all four characteristics.
    const prev = makeInventory({
      version: 'v4.4',
      run_class: 'decision_support',
      samples_per_scene: 30,
      by_rule: {
        'T2.no_exactly_once': makeRuleEntry({
          stage_d_fail_rate: 0.40,
          rescue_dependency: 0.70,
        }),
      },
    });
    const curr = makeInventory({
      version: 'v4.5',
      run_class: 'decision_support',
      samples_per_scene: 30,
      by_rule: {
        'T2.no_exactly_once': makeRuleEntry({
          stage_d_fail_rate: 0.02,
          rescue_dependency: 0.85,
        }),
      },
    });

    const diff: DiffReport = diffInventories(prev, curr);

    expect(diff.previous_version).toBe('v4.4');
    expect(diff.current_version).toBe('v4.5');

    expect(diff.rules_improved.length).toBe(1);
    const entry = diff.rules_improved[0]!;
    expect(entry.rule).toBe('T2.no_exactly_once');
    expect(entry.stage_d_delta).toBe(-0.38);
    expect(entry.rescue_dependency_delta).toBeCloseTo(0.15, 4);
    expect(entry.decision_class).toBe('smoke_alarm'); // 0.38 ≥ 0.30
    expect(entry.note).toContain('rescue dependency rose');

    // Top-level warning surfaces the same case
    expect(diff.warnings.find((w) => w.type === 'rescue_dependency_rose')).toBeDefined();

    // No run_class warning because both are decision_support
    expect(diff.warnings.find((w) => w.type === 'run_class_mismatch')).toBeUndefined();
  });
});
