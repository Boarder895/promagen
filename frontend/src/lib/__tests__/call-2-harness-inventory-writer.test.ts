// src/lib/__tests__/call-2-harness-inventory-writer.test.ts
// ============================================================================
// Tests for the Call 2 Quality Harness Failure-Mode Inventory Writer (Phase D)
// ============================================================================
// Covers:
//   - run-classes: RUN_CLASS_CONFIG correctness, getRunClassConfig
//   - rescue-dependency: formula edge cases, health classification, all 5 buckets
//   - inventory-writer: clean baseline, rescue signature end-to-end, by_cluster
//     aggregation, coverage gaps detection
//   - file I/O: write-then-read round-trip via tmp dir
//
// Authority: call-2-harness-build-plan-v1.md Phase D,
//            call-2-quality-architecture-v0.3.1.md §11, §14, §16
// Jest project: util (testMatch: src/lib/__tests__/**/*.test.ts)
// ============================================================================

import { describe, it, expect, afterAll } from '@jest/globals';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ALL_RUN_CLASSES,
  RUN_CLASS_CONFIG,
  getRunClassConfig,
  type RunClass,
} from '@/lib/call-2-harness/run-classes';

import {
  calculateRescueDependency,
  calculateFailRate,
  classifyRuleHealth,
  interpretRuleHealth,
  type SampleStageResults,
} from '@/lib/call-2-harness/rescue-dependency';

import {
  buildInventory,
  writeInventoryToDisk,
  loadInventory,
  inventoryFilename,
  type HarnessRun,
} from '@/lib/call-2-harness/inventory-writer';

import {
  runMechanicalScorerAllStages,
  ALL_RULES,
  type TierBundle,
} from '@/lib/call-2-harness/mechanical-scorer';

// ── Helpers ──────────────────────────────────────────────────────────────

const LIGHTHOUSE_INPUT =
  'A weathered lighthouse keeper stands on the rain-soaked gallery deck at twilight, gripping the iron railing as enormous storm waves crash against the jagged rocks below.';

/**
 * A baseline tier bundle that passes ALL Phase C rules. Same fixture used
 * in the Phase C tests so any drift surfaces in both test suites.
 */
function cleanBundle(): TierBundle {
  return {
    tier1: {
      positive:
        'masterpiece, best quality, highly detailed, (lighthouse keeper:1.4), (storm waves:1.3), (twilight sky:1.2), iron railing, salt spray, wide-angle composition, sharp focus, 8K',
      negative: 'blurry, low quality, deformed, text, watermark',
    },
    tier2: {
      positive:
        'a weathered lighthouse keeper grips the iron railing of a storm-lashed gallery deck at twilight::2.0, enormous storm waves crashing against jagged rocks below as salt spray rises into a purple-and-copper sky::1.4, cinematic concept art with low-angle framing::1.2 --ar 16:9 --v 7 --s 500 --no blurry, text, watermark, distorted',
      negative: '',
    },
    tier3: {
      positive:
        'From a low cinematic vantage on the storm-lashed coast, a lone figure grips the iron railing of a lighthouse gallery as twilight waves detonate against the rocks below. Salt spray rises high into the purple-and-copper sky while a single beacon cuts a pale gold arc through sheets of driving rain.',
      negative: '',
    },
    tier4: {
      positive:
        'At twilight on the rain-lashed coast, a lighthouse keeper grips the gallery railing as enormous waves crash on the rocks below. Salt spray drifts into the purple sky while the lighthouse beam cuts gold through driving rain.',
      negative: '',
    },
  };
}

/**
 * A bundle where T2 has duplicate --no blocks — the canonical model bug
 * that postProcessTiers rescues. Used to construct the rescue signature.
 */
function brokenT2Bundle(): TierBundle {
  const bundle = cleanBundle();
  return {
    ...bundle,
    tier2: {
      positive:
        'a weathered lighthouse keeper grips the iron railing of a storm-lashed gallery deck at twilight::2.0, enormous storm waves crashing against jagged rocks below as salt spray rises into a purple-and-copper sky::1.4, cinematic concept art with low-angle framing::1.2 --ar 16:9 --v 7 --s 500 --no blurry --no low quality',
      negative: '',
    },
  };
}

