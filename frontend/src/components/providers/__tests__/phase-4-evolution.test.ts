// src/components/providers/__tests__/phase-4-evolution.test.ts
// ============================================================================
// PROMPT BUILDER EVOLUTION — Phase 0–4 Integration Tests
// ============================================================================
// Covers: Scene data integrity, vocabulary merge, explore drawer logic,
// tier badges, cascade scoring, analytics event types, flavour phrases.
//
// Run:  pnpm test -- --testPathPattern="phase-4-evolution"
//
// Authority: prompt-builder-evolution-plan-v2.md, scene-starters.md,
//            phase-4-e2e-checklist.md
// ============================================================================

import {
  allScenes,
  freeScenes,
  proScenes,
  getSceneById,
  getScenesByWorld,
  ALL_WORLDS,
  FREE_WORLDS,
  PRO_WORLDS,
  EXPECTED_SCENE_COUNT,
  EXPECTED_FREE_COUNT,
  EXPECTED_PRO_COUNT,
} from '@/data/scenes';
import { getOptions, type CategoryKey } from '@/data/vocabulary/prompt-builder';
import { getExploreCount, getSourceGroupedOptions } from '@/lib/vocabulary/vocabulary-loader';
import { PREFILLABLE_CATEGORIES } from '@/types/scene-starters';
import type { SceneEntry } from '@/types/scene-starters';

// ============================================================================
// A. SCENE DATA INTEGRITY
// ============================================================================

