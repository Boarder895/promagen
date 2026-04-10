// src/lib/__tests__/call-2-harness-mechanical-scorer.test.ts
// ============================================================================
// Tests for the Call 2 Quality Harness Mechanical Scorer (Phase C)
// ============================================================================
// Covers every rule (27 rules across 4 tiers) plus coordinator behaviour:
//   - module integrity (duplicate ID detection at load time, all clusters present)
//   - per-rule pass + fail fixtures
//   - coordinator clean run (everything passes)
//   - coordinator broken run (multiple fails, correct cluster tally)
//   - all-stages helper
//
// Authority: call-2-harness-build-plan-v1.md Phase C
// Jest project: util (testMatch: src/lib/__tests__/**/*.test.ts)
// ============================================================================

import { describe, it, expect } from '@jest/globals';

import {
  runMechanicalScorer,
  runMechanicalScorerAllStages,
  ALL_RULES,
  ALL_CLUSTERS,
  CLUSTER_SCHEMA_VERSION,
  T1_RULES,
  T2_RULES,
  T3_RULES,
  T4_RULES,
  type TierBundle,
  type RuleContext,
} from '@/lib/call-2-harness/mechanical-scorer';

// ── Helpers ──────────────────────────────────────────────────────────────

const LIGHTHOUSE_INPUT =
  'A weathered lighthouse keeper stands on the rain-soaked gallery deck at twilight, gripping the iron railing as enormous storm waves crash against the jagged rocks below.';

/**
 * A baseline tier bundle that passes ALL 27 rules. Used as a starting point
 * for targeted-fail fixtures (just mutate the one field that should fail).
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

function ctx(input: string = LIGHTHOUSE_INPUT): RuleContext {
  return { input };
}

/**
 * Run a single rule by ID and return its result. Throws if not found.
 */
function runOneRule(
  ruleId: string,
  bundle: TierBundle,
  context: RuleContext = ctx(),
) {
  const rule = ALL_RULES.find((r) => r.id === ruleId);
  if (!rule) throw new Error(`Test setup: rule ${ruleId} not found`);
  return rule.check(bundle, context);
}

// ============================================================================

describe('Call 2 Harness — mechanical scorer module integrity', () => {
  it('exports the cluster-schema-v1 constant', () => {
    expect(CLUSTER_SCHEMA_VERSION).toBe('v1');
  });

  it('lists exactly 8 clusters', () => {
    expect(ALL_CLUSTERS.length).toBe(8);
  });

  it('every rule ID is unique across all four tiers', () => {
    const ids = ALL_RULES.map((r) => r.id);
    const uniq = new Set(ids);
    expect(uniq.size).toBe(ids.length);
  });

  it('every rule references a known cluster', () => {
    const known = new Set(ALL_CLUSTERS);
    for (const rule of ALL_RULES) {
      expect(known.has(rule.cluster)).toBe(true);
    }
  });

  it('every rule ID is prefixed with its tier (T<n>.)', () => {
    for (const rule of ALL_RULES) {
      expect(rule.id.startsWith(`T${rule.tier}.`)).toBe(true);
    }
  });

  it('expected counts: T1 9, T2 8, T3 5, T4 5, total 27', () => {
    expect(T1_RULES.length).toBe(9);
    expect(T2_RULES.length).toBe(8);
    expect(T3_RULES.length).toBe(5);
    expect(T4_RULES.length).toBe(5);
    expect(ALL_RULES.length).toBe(27);
  });
});

// ============================================================================