function makeSample(
  sceneId: string,
  sampleIndex: number,
  stages: { a: TierBundle; b: TierBundle; c: TierBundle; d: TierBundle },
  input: string = LIGHTHOUSE_INPUT,
): SampleStageResults {
  const scored = runMechanicalScorerAllStages(stages, { input });
  return { sceneId, sampleIndex, stages: scored };
}

function makeRun(
  samples: readonly SampleStageResults[],
  overrides: Partial<HarnessRun> = {},
): HarnessRun {
  return {
    version: 'v4.5',
    runClass: 'smoke_alarm',
    harnessVersion: '0.3.1',
    modelVersion: 'gpt-5.4-mini-2026-02-15',
    runTimestamp: '2026-04-10T14:32:11.000Z',
    sceneCount: 1,
    samplesPerScene: samples.length,
    wallClockSeconds: 12,
    samples,
    ...overrides,
  };
}

// ============================================================================

describe('run-classes', () => {
  it('exports all five canonical run classes', () => {
    expect(ALL_RUN_CLASSES.length).toBe(5);
    expect(ALL_RUN_CLASSES).toEqual([
      'smoke_alarm',
      'decision_support',
      'dispute_resolution',
      'milestone',
      'mutation',
    ]);
  });

  it('smoke_alarm has 5 samples per scene and no metamorphic/holdout/spot-audit', () => {
    const cfg = RUN_CLASS_CONFIG.smoke_alarm;
    expect(cfg.samplesPerScene).toBe(5);
    expect(cfg.metamorphic).toBe(false);
    expect(cfg.holdout).toBe(false);
    expect(cfg.spotAudit).toBe(false);
  });

  it('decision_support has 30 samples and metamorphic=true', () => {
    expect(RUN_CLASS_CONFIG.decision_support.samplesPerScene).toBe(30);
    expect(RUN_CLASS_CONFIG.decision_support.metamorphic).toBe(true);
  });

  it('milestone enables holdout AND spot audit', () => {
    const cfg = RUN_CLASS_CONFIG.milestone;
    expect(cfg.holdout).toBe(true);
    expect(cfg.spotAudit).toBe(true);
    expect(cfg.metamorphic).toBe(true);
  });

  it('mutation has shallow samples (5) — depth comes from breadth', () => {
    expect(RUN_CLASS_CONFIG.mutation.samplesPerScene).toBe(5);
  });

  it('getRunClassConfig returns the same object as the table', () => {
    for (const rc of ALL_RUN_CLASSES) {
      expect(getRunClassConfig(rc)).toBe(RUN_CLASS_CONFIG[rc]);
    }
  });

  it('getRunClassConfig throws on unknown class', () => {
    expect(() => getRunClassConfig('not-a-class' as RunClass)).toThrow();
  });
});

// ============================================================================

