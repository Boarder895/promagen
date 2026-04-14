// src/lib/call-2-harness/scene-class-separator.ts
// ============================================================================
// Call 2 Quality Harness — Scene-Class Separator (Phase 2)
// ============================================================================
// Not all inputs deserve the same quality expectations. A dim lamp on
// hostile inputs is not the same as a dim lamp on canonical scenes.
//
// This module separates harness results by input class so edge-case noise
// doesn't distort production quality judgement.
//
// Per §6.2: The circuit summary must show separate scores per input class.
//
// Authority: api-call-2-v2_1_0.md §6
// Existing features preserved: Yes (new file).
// ============================================================================

import type { SampleStageResults } from './rescue-dependency';
import type { Scene } from './scene-library';

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Input classes from §6.1. A scene carries one input_class tag.
 */
export type InputClass =
  | 'canonical'
  | 'technical'
  | 'dense'
  | 'sparse'
  | 'single_word'
  | 'hostile'
  | 'malformed'
  | 'contradictory'
  | 'stuttered'
  | 'platform_syntax'
  | 'extremely_long';

/**
 * Per-class score breakdown. One entry per input class present in the run.
 */
export interface SceneClassResult {
  readonly input_class: InputClass;
  readonly scene_count: number;
  readonly sample_count: number;
  readonly stage_d_pass_rate: number;
  readonly stage_d_fail_rate: number;
  readonly total_rule_evaluations: number;
  readonly total_rule_failures: number;
  /** Per-rule fail rates within this class only */
  readonly rule_fail_rates: Readonly<Record<string, number>>;
  /** Quality expectation from §6.1 */
  readonly quality_expectation: string;
  /** Fault treatment from §6.1 */
  readonly fault_treatment: string;
}

export interface SceneClassBreakdown {
  readonly classes: Readonly<Record<InputClass, SceneClassResult>>;
  readonly class_count: number;
}

// ── Input class inference ──────────────────────────────────────────────────

/**
 * Quality expectations and fault treatment per input class from §6.1.
 */
const CLASS_METADATA: Record<InputClass, { quality: string; faults: string }> = {
  canonical: {
    quality: 'Full quality expected',
    faults: 'All failures are real faults',
  },
  technical: {
    quality: 'Conversion expected, not raw passthrough',
    faults: 'Conversion failures are code faults',
  },
  dense: {
    quality: 'Compression expected, some loss accepted',
    faults: 'Secondary detail loss is accepted_constraint_loss',
  },
  sparse: {
    quality: 'Enrichment expected, lower coverage threshold',
    faults: 'Under-length T3 is accepted_constraint_loss',
  },
  single_word: {
    quality: 'Best-effort generation, no coverage check',
    faults: 'Almost all failures are input_quality_limit',
  },
  hostile: {
    quality: 'Format survival expected, content secondary',
    faults: 'Most failures are accepted_constraint_loss',
  },
  malformed: {
    quality: 'Graceful handling expected',
    faults: 'Failures tagged input_quality_limit unless structural rules break',
  },
  contradictory: {
    quality: 'GPT must resolve or blend, no measurement yet',
    faults: 'Failures tagged input_quality_limit',
  },
  stuttered: {
    quality: 'GPT should deduplicate',
    faults: 'Not yet measured',
  },
  platform_syntax: {
    quality: 'System should reformat for other tiers',
    faults: 'Not yet measured',
  },
  extremely_long: {
    quality: 'Heavy compression required',
    faults: 'Secondary/tertiary detail loss is accepted_constraint_loss',
  },
};

/**
 * Infer the input class for a scene based on its properties.
 *
 * Priority:
 * 1. Explicit `input_class` field on the scene (if present)
 * 2. Category + tag-based inference
 * 3. Word-count-based inference
 */
