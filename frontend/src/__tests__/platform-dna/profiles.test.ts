// src/data/platform-dna/profiles.test.ts
// ============================================================================
// PLATFORM DNA PROFILE — Tests
// ============================================================================
// Build plan: call-3-quality-build-plan-v1.md §5.4
//
// Location: src/data/platform-dna/ (matches jest 'data' project testMatch)
//
// Validates:
//   1. All 40 platforms present
//   2. Every platform has a valid encoderFamily
//   3. allowedTransforms is non-empty for every platform
//   4. charCeiling ≤ maxChars from platform-config.json
//   5. tokenLimit matches encoder family expectations
//   6. Schema-level integrity (no orphaned fields, enum compliance)
//   7. Loader functions return correct results
//   8. Cross-reference: every platform in platform-config.json has a DNA entry
// ============================================================================

import {
  getDNA,
  getAllDNA,
  getAllDNAIds,
  getDNAByEncoderFamily,
  getGPTPlatforms,
  getDeterministicPlatforms,
  isTransformAllowed,
} from '@/data/platform-dna';

import type {
  EncoderFamily,
  TransformId,
} from '@/data/platform-dna/types';

import platformConfigRaw from '@/data/providers/platform-config.json';

// ── Test helpers ────────────────────────────────────────────────────────────

interface PlatformConfigEntry {
  maxChars: number;
  tier: number;
  negativeSupport: string;
}

/** Extract platform entries from platform-config.json (skip _meta, _tiers, etc.) */
function getPlatformConfigEntries(): Record<string, PlatformConfigEntry> {
  const raw = platformConfigRaw as Record<string, Record<string, unknown>>;
  const platforms = raw['platforms'] as Record<string, Record<string, unknown>> | undefined;
  if (!platforms) {
    throw new Error('platform-config.json missing "platforms" key');
  }

  const result: Record<string, PlatformConfigEntry> = {};
  for (const [key, value] of Object.entries(platforms)) {
    result[key] = {
      maxChars: value['maxChars'] as number,
      tier: value['tier'] as number,
      negativeSupport: value['negativeSupport'] as string,
    };
  }
  return result;
}

const PLATFORM_CONFIG = getPlatformConfigEntries();
const EXPECTED_PLATFORM_COUNT = 40;

// ── 1. Completeness ─────────────────────────────────────────────────────────