describe('rescue-dependency formula', () => {
  // We need synthetic SampleStageResults that include just the rule we're
  // testing. The real scorer always runs all 27 rules, so we use it but
  // only inspect one rule at a time.

  it('returns 0 when no samples pass at Stage D', () => {
    // Construct a sample where the broken T2 is in BOTH Stage A and Stage D
    // (i.e. no rescue happened). T2.no_exactly_once fails everywhere.
    const sample = makeSample('test-1', 0, {
      a: brokenT2Bundle(),
      b: brokenT2Bundle(),
      c: brokenT2Bundle(),
      d: brokenT2Bundle(),
    });
    const rd = calculateRescueDependency([sample], 'T2.no_exactly_once');
    expect(rd).toBe(0);
  });

  it('returns 1.0 when EVERY Stage D pass was rescued from a Stage A fail', () => {
    // Stage A is broken, Stages B/C/D are clean (post-processing rescued)
    const sample = makeSample('test-1', 0, {
      a: brokenT2Bundle(),
      b: cleanBundle(),
      c: cleanBundle(),
      d: cleanBundle(),
    });
    const rd = calculateRescueDependency([sample], 'T2.no_exactly_once');
    expect(rd).toBe(1.0);
  });

  it('returns 0 when Stage A also passed (model produced it correctly)', () => {
    const sample = makeSample('test-1', 0, {
      a: cleanBundle(),
      b: cleanBundle(),
      c: cleanBundle(),
      d: cleanBundle(),
    });
    const rd = calculateRescueDependency([sample], 'T2.no_exactly_once');
    expect(rd).toBe(0);
  });

  it('returns 0.5 when half of Stage D passes were rescues', () => {
    const samples = [
      makeSample('s1', 0, {
        a: brokenT2Bundle(), // rescue
        b: cleanBundle(),
        c: cleanBundle(),
        d: cleanBundle(),
      }),
      makeSample('s2', 1, {
        a: cleanBundle(), // model produced it
        b: cleanBundle(),
        c: cleanBundle(),
        d: cleanBundle(),
      }),
    ];
    const rd = calculateRescueDependency(samples, 'T2.no_exactly_once');
    expect(rd).toBe(0.5);
  });
});

// ============================================================================

describe('calculateFailRate', () => {
  it('clean baseline → 0 fail rate at all stages for T2.no_exactly_once', () => {
    const sample = makeSample('s1', 0, {
      a: cleanBundle(),
      b: cleanBundle(),
      c: cleanBundle(),
      d: cleanBundle(),
    });
    expect(calculateFailRate([sample], 'T2.no_exactly_once', 'a')).toBe(0);
    expect(calculateFailRate([sample], 'T2.no_exactly_once', 'd')).toBe(0);
  });

  it('rescue signature: Stage A fail rate 1.0, Stage D fail rate 0', () => {
    const sample = makeSample('s1', 0, {
      a: brokenT2Bundle(),
      b: cleanBundle(),
      c: cleanBundle(),
      d: cleanBundle(),
    });
    expect(calculateFailRate([sample], 'T2.no_exactly_once', 'a')).toBe(1);
    expect(calculateFailRate([sample], 'T2.no_exactly_once', 'd')).toBe(0);
  });
});

// ============================================================================

