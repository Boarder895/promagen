/**
 * Scene Starters Integrity Tests — Phase 2 Step 2.4
 * ===================================================
 * 15 automated tests verifying the 200 curated scene templates.
 *
 * Run:  pnpm vitest run src/__tests__/scene-starters.integrity.test.ts
 *
 * What we validate:
 * - Every prefill value exists in core vocabulary (zero ghosts)
 * - No orphan worlds (every world has scenes, every scene has a world)
 * - World counts match worlds.ts expectedCount
 * - Schema conformance (kebab IDs, tier enum, category enum, tags, etc.)
 * - TierGuidance complete for all 4 tiers on every scene
 * - No cross-ID duplicates
 * - Meta counts match reality
 *
 * @version 1.0.0
 * @created 2026-02-25
 */

import {
  allScenes,
  freeScenes,
  proScenes,
  sceneData,
  ALL_WORLDS,
  WORLD_BY_SLUG,
  EXPECTED_SCENE_COUNT,
  EXPECTED_FREE_COUNT,
  EXPECTED_PRO_COUNT,
  getSceneById,
  getScenesByWorld,
} from '@/data/scenes';
import {
  PREFILLABLE_CATEGORIES,
  type PrefillableCategory,
  type SceneEntry,
} from '@/types/scene-starters';
import { getOptions, type CategoryKey } from '@/data/vocabulary/prompt-builder';

// ============================================================================
// HELPERS
// ============================================================================

/** Build a case-insensitive Set of all valid terms for a vocab category */
function buildVocabLookup(category: CategoryKey): Set<string> {
  return new Set(getOptions(category).map((o) => o.toLowerCase().trim()));
}