describe('T1 (CLIP) rules', () => {
  it('clean baseline passes ALL T1 rules', () => {
    const bundle = cleanBundle();
    for (const rule of T1_RULES) {
      const out = rule.check(bundle, ctx());
      if (!out.passed) {
        // surface the failure for diagnosis
        throw new Error(`T1 rule ${rule.id} failed on clean baseline: ${out.details}`);
      }
    }
  });

  it('weight_syntax_correct: parenthetical baseline → pass', () => {
    expect(runOneRule('T1.weight_syntax_correct', cleanBundle()).passed).toBe(true);
  });

  it('weight_syntax_correct: double-colon in T1 with no provider → fail', () => {
    const bundle = cleanBundle();
    bundle.tier1 = {
      ...bundle.tier1,
      positive: 'masterpiece, lighthouse keeper::1.4, storm waves::1.3, sharp focus, 8K',
    };
    expect(runOneRule('T1.weight_syntax_correct', bundle).passed).toBe(false);
  });

  it('weight_syntax_correct: double-colon WITH provider asking for :: → pass', () => {
    const bundle = cleanBundle();
    bundle.tier1 = {
      ...bundle.tier1,
      positive: 'masterpiece, lighthouse keeper::1.4, storm waves::1.3, sharp focus, 8K',
    };
    const out = runOneRule('T1.weight_syntax_correct', bundle, {
      input: LIGHTHOUSE_INPUT,
      providerContext: { weightingSyntax: 'term::weight', supportsWeighting: true },
    });
    expect(out.passed).toBe(true);
  });

  it('weight_steps_0_1: 1.15 → fail', () => {
    const bundle = cleanBundle();
    bundle.tier1 = {
      ...bundle.tier1,
      positive: 'masterpiece, (lighthouse keeper:1.15), (storm waves:1.3), sharp focus',
    };
    const out = runOneRule('T1.weight_steps_0_1', bundle);
    expect(out.passed).toBe(false);
    expect(out.details).toContain('1.15');
  });

  it('weight_wrap_4_words_max: 6-word phrase → fail', () => {
    const bundle = cleanBundle();
    bundle.tier1 = {
      ...bundle.tier1,
      positive: 'masterpiece, (small girl in a yellow raincoat:1.3), sharp focus, 8K',
    };
    expect(runOneRule('T1.weight_wrap_4_words_max', bundle).passed).toBe(false);
  });

  it('quality_prefix_present: missing prefix → fail', () => {
    const bundle = cleanBundle();
    bundle.tier1 = {
      ...bundle.tier1,
      positive: '(lighthouse keeper:1.4), (storm waves:1.3), sharp focus, 8K',
    };
    expect(runOneRule('T1.quality_prefix_present', bundle).passed).toBe(false);
  });

  it('quality_suffix_present: missing suffix → fail', () => {
    const bundle = cleanBundle();
    bundle.tier1 = {
      ...bundle.tier1,
      positive: 'masterpiece, best quality, (lighthouse keeper:1.4), (storm waves:1.3)',
    };
    expect(runOneRule('T1.quality_suffix_present', bundle).passed).toBe(false);
  });

  it('comma_separated_format: prose sentences → fail', () => {
    const bundle = cleanBundle();
    bundle.tier1 = {
      ...bundle.tier1,
      positive: 'A lighthouse keeper stands on the deck. The storm waves crash below.',
    };
    expect(runOneRule('T1.comma_separated_format', bundle).passed).toBe(false);
  });

  it('no_trailing_punctuation: trailing period → fail', () => {
    const bundle = cleanBundle();
    bundle.tier1 = {
      ...bundle.tier1,
      positive: 'masterpiece, (lighthouse keeper:1.4), sharp focus, 8K.',
    };
    expect(runOneRule('T1.no_trailing_punctuation', bundle).passed).toBe(false);
  });

  it('no_isolated_colour_weights: (yellow:1.2) → fail', () => {
    const bundle = cleanBundle();
    bundle.tier1 = {
      ...bundle.tier1,
      positive:
        'masterpiece, best quality, (lighthouse keeper:1.4), (yellow:1.2), (storm waves:1.3), sharp focus, 8K',
    };
    expect(runOneRule('T1.no_isolated_colour_weights', bundle).passed).toBe(false);
  });

  it('subject_highest_weight: 1.2 first then 1.4 → fail', () => {
    const bundle = cleanBundle();
    bundle.tier1 = {
      ...bundle.tier1,
      positive:
        'masterpiece, (twilight sky:1.2), (lighthouse keeper:1.4), (storm waves:1.3), sharp focus, 8K',
    };
    expect(runOneRule('T1.subject_highest_weight', bundle).passed).toBe(false);
  });
});

// ============================================================================