describe('classifyRuleHealth', () => {
  it('HEALTHY: low Stage D fail, low rescue dependency', () => {
    expect(classifyRuleHealth(0.02, 0.0)).toBe('HEALTHY');
    expect(classifyRuleHealth(0.05, 0.29)).toBe('HEALTHY');
  });

  it('FRAGILE: low Stage D fail, high rescue dependency', () => {
    expect(classifyRuleHealth(0.02, 0.85)).toBe('FRAGILE');
    expect(classifyRuleHealth(0.0, 1.0)).toBe('FRAGILE');
  });

  it('BORDERLINE: middle Stage D fail rate', () => {
    expect(classifyRuleHealth(0.07, 0.0)).toBe('BORDERLINE');
    expect(classifyRuleHealth(0.1, 0.5)).toBe('BORDERLINE');
  });

  it('CHRONIC: high Stage D fail, high rescue dependency', () => {
    expect(classifyRuleHealth(0.25, 0.4)).toBe('CHRONIC');
    expect(classifyRuleHealth(0.5, 0.6)).toBe('CHRONIC');
  });

  it('REAL_FAILURE: high Stage D fail, low rescue dependency', () => {
    expect(classifyRuleHealth(0.2, 0.05)).toBe('REAL_FAILURE');
    expect(classifyRuleHealth(0.5, 0.0)).toBe('REAL_FAILURE');
  });

  it('interpretRuleHealth returns a non-empty string for every health bucket', () => {
    const buckets = ['HEALTHY', 'FRAGILE', 'BORDERLINE', 'CHRONIC', 'REAL_FAILURE'] as const;
    for (const h of buckets) {
      const text = interpretRuleHealth(h, 0.5, 0.1);
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================

describe('buildInventory', () => {
  it('clean run produces an inventory with zero fails everywhere', () => {
    const samples = [
      makeSample('s1', 0, { a: cleanBundle(), b: cleanBundle(), c: cleanBundle(), d: cleanBundle() }),
      makeSample('s1', 1, { a: cleanBundle(), b: cleanBundle(), c: cleanBundle(), d: cleanBundle() }),
    ];
    const inv = buildInventory(makeRun(samples));
    for (const ruleId of Object.keys(inv.by_rule)) {
      const entry = inv.by_rule[ruleId]!;
      expect(entry.stage_a_fail_rate).toBe(0);
      expect(entry.stage_d_fail_rate).toBe(0);
      expect(entry.rescue_dependency).toBe(0);
      expect(entry.health).toBe('HEALTHY');
    }
  });

  it('rescue signature run: T2.no_exactly_once is FRAGILE with rescue_dependency 1.0', () => {
    const samples = [
      makeSample('s1', 0, {
        a: brokenT2Bundle(),
        b: cleanBundle(),
        c: cleanBundle(),
        d: cleanBundle(),
      }),
      makeSample('s1', 1, {
        a: brokenT2Bundle(),
        b: cleanBundle(),
        c: cleanBundle(),
        d: cleanBundle(),
      }),
      makeSample('s1', 2, {
        a: brokenT2Bundle(),
        b: cleanBundle(),
        c: cleanBundle(),
        d: cleanBundle(),
      }),
    ];
    const inv = buildInventory(makeRun(samples));
    const noEntry = inv.by_rule['T2.no_exactly_once']!;

    // Stage A fail rate = 100% (every sample broken at A)
    expect(noEntry.stage_a_fail_rate).toBe(1);
    // Stage D fail rate = 0% (every sample rescued by D)
    expect(noEntry.stage_d_fail_rate).toBe(0);
    // Rescue dependency = 100% — every Stage D pass was a rescue
    expect(noEntry.rescue_dependency).toBe(1);
    // Health = FRAGILE (D≤5%, rescue≥30%)
    expect(noEntry.health).toBe('FRAGILE');
    // Interpretation should mention the rescue percentage
    expect(noEntry.interpretation).toContain('100%');
  });

  it('REAL_FAILURE: Stage A and Stage D both broken → no rescue, REAL_FAILURE health', () => {
    const samples = [
      makeSample('s1', 0, {
        a: brokenT2Bundle(),
        b: brokenT2Bundle(),
        c: brokenT2Bundle(),
        d: brokenT2Bundle(),
      }),
      makeSample('s1', 1, {
        a: brokenT2Bundle(),
        b: brokenT2Bundle(),
        c: brokenT2Bundle(),
        d: brokenT2Bundle(),
      }),
    ];
    const inv = buildInventory(makeRun(samples));
    const noEntry = inv.by_rule['T2.no_exactly_once']!;
    expect(noEntry.stage_d_fail_rate).toBe(1);
    expect(noEntry.rescue_dependency).toBe(0);
    expect(noEntry.health).toBe('REAL_FAILURE');
  });

  it('inventory metadata copies through from HarnessRun', () => {
    const samples = [
      makeSample('s1', 0, { a: cleanBundle(), b: cleanBundle(), c: cleanBundle(), d: cleanBundle() }),
    ];
    const inv = buildInventory(
      makeRun(samples, {
        version: 'v4.6',
        runClass: 'decision_support',
        harnessVersion: '0.3.2',
        modelVersion: 'gpt-5.4-mini-test',
        sceneCount: 7,
      }),
    );
    expect(inv.version).toBe('v4.6');
    expect(inv.run_class).toBe('decision_support');
    expect(inv.harness_version).toBe('0.3.2');
    expect(inv.model_version).toBe('gpt-5.4-mini-test');
    expect(inv.cluster_schema_version).toBe('v2');
  });

  it('by_cluster aggregates fails into the correct cluster', () => {
    // T2.no_exactly_once is in negative_handling_leak.
    // Break it across 2 samples; check that cluster count is 2.
    const samples = [
      makeSample('s1', 0, {
        a: cleanBundle(),
        b: cleanBundle(),
        c: cleanBundle(),
        d: brokenT2Bundle(), // fail at D
      }),
      makeSample('s1', 1, {
        a: cleanBundle(),
        b: cleanBundle(),
        c: cleanBundle(),
        d: brokenT2Bundle(),
      }),
    ];
    const inv = buildInventory(makeRun(samples));
    const cluster = inv.by_cluster.negative_handling_leak;
    expect(cluster.stage_d_fail_count).toBeGreaterThanOrEqual(2);
    expect(cluster.contributing_rules).toContain('T2.no_exactly_once');
    expect(cluster.contributing_rules).toContain('T2.no_param_present');
    expect(cluster.contributing_rules).toContain('T2.empty_negative_json_field');
  });

  it('coverage_gaps is empty by default (no scene set provided → no claim)', () => {
    const samples = [
      makeSample('s1', 0, { a: cleanBundle(), b: cleanBundle(), c: cleanBundle(), d: cleanBundle() }),
    ];
    const inv = buildInventory(makeRun(samples));
    // No options.ruleIdsExercisedByScenes → writer makes no coverage claim.
    // Silence is better than the previous "every rule that didn't fail is a gap" lie.
    expect(inv.coverage_gaps).toEqual([]);
  });

  it('coverage_gaps reports mechanical rules that no scene exercises', () => {
    const samples = [
      makeSample('s1', 0, { a: cleanBundle(), b: cleanBundle(), c: cleanBundle(), d: cleanBundle() }),
    ];
    // Pretend the scene library only exercises 2 of the 27 mechanical rules.
    const exercised = new Set<string>(['T1.subject_highest_weight', 'T2.no_exactly_once']);
    const inv = buildInventory(makeRun(samples), { ruleIdsExercisedByScenes: exercised });

    // 29 total mechanical rules - 2 exercised = 27 gaps
    expect(inv.coverage_gaps.length).toBe(27);
    // The two exercised rules should NOT appear in gaps
    const gapsText = inv.coverage_gaps.join('\n');
    expect(gapsText).not.toContain('T1.subject_highest_weight');
    expect(gapsText).not.toContain('T2.no_exactly_once');
    // A non-exercised rule should appear
    expect(gapsText).toContain('T3.first_8_words_no_echo');
    // Gap entries should explain the cause clearly
    expect(inv.coverage_gaps[0]).toContain('no scene in the library exercises');
  });

  it('coverage_gaps is empty when every mechanical rule is exercised by some scene', () => {
    const samples = [
      makeSample('s1', 0, { a: cleanBundle(), b: cleanBundle(), c: cleanBundle(), d: cleanBundle() }),
    ];
    // Build a synthetic "fully covered" set from ALL_RULES
    const exercised = new Set<string>(ALL_RULES.map((r) => r.id));
    const inv = buildInventory(makeRun(samples), { ruleIdsExercisedByScenes: exercised });
    expect(inv.coverage_gaps).toEqual([]);
  });

  it('phase-deferred fields are null', () => {
    const samples = [
      makeSample('s1', 0, { a: cleanBundle(), b: cleanBundle(), c: cleanBundle(), d: cleanBundle() }),
    ];
    const inv = buildInventory(makeRun(samples));
    expect(inv.by_judge).toBeNull();
    expect(inv.metamorphic_stability).toBeNull();
    expect(inv.spot_audit).toBeNull();
    expect(inv.diff_vs_previous).toBeNull();
    expect(inv.holdout_run).toBeNull();
  });
});

// ============================================================================

describe('inventoryFilename', () => {
  it('builds a deterministic, cross-platform-safe filename', () => {
    const samples = [
      makeSample('s1', 0, { a: cleanBundle(), b: cleanBundle(), c: cleanBundle(), d: cleanBundle() }),
    ];
    const inv = buildInventory(
      makeRun(samples, {
        version: 'v4.5',
        runClass: 'smoke_alarm',
        runTimestamp: '2026-04-10T14:32:11.000Z',
      }),
    );
    const fn = inventoryFilename(inv);
    expect(fn).toBe('v4.5-smoke_alarm-2026-04-10T14-32-11-000Z.json');
    // Must end with .json
    expect(fn.endsWith('.json')).toBe(true);
    // Windows-illegal characters: : < > " | ? *
    // (Dots in version IDs like "v4.5" are fine — Windows filenames allow them.)
    expect(fn).not.toMatch(/[:<>"|?*]/);
  });
});

// ============================================================================

describe('writeInventoryToDisk + loadInventory round-trip', () => {
  let tempDir: string;

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('writes an inventory to disk and reads it back unchanged', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'harness-inventory-'));

    const samples = [
      makeSample('s1', 0, {
        a: brokenT2Bundle(),
        b: cleanBundle(),
        c: cleanBundle(),
        d: cleanBundle(),
      }),
    ];
    const original = buildInventory(makeRun(samples));
    const filePath = join(tempDir, inventoryFilename(original));

    await writeInventoryToDisk(original, filePath);
    const loaded = await loadInventory(filePath);

    expect(loaded.version).toBe(original.version);
    expect(loaded.run_class).toBe(original.run_class);
    expect(loaded.cluster_schema_version).toBe(original.cluster_schema_version);

    // Critical: rescue_dependency survives the round-trip
    const originalRescue = original.by_rule['T2.no_exactly_once']!.rescue_dependency;
    const loadedRescue = loaded.by_rule['T2.no_exactly_once']!.rescue_dependency;
    expect(loadedRescue).toBe(originalRescue);
    expect(loadedRescue).toBe(1);
  });

  it('creates parent directories if missing', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'harness-inventory-'));
    const samples = [
      makeSample('s1', 0, { a: cleanBundle(), b: cleanBundle(), c: cleanBundle(), d: cleanBundle() }),
    ];
    const inv = buildInventory(makeRun(samples));
    const nestedPath = join(tempDir, 'a', 'b', 'c', 'inv.json');
    await writeInventoryToDisk(inv, nestedPath);
    const loaded = await loadInventory(nestedPath);
    expect(loaded.version).toBe(inv.version);
  });

  it('loadInventory throws on a malformed file', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'harness-inventory-'));
    const badPath = join(tempDir, 'bad.json');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(badPath, '{"foo": "bar"}', 'utf8');
    await expect(loadInventory(badPath)).rejects.toThrow();
  });
});