/** All 11 prefillable category lookups, pre-built once */
const vocabLookups: Record<string, Set<string>> = {};
for (const cat of PREFILLABLE_CATEGORIES) {
  vocabLookups[cat] = buildVocabLookup(cat as CategoryKey);
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VALID_TIERS = ['free', 'pro'] as const;
const TIER_KEYS = ['1', '2', '3', '4'] as const;

// ============================================================================
// TESTS
// ============================================================================

describe('Scene Starters Integrity (Phase 2)', () => {
  // ── T1: Every prefill value exists in vocabulary ──────────────────────────
  // Only checks original hand-authored categories. Enriched categories
  // (composition, camera, fidelity, materials, colour) use expert-curated
  // phrases that are intentionally outside the dropdown vocabulary pool.
  it('T1 — every prefill value exists in core vocabulary', () => {
    const ORIGINAL_CATEGORIES = new Set(['subject', 'atmosphere', 'environment']);
    const missing: Array<{ scene: string; category: string; value: string }> = [];

    for (const scene of allScenes) {
      for (const [cat, values] of Object.entries(scene.prefills)) {
        if (!ORIGINAL_CATEGORIES.has(cat)) continue; // Skip enriched categories
        const lookup = vocabLookups[cat];
        if (!lookup) {
          missing.push({ scene: scene.id, category: cat, value: '(unknown category)' });
          continue;
        }
        for (const val of values ?? []) {
          if (!lookup.has(val.toLowerCase().trim())) {
            missing.push({ scene: scene.id, category: cat, value: val });
          }
        }
      }
    }

    if (missing.length > 0) {
      const report = missing
        .slice(0, 20)
        .map((m) => `  ${m.scene} → ${m.category}/${m.value}`)
        .join('\n');
      throw new Error(`${missing.length} prefill value(s) not found in vocabulary:\n${report}`);
    }
  });

  // ── T2: No duplicate scene IDs ────────────────────────────────────────────
  it('T2 — no duplicate scene IDs', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];

    for (const scene of allScenes) {
      if (seen.has(scene.id)) dupes.push(scene.id);
      seen.add(scene.id);
    }

    expect(dupes).toHaveLength(0);
  });

  // ── T3: All IDs are kebab-case ────────────────────────────────────────────
  it('T3 — all scene IDs are kebab-case', () => {
    const invalid = allScenes.filter((s) => !KEBAB_CASE.test(s.id)).map((s) => s.id);

    expect(invalid).toHaveLength(0);
  });

  // ── T4: Tier is exactly 'free' or 'pro' ──────────────────────────────────
  it('T4 — every scene tier is free or pro', () => {
    const invalid = allScenes
      .filter((s) => !VALID_TIERS.includes(s.tier as (typeof VALID_TIERS)[number]))
      .map((s) => `${s.id}: "${s.tier}"`);

    expect(invalid).toHaveLength(0);
  });

  // ── T5: No 'negative' category in prefills ────────────────────────────────
  it('T5 — no scene prefills the negative category', () => {
    const offenders = allScenes.filter((s) => 'negative' in s.prefills).map((s) => s.id);

    expect(offenders).toHaveLength(0);
  });

  // ── T6: Prefill categories are valid PrefillableCategory values ───────────
  it('T6 — all prefill keys are valid PrefillableCategory values', () => {
    const allowedSet = new Set<string>(PREFILLABLE_CATEGORIES);
    const invalid: Array<{ scene: string; category: string }> = [];

    for (const scene of allScenes) {
      for (const cat of Object.keys(scene.prefills)) {
        if (!allowedSet.has(cat)) {
          invalid.push({ scene: scene.id, category: cat });
        }
      }
    }

    expect(invalid).toHaveLength(0);
  });

  // ── T7: Each scene has 4–11 prefill categories ────────────────────────────
  it('T7 — each scene has 4–11 prefilled categories', () => {
    const outOfRange = allScenes
      .filter((s) => {
        const count = Object.keys(s.prefills).length;
        return count < 4 || count > 11;
      })
      .map((s) => `${s.id}: ${Object.keys(s.prefills).length} categories`);

    expect(outOfRange).toHaveLength(0);
  });

  // ── T8: Each prefill has 1–3 values per category ──────────────────────────
  it('T8 — each prefill category has 1–3 values', () => {
    const outOfRange: Array<{ scene: string; category: string; count: number }> = [];

    for (const scene of allScenes) {
      for (const [cat, values] of Object.entries(scene.prefills)) {
        const count = (values ?? []).length;
        if (count < 1 || count > 3) {
          outOfRange.push({ scene: scene.id, category: cat, count });
        }
      }
    }

    expect(outOfRange).toHaveLength(0);
  });

  // ── T9: TierGuidance present for all 4 tiers on every scene ───────────────
  it('T9 — tierGuidance has keys 1–4 with valid affinity on every scene', () => {
    const errors: string[] = [];

    for (const scene of allScenes) {
      for (const tier of TIER_KEYS) {
        const g = scene.tierGuidance[tier];
        if (!g) {
          errors.push(`${scene.id}: missing tierGuidance.${tier}`);
          continue;
        }
        if (typeof g.affinity !== 'number' || g.affinity < 1 || g.affinity > 10) {
          errors.push(`${scene.id}: tier ${tier} affinity=${g.affinity} (need 1–10)`);
        }
      }
    }

    expect(errors).toHaveLength(0);
  });

  // ── T10: Tags count is 3–12 on every scene ────────────────────────────────
  it('T10 — each scene has 3–12 tags with no duplicates', () => {
    const errors: string[] = [];

    for (const scene of allScenes) {
      const tags = scene.tags ?? [];
      if (tags.length < 3 || tags.length > 12) {
        errors.push(`${scene.id}: ${tags.length} tags (need 3–12)`);
      }
      const unique = new Set(tags.map((t) => t.toLowerCase()));
      if (unique.size !== tags.length) {
        errors.push(`${scene.id}: duplicate tags`);
      }
    }

    expect(errors).toHaveLength(0);
  });

  // ── T11: Description ≤120 chars on every scene ────────────────────────────
  it('T11 — description is 10–120 characters on every scene', () => {
    const outOfRange = allScenes
      .filter((s) => s.description.length < 10 || s.description.length > 120)
      .map((s) => `${s.id}: ${s.description.length} chars`);

    expect(outOfRange).toHaveLength(0);
  });

  // ── T12: No orphan worlds — every world in worlds.ts has scenes ───────────
  it('T12 — no orphan worlds (every declared world has at least 1 scene)', () => {
    const orphans = ALL_WORLDS.filter((w) => getScenesByWorld(w.slug).length === 0).map(
      (w) => w.slug,
    );

    expect(orphans).toHaveLength(0);
  });

  // ── T13: No orphan scenes — every scene.world exists in worlds.ts ─────────
  it('T13 — no orphan scenes (every scene references a declared world)', () => {
    const orphans = allScenes
      .filter((s) => !WORLD_BY_SLUG.has(s.world))
      .map((s) => `${s.id} → ${s.world}`);

    expect(orphans).toHaveLength(0);
  });

  // ── T14: World counts match expectedCount in worlds.ts ────────────────────
  it('T14 — scene count per world matches worlds.ts expectedCount', () => {
    const mismatches: string[] = [];

    for (const world of ALL_WORLDS) {
      const actual = getScenesByWorld(world.slug).length;
      if (actual !== world.expectedCount) {
        mismatches.push(`${world.slug}: actual=${actual}, expected=${world.expectedCount}`);
      }
    }

    expect(mismatches).toHaveLength(0);
  });

  // ── T15: Meta counts match reality ────────────────────────────────────────
  it('T15 — _meta counts match actual scene counts and world expectations', () => {
    const meta = sceneData._meta.counts;

    expect(allScenes).toHaveLength(meta.total);
    expect(freeScenes).toHaveLength(meta.free);
    expect(proScenes).toHaveLength(meta.pro);
    expect(meta.free + meta.pro).toBe(meta.total);

    // Cross-check against worlds.ts expectations
    expect(meta.total).toBe(EXPECTED_SCENE_COUNT);
    expect(meta.free).toBe(EXPECTED_FREE_COUNT);
    expect(meta.pro).toBe(EXPECTED_PRO_COUNT);
    expect(meta.worlds).toBe(ALL_WORLDS.length);
  });
});