describe('Platform DNA — Completeness', () => {
  test(`exactly ${EXPECTED_PLATFORM_COUNT} platforms present`, () => {
    const all = getAllDNA();
    const count = Object.keys(all).length;
    expect(count).toBe(EXPECTED_PLATFORM_COUNT);
  });

  test('every platform in platform-config.json has a DNA entry', () => {
    const dnaIds = new Set(getAllDNAIds());
    const configIds = Object.keys(PLATFORM_CONFIG);

    const missing = configIds.filter((id) => !dnaIds.has(id));
    expect(missing).toEqual([]);
  });

  test('every DNA entry has a matching platform-config.json entry', () => {
    const configIds = new Set(Object.keys(PLATFORM_CONFIG));
    const dnaIds = getAllDNAIds();

    const orphaned = dnaIds.filter((id) => !configIds.has(id));
    expect(orphaned).toEqual([]);
  });

  test('getAllDNAIds returns sorted array', () => {
    const ids = getAllDNAIds();
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});

// ── 2. Schema integrity ─────────────────────────────────────────────────────

describe('Platform DNA — Schema integrity', () => {
  const allDNA = getAllDNA();

  test.each(Object.entries(allDNA))('%s: id field matches key', (key, dna) => {
    expect(dna.id).toBe(key);
  });

  test.each(Object.entries(allDNA))('%s: has valid encoderFamily', (_key, dna) => {
    const validFamilies: EncoderFamily[] = ['clip', 't5', 'llm_rewrite', 'llm_semantic', 'proprietary'];
    expect(validFamilies).toContain(dna.encoderFamily);
  });

  test.each(Object.entries(allDNA))('%s: allowedTransforms is non-empty', (_key, dna) => {
    expect(dna.allowedTransforms.length).toBeGreaterThan(0);
  });

  test.each(Object.entries(allDNA))('%s: every transform is a valid TransformId', (_key, dna) => {
    const validTransforms: TransformId[] = [
      'T_SUBJECT_FRONT', 'T_ATTENTION_SEQUENCE', 'T_WEIGHT_REBALANCE',
      'T_TOKEN_MERGE', 'T_SEMANTIC_COMPRESS', 'T_REDUNDANCY_STRIP',
      'T_QUALITY_POSITION', 'T_PARAM_VALIDATE', 'T_WEIGHT_VALIDATE',
      'T_CLAUSE_FRONT', 'T_SCENE_PREMISE', 'T_PROSE_RESTRUCTURE',
      'T_NARRATIVE_ARMOUR', 'T_NEGATIVE_GENERATE', 'T_CHAR_ENFORCE',
      'T_SYNTAX_CLEANUP',
    ];
    for (const t of dna.allowedTransforms) {
      expect(validTransforms).toContain(t);
    }
  });

  test.each(Object.entries(allDNA))('%s: charCeiling is positive', (_key, dna) => {
    expect(dna.charCeiling).toBeGreaterThan(0);
  });

  test.each(Object.entries(allDNA))('%s: frontLoadImportance in [0, 1]', (_key, dna) => {
    expect(dna.processingProfile.frontLoadImportance).toBeGreaterThanOrEqual(0);
    expect(dna.processingProfile.frontLoadImportance).toBeLessThanOrEqual(1);
  });

  test.each(Object.entries(allDNA))('%s: GPT temperature consistency', (_key, dna) => {
    if (dna.requiresGPT) {
      expect(dna.gptTemperature).not.toBeNull();
      expect(typeof dna.gptTemperature).toBe('number');
    } else {
      expect(dna.gptTemperature).toBeNull();
    }
  });

  test.each(Object.entries(allDNA))('%s: no duplicate transforms', (_key, dna) => {
    const unique = new Set(dna.allowedTransforms);
    expect(unique.size).toBe(dna.allowedTransforms.length);
  });

  test.each(Object.entries(allDNA))('%s: knownFailureModes is an array', (_key, dna) => {
    expect(Array.isArray(dna.knownFailureModes)).toBe(true);
  });

  test.each(Object.entries(allDNA))('%s: harmonyStatus is valid', (_key, dna) => {
    expect(['verified', 'in_progress', 'untested']).toContain(dna.harmonyStatus);
  });

  test.each(Object.entries(allDNA))('%s: measurement fields are null (pre-Phase 6)', (_key, dna) => {
    expect(dna.assembledBaseline).toBeNull();
    expect(dna.optimisedScore).toBeNull();
    expect(dna.availableHeadroom).toBeNull();
  });
});

// ── 3. Cross-reference with platform-config.json ────────────────────────────

describe('Platform DNA — Cross-reference with platform-config.json', () => {
  const allDNA = getAllDNA();

  test.each(Object.entries(allDNA))('%s: charCeiling ≤ maxChars from config', (key, dna) => {
    const config = PLATFORM_CONFIG[key];
    if (!config) {
      throw new Error(`Platform "${key}" missing from platform-config.json`);
    }
    expect(dna.charCeiling).toBeLessThanOrEqual(config.maxChars);
  });

  test.each(Object.entries(allDNA))('%s: negativeMode aligns with config negativeSupport', (key, dna) => {
    const config = PLATFORM_CONFIG[key];
    if (!config) {
      throw new Error(`Platform "${key}" missing from platform-config.json`);
    }

    // Map config negativeSupport to expected DNA negativeMode values
    const validMappings: Record<string, string[]> = {
      'separate': ['separate_field'],
      'inline': ['inline'],
      'none': ['none', 'converted', 'counterproductive'],
    };

    const allowedDnaValues = validMappings[config.negativeSupport];
    if (!allowedDnaValues) {
      throw new Error(`Unknown negativeSupport "${config.negativeSupport}" for platform "${key}"`);
    }
    expect(allowedDnaValues).toContain(dna.negativeMode);
  });
});

// ── 4. Encoder family specific rules ────────────────────────────────────────

describe('Platform DNA — CLIP family rules', () => {
  const clipPlatforms = getDNAByEncoderFamily('clip');

  test('exactly 7 CLIP platforms', () => {
    expect(clipPlatforms).toHaveLength(7);
  });

  test('all CLIP platforms have tokenLimit = 77', () => {
    for (const dna of clipPlatforms) {
      expect(dna.tokenLimit).toBe(77);
    }
  });

  test('all CLIP platforms have tokenBudget defined', () => {
    for (const dna of clipPlatforms) {
      expect(dna.tokenBudget).not.toBeNull();
    }
  });

  test('all CLIP platforms are deterministic (zero GPT cost)', () => {
    for (const dna of clipPlatforms) {
      expect(dna.requiresGPT).toBe(false);
    }
  });

  test('all CLIP platforms have T_CHAR_ENFORCE', () => {
    for (const dna of clipPlatforms) {
      expect(dna.allowedTransforms).toContain('T_CHAR_ENFORCE');
    }
  });

  test('all CLIP platforms have T_SUBJECT_FRONT', () => {
    for (const dna of clipPlatforms) {
      expect(dna.allowedTransforms).toContain('T_SUBJECT_FRONT');
    }
  });

  test('all CLIP platforms have T_ATTENTION_SEQUENCE', () => {
    for (const dna of clipPlatforms) {
      expect(dna.allowedTransforms).toContain('T_ATTENTION_SEQUENCE');
    }
  });

  test('all CLIP platforms have qualityTagsEffective = true', () => {
    for (const dna of clipPlatforms) {
      expect(dna.processingProfile.qualityTagsEffective).toBe(true);
    }
  });

  test('all CLIP platforms have promptStylePreference = weighted_keywords', () => {
    for (const dna of clipPlatforms) {
      expect(dna.promptStylePreference).toBe('weighted_keywords');
    }
  });

  test('CLIP platform IDs are the expected 7', () => {
    const ids = clipPlatforms.map((d) => d.id).sort();
    expect(ids).toEqual([
      'dreamlike', 'dreamstudio', 'fotor', 'leonardo', 'lexica', 'novelai', 'stability',
    ]);
  });
});

describe('Platform DNA — T5 family rules', () => {
  const t5Platforms = getDNAByEncoderFamily('t5');

  test('exactly 2 T5 platforms', () => {
    expect(t5Platforms).toHaveLength(2);
  });

  test('all T5 platforms have tokenLimit = 512', () => {
    for (const dna of t5Platforms) {
      expect(dna.tokenLimit).toBe(512);
    }
  });

  test('all T5 platforms have tokenBudget = null', () => {
    for (const dna of t5Platforms) {
      expect(dna.tokenBudget).toBeNull();
    }
  });

  test('T5 platform IDs are flux and google-imagen', () => {
    const ids = t5Platforms.map((d) => d.id).sort();
    expect(ids).toEqual(['flux', 'google-imagen']);
  });
});

describe('Platform DNA — LLM family rules', () => {
  const llmRewrite = getDNAByEncoderFamily('llm_rewrite');
  const llmSemantic = getDNAByEncoderFamily('llm_semantic');

  test('exactly 1 llm_rewrite platform (openai)', () => {
    expect(llmRewrite).toHaveLength(1);
    const first = llmRewrite[0];
    expect(first).toBeDefined();
    expect(first!.id).toBe('openai');
  });

  test('openai has rewritesPrompt = true', () => {
    const first = llmRewrite[0];
    expect(first).toBeDefined();
    expect(first!.processingProfile.rewritesPrompt).toBe(true);
  });

  test('exactly 2 llm_semantic platforms (midjourney, kling)', () => {
    expect(llmSemantic).toHaveLength(2);
    const ids = llmSemantic.map((d) => d.id).sort();
    expect(ids).toEqual(['kling', 'midjourney']);
  });

  test('kling has tokenLimit = 256', () => {
    const kling = getDNA('kling');
    expect(kling).not.toBeNull();
    expect(kling!.tokenLimit).toBe(256);
  });
});

describe('Platform DNA — Midjourney specific', () => {
  const mj = getDNA('midjourney');

  test('midjourney exists', () => {
    expect(mj).not.toBeNull();
  });

  test('midjourney has mixed promptStylePreference', () => {
    expect(mj!.promptStylePreference).toBe('mixed');
  });

  test('midjourney has double_colon syntaxMode', () => {
    expect(mj!.syntaxMode).toBe('double_colon');
  });

  test('midjourney has inline negativeMode', () => {
    expect(mj!.negativeMode).toBe('inline');
  });

  test('midjourney has T_PARAM_VALIDATE and T_WEIGHT_VALIDATE', () => {
    expect(mj!.allowedTransforms).toContain('T_PARAM_VALIDATE');
    expect(mj!.allowedTransforms).toContain('T_WEIGHT_VALIDATE');
  });

  test('midjourney requires GPT (Call T2 — Phase C)', () => {
    expect(mj!.requiresGPT).toBe(true);
  });

  test('midjourney frontLoadImportance is highest (0.9)', () => {
    expect(mj!.processingProfile.frontLoadImportance).toBe(0.9);
  });
});

// ── 5. GPT vs deterministic split ───────────────────────────────────────────

describe('Platform DNA — GPT vs deterministic split', () => {
  test('GPT platforms have gptTemperature set', () => {
    const gptPlatforms = getGPTPlatforms();
    for (const dna of gptPlatforms) {
      expect(dna.gptTemperature).not.toBeNull();
      expect(typeof dna.gptTemperature).toBe('number');
    }
  });

  test('deterministic platforms have gptTemperature = null', () => {
    const detPlatforms = getDeterministicPlatforms();
    for (const dna of detPlatforms) {
      expect(dna.gptTemperature).toBeNull();
    }
  });

  test('GPT + deterministic = total platforms', () => {
    const gptCount = getGPTPlatforms().length;
    const detCount = getDeterministicPlatforms().length;
    expect(gptCount + detCount).toBe(EXPECTED_PLATFORM_COUNT);
  });

  test('retry is only enabled on platforms that require GPT', () => {
    const allDNA = getAllDNA();
    for (const dna of Object.values(allDNA)) {
      if (dna.retryEnabled) {
        // Architecture §8: retry only on platforms with GPT transforms
        expect(dna.requiresGPT).toBe(true);
      }
    }
  });
});

// ── 6. Loader function tests ────────────────────────────────────────────────

describe('Platform DNA — Loader functions', () => {
  test('getDNA returns correct profile for known platform', () => {
    const stability = getDNA('stability');
    expect(stability).not.toBeNull();
    expect(stability!.id).toBe('stability');
    expect(stability!.encoderFamily).toBe('clip');
    expect(stability!.tokenLimit).toBe(77);
  });

  test('getDNA returns null for unknown platform', () => {
    const result = getDNA('nonexistent-platform');
    expect(result).toBeNull();
  });

  test('getDNA returns null for empty string', () => {
    const result = getDNA('');
    expect(result).toBeNull();
  });

  test('isTransformAllowed returns true for allowed transform', () => {
    expect(isTransformAllowed('stability', 'T_ATTENTION_SEQUENCE')).toBe(true);
  });

  test('isTransformAllowed returns false for disallowed transform', () => {
    expect(isTransformAllowed('stability', 'T_PROSE_RESTRUCTURE')).toBe(false);
  });

  test('isTransformAllowed returns false for unknown platform', () => {
    expect(isTransformAllowed('nonexistent', 'T_CHAR_ENFORCE')).toBe(false);
  });

  test('getDNAByEncoderFamily returns empty for nonexistent family', () => {
    const result = getDNAByEncoderFamily('nonexistent' as EncoderFamily);
    expect(result).toEqual([]);
  });
});

// ── 7. Special cases ────────────────────────────────────────────────────────

describe('Platform DNA — Special cases', () => {
  test('luma-ai negativeMode is counterproductive', () => {
    const luma = getDNA('luma-ai');
    expect(luma).not.toBeNull();
    expect(luma!.negativeMode).toBe('counterproductive');
  });

  test('openai has T_NARRATIVE_ARMOUR (rewrite-proof defence)', () => {
    const openai = getDNA('openai');
    expect(openai).not.toBeNull();
    expect(openai!.allowedTransforms).toContain('T_NARRATIVE_ARMOUR');
  });

  test('adobe-firefly harmonyStatus is in_progress (93/100 scored)', () => {
    const firefly = getDNA('adobe-firefly');
    expect(firefly).not.toBeNull();
    expect(firefly!.harmonyStatus).toBe('in_progress');
  });

  test('123rf harmonyStatus is in_progress (91/100 scored)', () => {
    const rf = getDNA('123rf');
    expect(rf).not.toBeNull();
    expect(rf!.harmonyStatus).toBe('in_progress');
  });

  test('google-imagen has gpt_degradation_proven failure mode', () => {
    const imagen = getDNA('google-imagen');
    expect(imagen).not.toBeNull();
    expect(imagen!.knownFailureModes).toContain('gpt_degradation_proven');
  });

  test('canva has nl_degradation_proven failure mode', () => {
    const canva = getDNA('canva');
    expect(canva).not.toBeNull();
    expect(canva!.knownFailureModes).toContain('nl_degradation_proven');
  });
});

// ── 8. Universal invariants ─────────────────────────────────────────────────

describe('Platform DNA — Universal invariants', () => {
  test('every platform has T_CHAR_ENFORCE', () => {
    const allDNA = getAllDNA();
    for (const dna of Object.values(allDNA)) {
      expect(dna.allowedTransforms).toContain('T_CHAR_ENFORCE');
    }
  });

  test('no platform has rewritesPrompt = true except openai', () => {
    const allDNA = getAllDNA();
    for (const [id, dna] of Object.entries(allDNA)) {
      if (id !== 'openai') {
        expect(dna.processingProfile.rewritesPrompt).toBe(false);
      }
    }
  });

  test('every platform has at least one front-loading or structural transform', () => {
    const allDNA = getAllDNA();
    for (const dna of Object.values(allDNA)) {
      const hasSubjectFront = dna.allowedTransforms.includes('T_SUBJECT_FRONT');
      const hasClauseFront = dna.allowedTransforms.includes('T_CLAUSE_FRONT');
      const hasNarrativeArmour = dna.allowedTransforms.includes('T_NARRATIVE_ARMOUR');
      const hasScenePremise = dna.allowedTransforms.includes('T_SCENE_PREMISE');

      expect(
        hasSubjectFront || hasClauseFront || hasNarrativeArmour || hasScenePremise,
      ).toBe(true);
    }
  });
});