// ============================================================================

describe('integration: rescue dependency end-to-end', () => {
  it('identifies T2.no_exactly_once as the canonical fragile rule', () => {
    // This is the architecture's hero example. Build a run where:
    //   - 80% of samples have the duplicate --no bug at Stage A
    //   - All 80% are rescued by Stage B onwards
    //   - 20% are clean from Stage A
    // Expected: rescue_dependency ~= 0.8, health = FRAGILE.
    const samples: SampleStageResults[] = [];
    for (let i = 0; i < 8; i += 1) {
      samples.push(
        makeSample(`s${i}`, i, {
          a: brokenT2Bundle(),
          b: cleanBundle(),
          c: cleanBundle(),
          d: cleanBundle(),
        }),
      );
    }
    for (let i = 8; i < 10; i += 1) {
      samples.push(
        makeSample(`s${i}`, i, {
          a: cleanBundle(),
          b: cleanBundle(),
          c: cleanBundle(),
          d: cleanBundle(),
        }),
      );
    }

    const inv = buildInventory(makeRun(samples, { sceneCount: 10, samplesPerScene: 1 }));
    const entry = inv.by_rule['T2.no_exactly_once']!;

    expect(entry.stage_a_fail_rate).toBe(0.8);
    expect(entry.stage_d_fail_rate).toBe(0);
    expect(entry.rescue_dependency).toBe(0.8);
    expect(entry.health).toBe('FRAGILE');
    expect(entry.interpretation).toContain('80%');
    expect(entry.interpretation).toContain('rescue');
  });
});