describe('T2 (Midjourney) rules', () => {
  it('clean baseline passes ALL T2 rules', () => {
    const bundle = cleanBundle();
    for (const rule of T2_RULES) {
      const out = rule.check(bundle, ctx());
      if (!out.passed) {
        throw new Error(`T2 rule ${rule.id} failed on clean baseline: ${out.details}`);
      }
    }
  });

  it('ar_param_present: missing --ar → fail', () => {
    const bundle = cleanBundle();
    bundle.tier2 = {
      ...bundle.tier2,
      positive: bundle.tier2.positive.replace('--ar 16:9 ', ''),
    };
    expect(runOneRule('T2.ar_param_present', bundle).passed).toBe(false);
  });

  it('v_param_present: missing --v → fail', () => {
    const bundle = cleanBundle();
    bundle.tier2 = {
      ...bundle.tier2,
      positive: bundle.tier2.positive.replace('--v 7 ', ''),
    };
    expect(runOneRule('T2.v_param_present', bundle).passed).toBe(false);
  });

  it('s_param_present: missing --s → fail', () => {
    const bundle = cleanBundle();
    bundle.tier2 = {
      ...bundle.tier2,
      positive: bundle.tier2.positive.replace('--s 500 ', ''),
    };
    expect(runOneRule('T2.s_param_present', bundle).passed).toBe(false);
  });

  it('no_param_present: missing --no → fail', () => {
    const bundle = cleanBundle();
    bundle.tier2 = {
      ...bundle.tier2,
      positive: 'subject::2.0, scene::1.4, style::1.2 --ar 16:9 --v 7 --s 500',
    };
    expect(runOneRule('T2.no_param_present', bundle).passed).toBe(false);
  });

  it('no_exactly_once: duplicate --no blocks → fail (rescue-dependency canary)', () => {
    const bundle = cleanBundle();
    bundle.tier2 = {
      ...bundle.tier2,
      positive:
        'subject::2.0, scene::1.4, style::1.2 --ar 16:9 --v 7 --s 500 --no blurry --no low quality',
    };
    const out = runOneRule('T2.no_exactly_once', bundle);
    expect(out.passed).toBe(false);
    expect(out.details).toContain('2 times');
  });

  it('weight_clauses_min_3: only 2 :: clauses → fail', () => {
    const bundle = cleanBundle();
    bundle.tier2 = {
      ...bundle.tier2,
      positive: 'lighthouse keeper::2.0, storm waves::1.4 --ar 16:9 --v 7 --s 500 --no blurry',
    };
    expect(runOneRule('T2.weight_clauses_min_3', bundle).passed).toBe(false);
  });

  it('no_mid_phrase_weights: weight followed by more words → fail', () => {
    const bundle = cleanBundle();
    bundle.tier2 = {
      ...bundle.tier2,
      positive:
        'lone researcher::2.0 standing in the blizzard, frozen plains::1.4, cinematic::1.2 --ar 16:9 --v 7 --s 500 --no blurry',
    };
    expect(runOneRule('T2.no_mid_phrase_weights', bundle).passed).toBe(false);
  });

  it('empty_negative_json_field: T2.negative non-empty → fail', () => {
    const bundle = cleanBundle();
    bundle.tier2 = { ...bundle.tier2, negative: 'blurry, text' };
    expect(runOneRule('T2.empty_negative_json_field', bundle).passed).toBe(false);
  });
});

// ============================================================================