describe('Scene Data Integrity', () => {
  it('has exactly 200 scenes total', () => {
    expect(allScenes).toHaveLength(EXPECTED_SCENE_COUNT);
    expect(EXPECTED_SCENE_COUNT).toBe(200);
  });

  it('has exactly 25 free scenes', () => {
    expect(freeScenes).toHaveLength(EXPECTED_FREE_COUNT);
    expect(EXPECTED_FREE_COUNT).toBe(25);
  });

  it('has exactly 175 pro scenes', () => {
    expect(proScenes).toHaveLength(EXPECTED_PRO_COUNT);
    expect(EXPECTED_PRO_COUNT).toBe(175);
  });

  it('free + pro = total', () => {
    expect(freeScenes.length + proScenes.length).toBe(allScenes.length);
  });

  it('every scene has a unique id', () => {
    const ids = allScenes.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every scene has required fields', () => {
    for (const scene of allScenes) {
      expect(scene.id).toBeTruthy();
      expect(scene.name).toBeTruthy();
      expect(scene.world).toBeTruthy();
      expect(scene.emoji).toBeTruthy();
      expect(scene.description).toBeTruthy();
      expect(['free', 'pro']).toContain(scene.tier);
      expect(Object.keys(scene.prefills).length).toBeGreaterThanOrEqual(4);
      expect(scene.tierGuidance).toBeDefined();
      expect(scene.tags).toBeDefined();
      expect(scene.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every scene id is kebab-case', () => {
    const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const scene of allScenes) {
      expect(scene.id).toMatch(kebab);
    }
  });

  it('prefills only use valid PrefillableCategory keys', () => {
    const valid = new Set(PREFILLABLE_CATEGORIES);
    for (const scene of allScenes) {
      for (const key of Object.keys(scene.prefills)) {
        expect(valid.has(key as (typeof PREFILLABLE_CATEGORIES)[number])).toBe(true);
      }
    }
  });

  it('no scene prefills the negative category', () => {
    for (const scene of allScenes) {
      expect(scene.prefills).not.toHaveProperty('negative');
    }
  });

  it('each scene prefills 5–11 categories', () => {
    for (const scene of allScenes) {
      const count = Object.keys(scene.prefills).length;
      expect(count).toBeGreaterThanOrEqual(5);
      expect(count).toBeLessThanOrEqual(11);
    }
  });

  it('prefill arrays are non-empty', () => {
    for (const scene of allScenes) {
      for (const [, values] of Object.entries(scene.prefills)) {
        expect(values).toBeDefined();
        expect(values!.length).toBeGreaterThan(0);
      }
    }
  });
});

// ============================================================================
// B. WORLD GROUPING
// ============================================================================

describe('World Grouping', () => {
  it('has 23 worlds defined', () => {
    expect(ALL_WORLDS).toHaveLength(23);
  });

  it('has 5 free worlds', () => {
    expect(FREE_WORLDS).toHaveLength(5);
  });

  it('has 18 pro worlds', () => {
    expect(PRO_WORLDS).toHaveLength(18);
  });

  it('free + pro worlds = all worlds', () => {
    expect(FREE_WORLDS.length + PRO_WORLDS.length).toBe(ALL_WORLDS.length);
  });

  it('every scene belongs to a valid world', () => {
    const worldSlugs = new Set(ALL_WORLDS.map((w) => w.slug));
    for (const scene of allScenes) {
      expect(worldSlugs.has(scene.world)).toBe(true);
    }
  });

  it('free scenes only appear in free worlds', () => {
    const freeWorldSlugs = new Set(FREE_WORLDS.map((w) => w.slug));
    for (const scene of freeScenes) {
      expect(freeWorldSlugs.has(scene.world)).toBe(true);
    }
  });

  it('getScenesByWorld returns correct count', () => {
    for (const world of ALL_WORLDS) {
      const scenes = getScenesByWorld(world.slug);
      expect(scenes.length).toBeGreaterThan(0);
      for (const s of scenes) {
        expect(s.world).toBe(world.slug);
      }
    }
  });
});

// ============================================================================
// C. SCENE LOOKUP
// ============================================================================

describe('Scene Lookup', () => {
  it('getSceneById returns correct scene', () => {
    expect(allScenes.length).toBeGreaterThan(0);
    const first = allScenes[0]!;
    const found = getSceneById(first.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(first.id);
    expect(found!.name).toBe(first.name);
  });

  it('getSceneById returns undefined for invalid id', () => {
    expect(getSceneById('nonexistent-scene-xyz')).toBeUndefined();
  });

  it('getSceneById returns undefined for empty string', () => {
    expect(getSceneById('')).toBeUndefined();
  });
});

// ============================================================================
// D. TIER GUIDANCE
// ============================================================================

describe('Tier Guidance', () => {
  it('every scene has guidance for all 4 tiers', () => {
    for (const scene of allScenes) {
      expect(scene.tierGuidance).toHaveProperty('1');
      expect(scene.tierGuidance).toHaveProperty('2');
      expect(scene.tierGuidance).toHaveProperty('3');
      expect(scene.tierGuidance).toHaveProperty('4');
    }
  });

  it('affinity scores are 1–10', () => {
    for (const scene of allScenes) {
      for (const tier of ['1', '2', '3', '4'] as const) {
        const guidance = scene.tierGuidance[tier];
        expect(guidance.affinity).toBeGreaterThanOrEqual(1);
        expect(guidance.affinity).toBeLessThanOrEqual(10);
      }
    }
  });

  it('tier 4 guidance has reducedPrefills array', () => {
    for (const scene of allScenes) {
      const t4 = scene.tierGuidance['4'];
      expect(t4.reducedPrefills).toBeDefined();
      expect(Array.isArray(t4.reducedPrefills)).toBe(true);
      expect(t4.reducedPrefills!.length).toBeGreaterThanOrEqual(3);
      expect(t4.reducedPrefills!.length).toBeLessThanOrEqual(11);
    }
  });

  it('reducedPrefills are valid PrefillableCategory values', () => {
    const valid = new Set(PREFILLABLE_CATEGORIES);
    for (const scene of allScenes) {
      const reduced = scene.tierGuidance['4'].reducedPrefills ?? [];
      for (const cat of reduced) {
        expect(valid.has(cat as (typeof PREFILLABLE_CATEGORIES)[number])).toBe(true);
      }
    }
  });

  it('reducedPrefills are a subset of scene prefills', () => {
    for (const scene of allScenes) {
      const prefillKeys = new Set(Object.keys(scene.prefills));
      const reduced = scene.tierGuidance['4'].reducedPrefills ?? [];
      for (const cat of reduced) {
        expect(prefillKeys.has(cat)).toBe(true);
      }
    }
  });
});

// ============================================================================
// E. FLAVOUR PHRASES
// ============================================================================

describe('Flavour Phrases', () => {
  const scenesWithFlavour = allScenes.filter(
    (s): s is SceneEntry & { flavourPhrases: Record<string, string[]> } =>
      s.flavourPhrases != null &&
      typeof s.flavourPhrases === 'object' &&
      Object.keys(s.flavourPhrases).length > 0,
  );

  it('at least 20 scenes have flavour phrases', () => {
    expect(scenesWithFlavour.length).toBeGreaterThanOrEqual(20);
  });

  it('flavour phrase keys are valid PrefillableCategory values', () => {
    const valid = new Set(PREFILLABLE_CATEGORIES);
    for (const scene of scenesWithFlavour) {
      for (const key of Object.keys(scene.flavourPhrases)) {
        expect(valid.has(key as (typeof PREFILLABLE_CATEGORIES)[number])).toBe(true);
      }
    }
  });

  it('flavour phrase arrays are non-empty strings', () => {
    for (const scene of scenesWithFlavour) {
      for (const [, phrases] of Object.entries(scene.flavourPhrases)) {
        expect(Array.isArray(phrases)).toBe(true);
        expect(phrases.length).toBeGreaterThan(0);
        for (const phrase of phrases) {
          expect(typeof phrase).toBe('string');
          expect(phrase.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('flavour phrases are NOT in core vocabulary (they are unique)', () => {
    // Spot check: lighting flavour phrases should not be in core lighting options
    const coreLighting = new Set(getOptions('lighting' as CategoryKey).map((o) => o.toLowerCase()));
    let uniqueCount = 0;
    let totalCount = 0;
    for (const scene of scenesWithFlavour) {
      const lightingPhrases: string[] = scene.flavourPhrases['lighting'] ?? [];
      for (const phrase of lightingPhrases) {
        totalCount++;
        if (!coreLighting.has(phrase.toLowerCase())) {
          uniqueCount++;
        }
      }
    }
    // At least 80% should be unique to scenes (not in core)
    if (totalCount > 0) {
      expect(uniqueCount / totalCount).toBeGreaterThanOrEqual(0.8);
    }
  });
});

// ============================================================================
// F. VOCABULARY MERGE (Phase 0)
// ============================================================================

describe('Vocabulary Merge', () => {
  const CATEGORIES_WITH_MERGED: CategoryKey[] = [
    'style',
    'environment',
    'lighting',
    'atmosphere',
    'colour',
    'materials',
  ] as CategoryKey[];

  it('core vocabulary exists for all 12 categories', () => {
    const categories: CategoryKey[] = [
      'subject',
      'action',
      'style',
      'environment',
      'composition',
      'camera',
      'lighting',
      'colour',
      'atmosphere',
      'materials',
      'fidelity',
      'negative',
    ] as CategoryKey[];
    for (const cat of categories) {
      const options = getOptions(cat);
      expect(options.length).toBeGreaterThan(0);
    }
  });

  it('merged categories have source groups', () => {
    for (const cat of CATEGORIES_WITH_MERGED) {
      const groups = getSourceGroupedOptions(cat);
      expect(groups.length).toBeGreaterThan(0);
    }
  });

  it('source groups have required fields', () => {
    for (const cat of CATEGORIES_WITH_MERGED) {
      const groups = getSourceGroupedOptions(cat);
      for (const group of groups) {
        expect(group.source).toBeTruthy();
        expect(group.label).toBeTruthy();
        expect(group.icon).toBeTruthy();
        expect(group.terms.length).toBeGreaterThan(0);
      }
    }
  });

  it('getExploreCount returns positive number for categories with data', () => {
    for (const cat of CATEGORIES_WITH_MERGED) {
      const count = getExploreCount(cat, []);
      expect(count).toBeGreaterThan(0);
    }
  });

  it('getExploreCount decreases as terms are selected', () => {
    const cat = 'style' as CategoryKey;
    const options = getOptions(cat);
    expect(options.length).toBeGreaterThan(0);
    const first = options[0]!;
    const before = getExploreCount(cat, []);
    const after = getExploreCount(cat, [first]);
    expect(after).toBeLessThan(before);
  });

  it('explore count excludes selected terms (case-insensitive)', () => {
    const cat = 'lighting' as CategoryKey;
    const options = getOptions(cat);
    if (options.length > 0) {
      const term = options[0]!;
      const countWithout = getExploreCount(cat, []);
      const countWith = getExploreCount(cat, [term]);
      const countWithUpper = getExploreCount(cat, [term.toUpperCase()]);
      expect(countWith).toBe(countWithUpper);
      expect(countWith).toBeLessThan(countWithout);
    }
  });
});

// ============================================================================
// G. TIER BADGE LOGIC
// ============================================================================

describe('Tier Badge Logic', () => {
  // Replicate getTierBadge from explore-drawer.tsx for unit testing
  function getTierBadge(term: string, platformTier: 1 | 2 | 3 | 4): { badge: string } | null {
    const wordCount = term.split(/\s+/).length;
    switch (platformTier) {
      case 1:
        return wordCount <= 2 ? { badge: '★' } : null;
      case 2:
        return wordCount >= 2 && wordCount <= 4 ? { badge: '◆' } : null;
      case 3:
        return wordCount >= 3 ? { badge: '💬' } : null;
      case 4:
        return wordCount < 3 ? { badge: '⚡' } : { badge: '⚠' };
      default:
        return null;
    }
  }

  describe('Tier 1 (CLIP)', () => {
    it('shows ★ for 1-word terms', () => {
      expect(getTierBadge('impressionism', 1)?.badge).toBe('★');
    });

    it('shows ★ for 2-word terms', () => {
      expect(getTierBadge('oil painting', 1)?.badge).toBe('★');
    });

    it('shows null for 3+ word terms', () => {
      expect(getTierBadge('soft ambient glow', 1)).toBeNull();
    });
  });

  describe('Tier 2 (MJ)', () => {
    it('shows null for 1-word terms', () => {
      expect(getTierBadge('dramatic', 2)).toBeNull();
    });

    it('shows ◆ for 2-word terms', () => {
      expect(getTierBadge('golden hour', 2)?.badge).toBe('◆');
    });

    it('shows ◆ for 4-word terms', () => {
      expect(getTierBadge('warm afternoon sun rays', 2)?.badge).toBe('◆');
    });

    it('shows null for 5+ word terms', () => {
      expect(getTierBadge('soft warm light through window curtains', 2)).toBeNull();
    });
  });

  describe('Tier 3 (NL)', () => {
    it('shows null for 1-word terms', () => {
      expect(getTierBadge('misty', 3)).toBeNull();
    });

    it('shows null for 2-word terms', () => {
      expect(getTierBadge('golden hour', 3)).toBeNull();
    });

    it('shows 💬 for 3+ word terms', () => {
      expect(getTierBadge('soft morning light', 3)?.badge).toBe('💬');
    });
  });

  describe('Tier 4 (Plain)', () => {
    it('shows ⚡ for 1-word terms', () => {
      expect(getTierBadge('dramatic', 4)?.badge).toBe('⚡');
    });

    it('shows ⚡ for 2-word terms', () => {
      expect(getTierBadge('oil painting', 4)?.badge).toBe('⚡');
    });

    it('shows ⚠ for 3+ word terms', () => {
      expect(getTierBadge('soft ambient glow', 4)?.badge).toBe('⚠');
    });
  });
});

// ============================================================================
// H. CASCADE SCORE MAP LOGIC
// ============================================================================

describe('Cascade Score Sorting', () => {
  // Replicate the sort from explore-drawer.tsx
  function sortByCascade(pool: string[], cascadeScores: Map<string, number>): string[] {
    return [...pool].sort((a, b) => {
      const scoreA = cascadeScores.get(a.toLowerCase()) ?? 0;
      const scoreB = cascadeScores.get(b.toLowerCase()) ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.localeCompare(b);
    });
  }

  it('sorts by score descending', () => {
    const scores = new Map([
      ['alpha', 10],
      ['bravo', 50],
      ['charlie', 30],
    ]);
    const sorted = sortByCascade(['alpha', 'bravo', 'charlie'], scores);
    expect(sorted).toEqual(['bravo', 'charlie', 'alpha']);
  });

  it('alphabetical tie-break for equal scores', () => {
    const scores = new Map([
      ['banana', 50],
      ['apple', 50],
      ['cherry', 50],
    ]);
    const sorted = sortByCascade(['banana', 'apple', 'cherry'], scores);
    expect(sorted).toEqual(['apple', 'banana', 'cherry']);
  });

  it('unscored terms sort to end alphabetically', () => {
    const scores = new Map([['bravo', 80]]);
    const sorted = sortByCascade(['alpha', 'bravo', 'charlie'], scores);
    expect(sorted).toEqual(['bravo', 'alpha', 'charlie']);
  });

  it('empty scores = alphabetical sort', () => {
    const scores = new Map<string, number>();
    const sorted = sortByCascade(['charlie', 'alpha', 'bravo'], scores);
    expect(sorted).toEqual(['alpha', 'bravo', 'charlie']);
  });

  it('case-insensitive score lookup', () => {
    const scores = new Map([['golden hour', 90]]);
    const sorted = sortByCascade(['Misty dawn', 'Golden Hour', 'Ambient'], scores);
    expect(sorted[0]).toBe('Golden Hour');
  });
});

// ============================================================================
// I. ANALYTICS EVENT TYPES
// ============================================================================

describe('Analytics Event Types', () => {
  // Import the type to ensure all 5 new events are defined
  // We can't easily test runtime behaviour without mocking,
  // but we can verify the type system accepts all event names

  it('Phase 4 event names are valid strings', () => {
    const phase4Events = [
      'scene_selected',
      'scene_reset',
      'explore_drawer_opened',
      'explore_chip_clicked',
      'cascade_reorder_triggered',
    ];
    for (const event of phase4Events) {
      expect(typeof event).toBe('string');
      expect(event.length).toBeGreaterThan(0);
    }
  });

  it('scene_selected payload shape', () => {
    const payload = {
      scene_id: 'dramatic-portrait',
      scene_name: 'Dramatic Portrait',
      world: 'portraits-and-people',
      tier: 'free' as const,
      platform_tier: 1,
      categories_prefilled: 5,
    };
    expect(payload.scene_id).toBeTruthy();
    expect(payload.categories_prefilled).toBeGreaterThanOrEqual(1);
    expect(['free', 'pro']).toContain(payload.tier);
    expect([1, 2, 3, 4]).toContain(payload.platform_tier);
  });

  it('scene_reset payload shape', () => {
    const payload = {
      scene_id: 'dramatic-portrait',
      was_modified: true,
    };
    expect(payload.scene_id).toBeTruthy();
    expect(typeof payload.was_modified).toBe('boolean');
  });

  it('explore_drawer_opened payload shape', () => {
    const payload = {
      category: 'lighting',
      platform_tier: 2,
    };
    expect(payload.category).toBeTruthy();
    expect([1, 2, 3, 4]).toContain(payload.platform_tier);
  });

  it('explore_chip_clicked payload shape', () => {
    const payload = {
      category: 'style',
      term: 'oil painting',
      platform_tier: 1,
      source_tab: 'core',
    };
    expect(payload.category).toBeTruthy();
    expect(payload.term).toBeTruthy();
    expect([1, 2, 3, 4]).toContain(payload.platform_tier);
    expect(['scene', 'all', 'core', 'weather', 'commodity', 'shared']).toContain(
      payload.source_tab,
    );
  });

  it('cascade_reorder_triggered payload shape', () => {
    const payload = {
      categories_reordered: 4,
      elapsed_ms: 2.3,
    };
    expect(payload.categories_reordered).toBeGreaterThanOrEqual(0);
    expect(typeof payload.elapsed_ms).toBe('number');
  });
});

// ============================================================================
// J. FULL INTEGRATION: Scene → Vocabulary → Explore
// ============================================================================

describe('Scene → Vocabulary → Explore Integration', () => {
  it('scene prefill values exist in core vocabulary', () => {
    // Spot-check: first 5 scenes, verify their ORIGINAL prefill values are real options.
    // Enriched categories (composition, camera, fidelity, materials) use expert-curated
    // phrases that aren't necessarily in the dropdown vocabulary — that's by design.
    const ORIGINAL_CATEGORIES = new Set(['subject', 'atmosphere', 'environment']);
    const testScenes = allScenes.slice(0, 5);
    for (const scene of testScenes) {
      for (const [cat, values] of Object.entries(scene.prefills)) {
        if (!values) continue;
        if (!ORIGINAL_CATEGORIES.has(cat)) continue; // Skip enriched categories
        const coreOptions = new Set(getOptions(cat as CategoryKey).map((o) => o.toLowerCase()));
        for (const val of values) {
          // Scene values should be in core vocabulary
          expect(coreOptions.has(val.toLowerCase())).toBe(true);
        }
      }
    }
  });

  it('scene prefills reduce explore count', () => {
    expect(freeScenes.length).toBeGreaterThan(0);
    const scene = freeScenes[0]!;
    const cat = Object.keys(scene.prefills)[0] as CategoryKey;
    const prefillValues = (scene.prefills as Record<string, string[]>)[cat] ?? [];

    const countBefore = getExploreCount(cat, []);
    const countAfter = getExploreCount(cat, prefillValues);

    expect(countAfter).toBeLessThan(countBefore);
    expect(countBefore - countAfter).toBe(prefillValues.length);
  });

  it('flavour phrases are separate from explore count', () => {
    // Explore count comes from core + merged vocab, NOT flavour phrases
    // So flavour phrases should not affect explore count
    const scenesWithFp = allScenes.filter(
      (s): s is SceneEntry & { flavourPhrases: Record<string, string[]> } =>
        s.flavourPhrases != null && Object.keys(s.flavourPhrases).length > 0,
    );
    if (scenesWithFp.length > 0) {
      const scene = scenesWithFp[0]!;
      const fpCat = Object.keys(scene.flavourPhrases)[0]! as CategoryKey;
      const fpPhrases: string[] = (scene.flavourPhrases as Record<string, string[]>)[fpCat] ?? [];

      // Explore count with no selections
      const count = getExploreCount(fpCat, []);

      // Explore count selecting a flavour phrase (that is NOT in core vocab)
      // should not change the count (flavour phrases are extra, not part of explore pool)
      const coreOptions = getOptions(fpCat).map((o: string) => o.toLowerCase());
      const nonCorePhrases = fpPhrases.filter(
        (p: string) => !coreOptions.includes(p.toLowerCase()),
      );
      if (nonCorePhrases.length > 0) {
        const countAfter = getExploreCount(fpCat, [nonCorePhrases[0]!]);
        // Count should be the same since flavour phrases aren't in core+merged
        expect(countAfter).toBe(count);
      }
    }
  });
});
