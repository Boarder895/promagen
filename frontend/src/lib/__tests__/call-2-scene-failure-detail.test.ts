// src/lib/__tests__/call-2-scene-failure-detail.test.ts
// ============================================================================
// Tests for per-scene Stage D failure breakdown in the inventory writer
// ============================================================================
// Verifies that `stage_d_scene_detail` is populated correctly for rules
// with Stage D failures, showing which scenes fail and with what details.
//
// This is the diagnostic needed to answer ChatGPT's question: "Is the T3
// under-length problem concentrated on sparse/edge-case scenes, or spread
// evenly?" The next harness run will produce this data in the inventory JSON.
//
// Run: pnpm run test:util -- --testPathPattern="call-2-scene-failure-detail"
// ============================================================================

import { describe, it, expect } from '@jest/globals';

import {
  buildInventory,
  type HarnessRun,
} from '@/lib/call-2-harness/inventory-writer';

import {
  runMechanicalScorerAllStages,
  type TierBundle,
} from '@/lib/call-2-harness/mechanical-scorer';

import type { SampleStageResults } from '@/lib/call-2-harness/rescue-dependency';

// ── Helpers ──────────────────────────────────────────────────────────────

const INPUT = 'A weathered lighthouse keeper stands on the rain-soaked gallery deck at twilight, gripping the iron railing as enormous storm waves crash against the jagged rocks below.';

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

/** Bundle with T3 under 280 chars — triggers T3.char_count_in_range UNDER */
function shortT3Bundle(): TierBundle {
  const bundle = cleanBundle();
  return {
    ...bundle,
    tier3: {
      positive: 'A keeper stands on the gallery deck at twilight. Waves crash below on the jagged rocks.',
      negative: '',
    },
  };
}

/** Bundle with T3 over 420 chars — triggers T3.char_count_in_range OVER */
function longT3Bundle(): TierBundle {
  const bundle = cleanBundle();
  return {
    ...bundle,
    tier3: {
      positive:
        'From a low cinematic vantage on the storm-lashed coast, a lone figure grips the iron railing of a lighthouse gallery as twilight waves detonate against the jagged rocks below, sending towers of white spray into the darkening sky. ' +
        'The lighthouse beam sweeps through sheets of driving rain, casting a warm golden arc across the turbulent dark coastline. ' +
        'Ancient weathered stones bear the deep scars of centuries of relentless Atlantic storms battering this remote and exposed headland with unending fury and devastation.',
      negative: '',
    },
  };
}

function makeSample(
  sceneId: string,
  sampleIndex: number,
  stages: { a: TierBundle; b: TierBundle; c: TierBundle; d: TierBundle },
): SampleStageResults {
  const scored = runMechanicalScorerAllStages(stages, { input: INPUT });
  return { sceneId, sampleIndex, stages: scored };
}

function makeRun(samples: readonly SampleStageResults[]): HarnessRun {
  return {
    version: 'v4.5',
    runClass: 'smoke_alarm',
    harnessVersion: '0.3.1',
    modelVersion: 'gpt-5.4-mini-2026-02-15',
    runTimestamp: '2026-04-10T14:32:11.000Z',
    sceneCount: 2,
    samplesPerScene: samples.length,
    wallClockSeconds: 12,
    samples,
  };
}

// ============================================================================