describe('T3 (Natural Language) rules', () => {
  it('clean baseline passes ALL T3 rules', () => {
    const bundle = cleanBundle();
    for (const rule of T3_RULES) {
      const out = rule.check(bundle, ctx());
      if (!out.passed) {
        throw new Error(`T3 rule ${rule.id} failed on clean baseline: ${out.details}`);
      }
    }
  });

  it('char_count_in_range: 100 chars → fail (under 280)', () => {
    const bundle = cleanBundle();
    bundle.tier3 = { ...bundle.tier3, positive: 'A short scene. Two sentences only here.' };
    expect(runOneRule('T3.char_count_in_range', bundle).passed).toBe(false);
  });

  it('char_count_in_range: 500 chars → fail (over 420)', () => {
    const bundle = cleanBundle();
    bundle.tier3 = { ...bundle.tier3, positive: 'A '.repeat(260) + 'long scene.' };
    expect(runOneRule('T3.char_count_in_range', bundle).passed).toBe(false);
  });

  it('sentence_count_2_to_3: 1 sentence → fail', () => {
    const bundle = cleanBundle();
    bundle.tier3 = {
      ...bundle.tier3,
      positive:
        'A weathered lighthouse keeper grips the iron railing of a rain-soaked gallery deck at twilight as storm waves crash against the jagged rocks below and salt spray rises into the dark sky above the lonely coast where a single beacon cuts gold.',
    };
    expect(runOneRule('T3.sentence_count_2_to_3', bundle).passed).toBe(false);
  });

  it('no_banned_phrases: "the scene feels" → fail', () => {
    const bundle = cleanBundle();
    bundle.tier3 = {
      ...bundle.tier3,
      positive:
        'From a low cinematic vantage on the storm-lashed coast, a lone figure grips the iron railing of the gallery deck. The scene feels heavy with quiet dread as the storm approaches the rocks below the lighthouse beam.',
    };
    expect(runOneRule('T3.no_banned_phrases', bundle).passed).toBe(false);
  });

  it('no_banned_tail_constructions: "captured in cinematic detail" → fail', () => {
    const bundle = cleanBundle();
    bundle.tier3 = {
      ...bundle.tier3,
      positive:
        'From a low cinematic vantage on the storm-lashed coast, a lone figure grips the iron railing of a lighthouse gallery as twilight waves detonate against the rocks below, captured in cinematic detail.',
    };
    expect(runOneRule('T3.no_banned_tail_constructions', bundle).passed).toBe(false);
  });

  it('first_8_words_no_echo: input first 8 words copied verbatim → fail', () => {
    const bundle = cleanBundle();
    bundle.tier3 = {
      ...bundle.tier3,
      positive:
        'A weathered lighthouse keeper stands on the rain-soaked gallery deck at twilight, gripping the iron railing as the storm waves crash below. Salt spray rises into the purple-and-copper sky while the beacon cuts a pale gold arc through driving rain.',
    };
    expect(runOneRule('T3.first_8_words_no_echo', bundle).passed).toBe(false);
  });
});

// ============================================================================

describe('T4 (Plain Language) rules', () => {
  it('clean baseline passes ALL T4 rules', () => {
    const bundle = cleanBundle();
    for (const rule of T4_RULES) {
      const out = rule.check(bundle, ctx());
      if (!out.passed) {
        throw new Error(`T4 rule ${rule.id} failed on clean baseline: ${out.details}`);
      }
    }
  });

  it('char_count_under_325: 400 chars → fail', () => {
    const bundle = cleanBundle();
    bundle.tier4 = { ...bundle.tier4, positive: 'A '.repeat(200) + 'long T4.' };
    expect(runOneRule('T4.char_count_under_325', bundle).passed).toBe(false);
  });

  it('min_10_words_per_sentence: 5-word sentence → fail', () => {
    const bundle = cleanBundle();
    bundle.tier4 = {
      ...bundle.tier4,
      positive:
        'A keeper stands at twilight. Salt spray drifts into the purple sky while the beam cuts gold through driving rain.',
    };
    expect(runOneRule('T4.min_10_words_per_sentence', bundle).passed).toBe(false);
  });

  it('no_banned_openers: "It is twilight..." → fail', () => {
    const bundle = cleanBundle();
    bundle.tier4 = {
      ...bundle.tier4,
      positive:
        'It is twilight on the storm-lashed coast where the keeper grips the railing. Waves crash below and salt spray drifts up.',
    };
    expect(runOneRule('T4.no_banned_openers', bundle).passed).toBe(false);
  });

  it('no_meta_language: "the scene shows" → fail', () => {
    const bundle = cleanBundle();
    bundle.tier4 = {
      ...bundle.tier4,
      positive:
        'The scene shows a keeper at twilight on the storm-lashed coast as enormous waves crash below the gallery deck.',
    };
    expect(runOneRule('T4.no_meta_language', bundle).passed).toBe(false);
  });

  it('first_8_words_no_echo: input first 8 words copied → fail', () => {
    const bundle = cleanBundle();
    bundle.tier4 = {
      ...bundle.tier4,
      positive:
        'A weathered lighthouse keeper stands on the rain-soaked gallery deck while waves crash below and salt spray rises into the sky.',
    };
    expect(runOneRule('T4.first_8_words_no_echo', bundle).passed).toBe(false);
  });
});

