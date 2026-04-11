// src/lib/__tests__/call-2-harness-scene-library.test.ts
// ============================================================================
// Tests for the Call 2 Quality Harness Scene Library Loader (Phase B)
// ============================================================================
// Covers: metadata, default load, category filters, holdout filter,
// dev_only filter, ID lookup (hit + miss), counts, dev-only enumeration,
// immutability, lighthouse-keeper canonical fixture content, schema version.
//
// Authority: call-2-harness-build-plan-v1.md Phase B
// Jest project: util (testMatch: src/lib/__tests__/**/*.test.ts)
// ============================================================================

import { describe, it, expect } from '@jest/globals';

import {
  loadScenes,
  loadSceneById,
  getSceneLibraryMetadata,
  getSceneCountsByCategory,
  getDevOnlyScenes,
  type Scene,
  type SceneCategory,
} from '@/lib/call-2-harness/scene-library';

describe('Call 2 Harness — scene-library', () => {
  // ── METADATA ──────────────────────────────────────────────────────────────

  describe('metadata', () => {
    it('reports schema version 1.1.0', () => {
      const meta = getSceneLibraryMetadata();
      expect(meta.schema_version).toBe('1.1.0');
    });

    it('reports a non-empty generated_from path', () => {
      const meta = getSceneLibraryMetadata();
      expect(meta.generated_from.length).toBeGreaterThan(0);
    });

    it('count matches the actual scene array length', () => {
      const meta = getSceneLibraryMetadata();
      const all = loadScenes({ status: undefined });
      expect(all.length).toBe(meta.count);
    });
  });

  // ── LOADING + FILTERING ───────────────────────────────────────────────────

  describe('loadScenes', () => {
    it('returns all 41 approved scenes by default (none are holdout yet)', () => {
      const scenes = loadScenes();
      expect(scenes.length).toBe(41);
      // Default filter is approved-only
      for (const s of scenes) {
        expect(s.status).toBe('approved');
        expect(s.holdout).toBe(false);
      }
    });

    it('filters by category — canonical = 16', () => {
      const scenes = loadScenes({ category: 'canonical' });
      expect(scenes.length).toBe(16);
      for (const s of scenes) expect(s.category).toBe('canonical');
    });

    it('filters by category — stress = 10', () => {
      const scenes = loadScenes({ category: 'stress' });
      expect(scenes.length).toBe(10);
      for (const s of scenes) expect(s.category).toBe('stress');
    });

    it('filters by category — trap = 8', () => {
      const scenes = loadScenes({ category: 'trap' });
      expect(scenes.length).toBe(8);
      for (const s of scenes) expect(s.category).toBe('trap');
    });

    it('filters by category — human_factors = 5', () => {
      const scenes = loadScenes({ category: 'human_factors' });
      expect(scenes.length).toBe(5);
      for (const s of scenes) expect(s.category).toBe('human_factors');
    });

    it('filters by category — alien = 2', () => {
      const scenes = loadScenes({ category: 'alien' });
      expect(scenes.length).toBe(2);
      for (const s of scenes) expect(s.category).toBe('alien');
    });

    it('excludes dev_only scenes when includeDevOnly is false', () => {
      const all = loadScenes();
      const productionSafe = loadScenes({ includeDevOnly: false });
      expect(productionSafe.length).toBe(all.length - 1);
      for (const s of productionSafe) {
        expect(s.dev_only).not.toBe(true);
      }
    });

    it('every returned scene has all required fields populated', () => {
      const scenes = loadScenes();
      for (const s of scenes) {
        expect(s.id.length).toBeGreaterThan(0);
        expect(s.input.length).toBeGreaterThan(0);
        expect(s.concept.length).toBeGreaterThan(0);
        expect(s.exercises_clusters.length).toBeGreaterThan(0);
        expect(s.exercises_rules.length).toBeGreaterThan(0);
        expect(Array.isArray(s.tags)).toBe(true);
        expect(Array.isArray(s.perturbation_seeds)).toBe(true);
      }
    });
  });

  // ── ID LOOKUP ─────────────────────────────────────────────────────────────

  describe('loadSceneById', () => {
    it('returns the lighthouse keeper canonical scene', () => {
      const s = loadSceneById('lighthouse-keeper-canonical');
      expect(s).not.toBeNull();
      expect(s?.category).toBe('canonical');
      expect(s?.status).toBe('approved');
    });

    it('lighthouse keeper input matches the confirmed canonical wording', () => {
      const s = loadSceneById('lighthouse-keeper-canonical');
      expect(s).not.toBeNull();
      expect(s?.input).toContain('A weathered lighthouse keeper');
      expect(s?.input).toContain('rain-soaked gallery deck at twilight');
      expect(s?.input).toContain('purple-and-copper sky');
      expect(s?.input).toContain('Low, cinematic wide-angle view');
    });

    it('returns null for an unknown ID (does not throw)', () => {
      expect(loadSceneById('does-not-exist')).toBeNull();
      expect(loadSceneById('')).toBeNull();
    });
  });

  // ── COUNTS ────────────────────────────────────────────────────────────────

  describe('getSceneCountsByCategory', () => {
    it('returns the expected breakdown for the v1.1.0 library', () => {
      const counts = getSceneCountsByCategory();
      expect(counts.canonical).toBe(16);
      expect(counts.stress).toBe(10);
      expect(counts.trap).toBe(8);
      expect(counts.human_factors).toBe(5);
      expect(counts.alien).toBe(2);
      expect(counts.real_world).toBe(0);
    });

    it('totals to 40', () => {
      const counts = getSceneCountsByCategory();
      const total = (Object.values(counts) as number[]).reduce(
        (a, b) => a + b,
        0,
      );
      expect(total).toBe(41);
    });
  });

  // ── DEV-ONLY ENUMERATION ──────────────────────────────────────────────────

  describe('getDevOnlyScenes', () => {
    it('returns exactly the scenes whose input exceeds production cap', () => {
      const devOnly = getDevOnlyScenes();
      expect(devOnly.length).toBe(1);
      expect(devOnly[0]?.id).toBe('stress-dense-400-words');
      expect(devOnly[0]?.dev_only).toBe(true);
      expect(devOnly[0]?.input.length).toBeGreaterThan(1000);
    });
  });

  // ── IMMUTABILITY ──────────────────────────────────────────────────────────

  describe('immutability', () => {
    it('loaded scenes are frozen — mutation is rejected in strict mode', () => {
      const [first] = loadScenes();
      expect(first).toBeDefined();
      expect(Object.isFrozen(first)).toBe(true);
    });

    it('scene tag arrays are frozen', () => {
      const s = loadSceneById('lighthouse-keeper-canonical');
      expect(s).not.toBeNull();
      expect(Object.isFrozen(s?.tags)).toBe(true);
      expect(Object.isFrozen(s?.exercises_clusters)).toBe(true);
    });
  });

  // ── DATA INTEGRITY (the harness has no soul if these break) ──────────────

  describe('data integrity', () => {
    it('all scene IDs are unique', () => {
      const scenes = loadScenes({ status: undefined });
      const ids = new Set(scenes.map((s) => s.id));
      expect(ids.size).toBe(scenes.length);
    });

    it('all categories are recognised', () => {
      const valid: ReadonlySet<SceneCategory> = new Set<SceneCategory>([
        'canonical',
        'stress',
        'trap',
        'human_factors',
        'alien',
        'real_world',
      ]);
      const scenes: readonly Scene[] = loadScenes({ status: undefined });
      for (const s of scenes) {
        expect(valid.has(s.category)).toBe(true);
      }
    });

    it('every dev_only scene has a dev_only_reason', () => {
      const devOnly = getDevOnlyScenes();
      for (const s of devOnly) {
        expect(s.dev_only_reason).toBeDefined();
        expect(s.dev_only_reason!.length).toBeGreaterThan(0);
      }
    });
  });
});