describe('stage_d_scene_detail in inventory', () => {
  it('is omitted for rules with zero Stage D failures', () => {
    // All clean bundles — no failures
    const clean = cleanBundle();
    const samples = [
      makeSample('scene-a', 0, { a: clean, b: clean, c: clean, d: clean }),
      makeSample('scene-b', 1, { a: clean, b: clean, c: clean, d: clean }),
    ];

    const inv = buildInventory(makeRun(samples));

    // T1.weight_syntax_correct should be healthy with no scene detail
    const rule = inv.by_rule['T1.weight_syntax_correct'];
    expect(rule).toBeDefined();
    expect(rule!.stage_d_fail_rate).toBe(0);
    expect(rule!.stage_d_scene_detail).toBeUndefined();
  });

  it('shows which scenes fail T3.char_count_in_range at Stage D', () => {
    const clean = cleanBundle();
    const short = shortT3Bundle();

    // scene-a: 2 clean samples (T3 passes)
    // scene-b: 2 short-T3 samples (T3 fails under-length at Stage D)
    const samples = [
      makeSample('scene-a', 0, { a: clean, b: clean, c: clean, d: clean }),
      makeSample('scene-a', 1, { a: clean, b: clean, c: clean, d: clean }),
      makeSample('scene-b', 0, { a: short, b: short, c: short, d: short }),
      makeSample('scene-b', 1, { a: short, b: short, c: short, d: short }),
    ];

    const inv = buildInventory(makeRun(samples));
    const rule = inv.by_rule['T3.char_count_in_range'];

    expect(rule).toBeDefined();
    expect(rule!.stage_d_fail_rate).toBeGreaterThan(0);
    expect(rule!.stage_d_scene_detail).toBeDefined();

    // scene-a should NOT appear (no failures)
    expect(rule!.stage_d_scene_detail!['scene-a']).toBeUndefined();

    // scene-b SHOULD appear with 2 failures
    const sceneB = rule!.stage_d_scene_detail!['scene-b'];
    expect(sceneB).toBeDefined();
    expect(sceneB!.fail_count).toBe(2);
    expect(sceneB!.sample_count).toBe(2);

    // Details should contain UNDER direction tag
    expect(sceneB!.details.length).toBe(2);
    for (const detail of sceneB!.details) {
      expect(detail).toContain('UNDER');
    }
  });

  it('distinguishes OVER and UNDER failures across different scenes', () => {
    const clean = cleanBundle();
    const short = shortT3Bundle();
    const long = longT3Bundle();

    const samples = [
      makeSample('sparse-scene', 0, { a: short, b: short, c: short, d: short }),
      makeSample('dense-scene', 0, { a: long, b: long, c: long, d: long }),
      makeSample('good-scene', 0, { a: clean, b: clean, c: clean, d: clean }),
    ];

    const inv = buildInventory(makeRun(samples));
    const rule = inv.by_rule['T3.char_count_in_range'];
    expect(rule!.stage_d_scene_detail).toBeDefined();

    // sparse-scene: UNDER
    const sparse = rule!.stage_d_scene_detail!['sparse-scene'];
    expect(sparse).toBeDefined();
    expect(sparse!.details[0]).toContain('UNDER');

    // dense-scene: OVER
    const dense = rule!.stage_d_scene_detail!['dense-scene'];
    expect(dense).toBeDefined();
    expect(dense!.details[0]).toContain('OVER');

    // good-scene: not in the map
    expect(rule!.stage_d_scene_detail!['good-scene']).toBeUndefined();
  });

  it('includes actual character count in details for diagnostic value', () => {
    const short = shortT3Bundle();
    const samples = [
      makeSample('test-scene', 0, { a: short, b: short, c: short, d: short }),
    ];

    const inv = buildInventory(makeRun(samples));
    const rule = inv.by_rule['T3.char_count_in_range'];
    const scene = rule!.stage_d_scene_detail!['test-scene'];

    expect(scene).toBeDefined();
    // Details should contain "T3 length NN" with the actual char count
    expect(scene!.details[0]).toMatch(/T3 length \d+/);
  });

  it('survives JSON round-trip (serialise and parse)', () => {
    const short = shortT3Bundle();
    const samples = [
      makeSample('scene-x', 0, { a: short, b: short, c: short, d: short }),
    ];

    const inv = buildInventory(makeRun(samples));
    const json = JSON.stringify(inv);
    const parsed = JSON.parse(json) as typeof inv;

    const rule = parsed.by_rule['T3.char_count_in_range'];
    expect(rule!.stage_d_scene_detail).toBeDefined();
    expect(rule!.stage_d_scene_detail!['scene-x']!.fail_count).toBe(1);
  });
});