export function inferInputClass(scene: Scene & { input_class?: InputClass }): InputClass {
  // Explicit tag takes precedence
  if (scene.input_class) return scene.input_class;

  const category = scene.category;
  const tags = new Set(scene.tags.map((t) => t.toLowerCase()));
  const wordCount = scene.input.trim().split(/\s+/).filter(Boolean).length;

  // Single word
  if (wordCount <= 2) return 'single_word';

  // Category-based
  if (category === 'trap') {
    if (tags.has('contradiction')) return 'contradictory';
    return 'hostile';
  }

  if (category === 'human_factors') {
    if (wordCount <= 2) return 'single_word';
    return 'malformed';
  }

  if (category === 'alien') return 'canonical'; // Abstract but well-formed

  // Stress scenes — infer from tags and word count
  if (category === 'stress') {
    if (wordCount < 15) return 'sparse';
    if (wordCount > 200) return 'dense';
    if (tags.has('no-subject') || tags.has('abstract')) return 'malformed';
    if (tags.has('dense') || tags.has('long')) return 'dense';
    if (tags.has('sparse') || tags.has('minimal')) return 'sparse';
    return 'canonical';
  }

  // Canonical scenes — check for technical content
  if (tags.has('camera-specs') || tags.has('technical') || tags.has('lens')) {
    return 'technical';
  }

  // Dense canonical
  if (wordCount > 200) return 'dense';

  // Sparse canonical
  if (wordCount < 25) return 'sparse';

  return 'canonical';
}

// ── Separator ──────────────────────────────────────────────────────────────

/**
 * Separate harness results by input class.
 *
 * Takes the full sample results + scene list, groups samples by their
 * scene's input class, and computes per-class fail rates.
 */
export function separateBySceneClass(
  samples: readonly SampleStageResults[],
  scenes: readonly (Scene & { input_class?: InputClass })[],
): SceneClassBreakdown {
  // Build scene ID → input class lookup
  const sceneClassMap = new Map<string, InputClass>();
  for (const scene of scenes) {
    sceneClassMap.set(scene.id, inferInputClass(scene));
  }

  // Group samples by input class
  const classSamples = new Map<InputClass, SampleStageResults[]>();
  for (const sample of samples) {
    const inputClass = sceneClassMap.get(sample.sceneId) ?? 'canonical';
    if (!classSamples.has(inputClass)) classSamples.set(inputClass, []);
    classSamples.get(inputClass)!.push(sample);
  }

  // Compute per-class results
  const classes: Record<string, SceneClassResult> = {};

  for (const [inputClass, classSampleList] of classSamples) {
    const meta = CLASS_METADATA[inputClass];
    const sceneIds = new Set(classSampleList.map((s) => s.sceneId));

    // Count total rule evaluations and failures at Stage D
    let totalEvaluations = 0;
    let totalFailures = 0;
    const ruleFailCounts: Record<string, number> = {};
    const ruleEvalCounts: Record<string, number> = {};

    for (const sample of classSampleList) {
      const stageD = sample.stages.d;
      for (const result of stageD.results) {
        totalEvaluations += 1;
        const evalKey = result.ruleId;
        ruleEvalCounts[evalKey] = (ruleEvalCounts[evalKey] ?? 0) + 1;

        if (!result.passed) {
          totalFailures += 1;
          ruleFailCounts[evalKey] = (ruleFailCounts[evalKey] ?? 0) + 1;
        }
      }
    }

    // Compute per-rule fail rates within this class
    const ruleFailRates: Record<string, number> = {};
    for (const [ruleId, failCount] of Object.entries(ruleFailCounts)) {
      const evalCount = ruleEvalCounts[ruleId] ?? 1;
      ruleFailRates[ruleId] = failCount / evalCount;
    }

    const totalPassRate = totalEvaluations > 0
      ? (totalEvaluations - totalFailures) / totalEvaluations
      : 1;

    classes[inputClass] = {
      input_class: inputClass,
      scene_count: sceneIds.size,
      sample_count: classSampleList.length,
      stage_d_pass_rate: totalPassRate,
      stage_d_fail_rate: 1 - totalPassRate,
      total_rule_evaluations: totalEvaluations,
      total_rule_failures: totalFailures,
      rule_fail_rates: Object.freeze(ruleFailRates),
      quality_expectation: meta.quality,
      fault_treatment: meta.faults,
    };
  }

  return {
    classes: Object.freeze(classes) as Readonly<Record<InputClass, SceneClassResult>>,
    class_count: Object.keys(classes).length,
  };
}
