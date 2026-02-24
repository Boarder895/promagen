/**
 * Cascading Intelligence Verification — Phase 1.8
 * =================================================
 * 12 automated tests verifying Parts 1.1–1.7.
 *
 * Run:  pnpm vitest run src/__tests__/cascading-intelligence.integrity.test.ts
 *
 * @version 1.0.0
 * @created 2026-02-25
 */

import {
  getSemanticTag,
  getSemanticTags,
  getSemanticClusters,
  getClustersForTerm,
  computeActiveClusters,
  getDirectAffinities,
  getAffinityForTerm,
  computeAffinityScore,
  buildContext,
  reorderByRelevance,
} from '@/lib/prompt-intelligence';

import type { PromptCategory } from '@/types/prompt-builder';

// ============================================================================
// T1: Semantic tags populated
// ============================================================================

describe('Phase 1 — Cascading Intelligence', () => {
  describe('T1: Semantic tags populated', () => {
    it('getSemanticTag() returns non-undefined for ≥400 terms', () => {
      const tags = getSemanticTags();
      const count = Object.keys(tags.options).length;
      expect(count).toBeGreaterThanOrEqual(400);
    });

    it('tags have required fields', () => {
      const tags = getSemanticTags();
      const sample = Object.values(tags.options).slice(0, 20);
      for (const tag of sample) {
        expect(tag.category).toBeDefined();
        expect(tag.families).toBeDefined();
        expect(Array.isArray(tag.families)).toBe(true);
      }
    });
  });

  // ============================================================================
  // T2: Cluster terms exist in vocabulary tags
  // ============================================================================

  describe('T2: Cluster integrity', () => {
    it('has ≥40 clusters', () => {
      const clusters = getSemanticClusters();
      const count = Object.keys(clusters.clusters).length;
      expect(count).toBeGreaterThanOrEqual(40);
    });

    it('each cluster spans ≥4 categories', () => {
      const clusters = getSemanticClusters();
      for (const [id, cluster] of Object.entries(clusters.clusters)) {
        const categoryCount = Object.keys(cluster.terms).length;
        expect(categoryCount).toBeGreaterThanOrEqual(4);
      }
    });
  });

  // ============================================================================
  // T3: Affinity integrity
  // ============================================================================

  describe('T3: Affinity integrity', () => {
    it('has ≥200 affinities', () => {
      const affinities = getDirectAffinities();
      expect(affinities.affinities.length).toBeGreaterThanOrEqual(200);
    });

    it('no self-referencing affinities', () => {
      const affinities = getDirectAffinities();
      for (const aff of affinities.affinities) {
        const termLower = aff.term.toLowerCase();
        const boostsLower = aff.boosts.map(b => b.toLowerCase());
        const penalisesLower = (aff.penalises ?? []).map(p => p.toLowerCase());
        expect(boostsLower).not.toContain(termLower);
        expect(penalisesLower).not.toContain(termLower);
      }
    });

    it('each affinity has 2–8 boosts', () => {
      const affinities = getDirectAffinities();
      for (const aff of affinities.affinities) {
        expect(aff.boosts.length).toBeGreaterThanOrEqual(2);
        expect(aff.boosts.length).toBeLessThanOrEqual(8);
      }
    });
  });

  // ============================================================================
  // T4: Cluster lookup index works
  // ============================================================================

  describe('T4: Cluster lookup', () => {
    it('getClustersForTerm returns clusters for known terms', () => {
      // "neon glow" should be in at least the cyberpunk cluster
      const clusters = getClustersForTerm('neon glow');
      expect(clusters.length).toBeGreaterThan(0);
      expect(clusters).toContain('cyberpunk');
    });

    it('getClustersForTerm returns empty for unknown terms', () => {
      const clusters = getClustersForTerm('xyzzy_nonexistent_term');
      expect(clusters).toEqual([]);
    });
  });

  // ============================================================================
  // T5: Affinity lookup index works
  // ============================================================================

  describe('T5: Affinity lookup', () => {
    it('getAffinityForTerm returns data for "golden hour"', () => {
      const aff = getAffinityForTerm('golden hour');
      expect(aff).toBeDefined();
      expect(aff!.boosts.has('warm tones')).toBe(true);
    });

    it('getAffinityForTerm returns undefined for unaffinitied terms', () => {
      const aff = getAffinityForTerm('xyzzy_nonexistent_term');
      expect(aff).toBeUndefined();
    });
  });

  // ============================================================================
  // T6: Active cluster computation
  // ============================================================================

  describe('T6: Active clusters', () => {
    it('computes active clusters from selected terms', () => {
      const active = computeActiveClusters(['neon glow', 'cyberpunk city']);
      expect(active.size).toBeGreaterThan(0);
      expect(active.has('cyberpunk')).toBe(true);
    });

    it('returns empty set for no selections', () => {
      const active = computeActiveClusters([]);
      expect(active.size).toBe(0);
    });
  });

  // ============================================================================
  // T7: Score differentiation — cyberpunk scenario
  // ============================================================================

  describe('T7: Score differentiation', () => {
    it('"neon glow" scores higher than "dappled light" after selecting "cyberpunk hacker"', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        subject: ['cyberpunk hacker'],
      };

      const neonScored = reorderByRelevance(
        ['neon glow', 'dappled light'],
        'lighting',
        selections,
      );

      // neon glow should be first (higher score)
      expect(neonScored[0]?.option).toBe('neon glow');
      expect(neonScored[0]!.score).toBeGreaterThan(neonScored[1]!.score);
    });
  });

  // ============================================================================
  // T8: Cluster boost activates
  // ============================================================================

  describe('T8: Cluster boost', () => {
    it('two cyberpunk terms boost a third cyberpunk cluster member', () => {
      // Select two cyberpunk-cluster terms
      const selectionsWithContext: Partial<Record<PromptCategory, string[]>> = {
        subject: ['cyberpunk hacker'],
        lighting: ['neon glow'],
      };
      const selectionsWithout: Partial<Record<PromptCategory, string[]>> = {};

      const withContext = reorderByRelevance(
        ['chrome reflection'],
        'materials',
        selectionsWithContext,
      );
      const withoutContext = reorderByRelevance(
        ['chrome reflection'],
        'materials',
        selectionsWithout,
      );

      // chrome reflection should score higher with cyberpunk context
      expect(withContext[0]!.score).toBeGreaterThan(withoutContext[0]!.score);
    });
  });

  // ============================================================================
  // T9: Affinity boost activates
  // ============================================================================

  describe('T9: Affinity boost', () => {
    it('"warm tones" is boosted when "golden hour" is selected', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        lighting: ['golden hour'],
      };

      const scored = reorderByRelevance(
        ['warm tones', 'neon colours'],
        'colour',
        selections,
      );

      // warm tones should score higher (boosted by golden hour affinity)
      expect(scored[0]?.option).toBe('warm tones');
    });
  });

  // ============================================================================
  // T10: Affinity penalty activates
  // ============================================================================

  describe('T10: Affinity penalty', () => {
    it('"neon glow" is penalised when "golden hour" is selected', () => {
      const score = computeAffinityScore('neon glow', ['golden hour']);
      expect(score).toBeLessThan(0);
    });
  });

  // ============================================================================
  // T11: Tier multiplier applies
  // ============================================================================

  describe('T11: Tier multiplier', () => {
    it('same selection scores differently on tier 1 vs tier 4', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        subject: ['cyberpunk hacker'],
        lighting: ['neon glow'],
      };

      const tier1 = reorderByRelevance(
        ['chrome reflection', 'wood grain'],
        'materials',
        selections,
        false,
        null,
        1, // CLIP tier
      );

      const tier4 = reorderByRelevance(
        ['chrome reflection', 'wood grain'],
        'materials',
        selections,
        false,
        null,
        4, // Plain tier
      );

      // Tier 1 should amplify scoring (more spread), tier 4 should dampen
      const tier1Spread = Math.abs(tier1[0]!.score - tier1[1]!.score);
      const tier4Spread = Math.abs(tier4[0]!.score - tier4[1]!.score);

      // Tier 1 CLIP amplifies cluster (1.2×), tier 4 dampens (0.5×)
      // So tier 1 spread should be ≥ tier 4 spread
      expect(tier1Spread).toBeGreaterThanOrEqual(tier4Spread);
    });
  });

  // ============================================================================
  // T12: buildContext populates activeClusters and tier
  // ============================================================================

  describe('T12: buildContext integration', () => {
    it('buildContext returns activeClusters and tier', () => {
      const context = buildContext({
        selections: { subject: ['cyberpunk hacker'] },
        tier: 2,
      });

      expect(context.activeClusters).toBeDefined();
      expect(context.activeClusters.size).toBeGreaterThan(0);
      expect(context.tier).toBe(2);
    });

    it('buildContext defaults tier to null', () => {
      const context = buildContext({
        selections: {},
      });

      expect(context.tier).toBeNull();
      expect(context.activeClusters.size).toBe(0);
    });
  });
});