// ============================================================================

describe('coordinator — runMechanicalScorer', () => {
  it('clean bundle: passCount === totalRules, failCount === 0', () => {
    const result = runMechanicalScorer(cleanBundle(), 'd', ctx());
    expect(result.totalRules).toBe(ALL_RULES.length);
    expect(result.failCount).toBe(0);
    expect(result.passCount).toBe(ALL_RULES.length);
    expect(result.stage).toBe('d');
    expect(result.clusterSchemaVersion).toBe('v1');
    // Every cluster tally is zero
    for (const c of ALL_CLUSTERS) {
      expect(result.failsByCluster[c]).toBe(0);
    }
  });

  it('broken bundle: T2 duplicate --no produces a negative_handling_leak fail', () => {
    const bundle = cleanBundle();
    bundle.tier2 = {
      ...bundle.tier2,
      positive:
        'subject::2.0, scene::1.4, style::1.2 --ar 16:9 --v 7 --s 500 --no blurry --no low quality',
    };
    const result = runMechanicalScorer(bundle, 'a', ctx());
    expect(result.failCount).toBeGreaterThanOrEqual(1);
    expect(result.failsByCluster.negative_handling_leak).toBeGreaterThanOrEqual(1);

    const dupRule = result.results.find((r) => r.ruleId === 'T2.no_exactly_once');
    expect(dupRule).toBeDefined();
    expect(dupRule?.passed).toBe(false);
    expect(dupRule?.cluster).toBe('negative_handling_leak');
  });

  it('result.results length equals ALL_RULES length', () => {
    const result = runMechanicalScorer(cleanBundle(), 'a', ctx());
    expect(result.results.length).toBe(ALL_RULES.length);
  });

  it('a rule that throws is recorded as a fail with RULE_THREW prefix', () => {
    // Easiest way to make a rule throw: pass a bundle with a non-string field.
    // We can't do that through the type system, but we can simulate by mutating.
    const bundle = cleanBundle() as unknown as TierBundle & {
      tier1: { positive: unknown; negative: string };
    };
    bundle.tier1.positive = null as unknown as string;
    const result = runMechanicalScorer(bundle as TierBundle, 'a', ctx());
    // At least one rule should have thrown and been caught
    const thrown = result.results.find((r) => r.details?.startsWith('RULE_THREW'));
    expect(thrown).toBeDefined();
    expect(thrown?.passed).toBe(false);
  });
});

// ============================================================================

describe('coordinator — runMechanicalScorerAllStages', () => {
  it('returns four stage results, all clean for an identical clean bundle', () => {
    const stages = {
      a: cleanBundle(),
      b: cleanBundle(),
      c: cleanBundle(),
      d: cleanBundle(),
    };
    const all = runMechanicalScorerAllStages(stages, ctx());
    expect(all.a.stage).toBe('a');
    expect(all.b.stage).toBe('b');
    expect(all.c.stage).toBe('c');
    expect(all.d.stage).toBe('d');
    for (const stage of [all.a, all.b, all.c, all.d]) {
      expect(stage.failCount).toBe(0);
    }
  });

  it('rescue dependency signature: Stage A fails T2.no_exactly_once but Stage D passes', () => {
    const broken = cleanBundle();
    broken.tier2 = {
      ...broken.tier2,
      positive:
        'subject::2.0, scene::1.4, style::1.2 --ar 16:9 --v 7 --s 500 --no blurry --no low quality',
    };
    const stages = {
      a: broken,        // model bug intact
      b: cleanBundle(), // post-processing rescued it
      c: cleanBundle(),
      d: cleanBundle(),
    };
    const all = runMechanicalScorerAllStages(stages, ctx());

    const aRule = all.a.results.find((r) => r.ruleId === 'T2.no_exactly_once');
    const dRule = all.d.results.find((r) => r.ruleId === 'T2.no_exactly_once');
    expect(aRule?.passed).toBe(false);
    expect(dRule?.passed).toBe(true);

    // This is the rescue dependency signature: same rule, opposite outcomes
    // across stages. Phase D's rescue dependency calculator will compute the
    // index from exactly this kind of paired data.
  });
});
