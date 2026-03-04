// src/lib/__tests__/category-synergy.test.ts
// ============================================================================
// CATEGORY SYNERGY MATRIX — Extra 3 Tests
// ============================================================================

import {
  analyseSynergy,
  hasConflicts,
  getStrongestSynergy,
  SYNERGY_RULES,
  type SynergyRule,
} from '../weather/category-synergy';
import type { PromptCategory } from '@/types/prompt-builder';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeSelections(
  map: Record<string, string[]>,
): Partial<Record<PromptCategory, string[]>> {
  return map as Partial<Record<PromptCategory, string[]>>;
}

function makeCustom(
  map: Record<string, string>,
): Partial<Record<PromptCategory, string>> {
  return map as Partial<Record<PromptCategory, string>>;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Category Synergy Matrix', () => {
  describe('rule database', () => {
    it('contains at least 15 curated rules', () => {
      expect(SYNERGY_RULES.length).toBeGreaterThanOrEqual(15);
    });

    it('every rule has valid categories', () => {
      const validCats = new Set([
        'subject', 'environment', 'lighting', 'atmosphere',
        'style', 'colour', 'action', 'materials', 'camera',
        'fidelity', 'composition', 'negative',
      ]);
      for (const rule of SYNERGY_RULES) {
        expect(validCats.has(rule.catA)).toBe(true);
        expect(validCats.has(rule.catB)).toBe(true);
      }
    });

    it('every rule has non-empty term arrays', () => {
      for (const rule of SYNERGY_RULES) {
        expect(rule.termsA.length).toBeGreaterThan(0);
        expect(rule.termsB.length).toBeGreaterThan(0);
      }
    });

    it('strengths are within [-1, 1] range', () => {
      for (const rule of SYNERGY_RULES) {
        expect(rule.strength).toBeGreaterThanOrEqual(-1);
        expect(rule.strength).toBeLessThanOrEqual(1);
      }
    });

    it('has both positive and negative rules', () => {
      const positive = SYNERGY_RULES.filter((r) => r.strength > 0);
      const negative = SYNERGY_RULES.filter((r) => r.strength < 0);
      expect(positive.length).toBeGreaterThan(0);
      expect(negative.length).toBeGreaterThan(0);
    });
  });

  describe('analyseSynergy', () => {
    it('returns empty report for empty selections', () => {
      const report = analyseSynergy({}, {});

      expect(report.score).toBe(0);
      expect(report.reinforcements).toHaveLength(0);
      expect(report.conflicts).toHaveLength(0);
    });

    it('detects moonlight + nocturnal reinforcement', () => {
      const sel = makeSelections({
        lighting: ['moonlight glow'],
        atmosphere: ['nocturnal stillness'],
      });
      const report = analyseSynergy(sel, {});

      expect(report.reinforcements.length).toBeGreaterThan(0);
      expect(report.score).toBeGreaterThan(0);
    });

    it('detects golden hour + midnight conflict', () => {
      const sel = makeSelections({
        lighting: ['golden hour glow'],
        atmosphere: ['deep night silence'],
      });
      const report = analyseSynergy(sel, {});

      expect(report.conflicts.length).toBeGreaterThan(0);
      expect(report.score).toBeLessThan(0);
    });

    it('detects warm lighting + warm tones colour reinforcement', () => {
      const sel = makeSelections({
        lighting: ['warm golden hour light'],
        colour: ['warm tones'],
      });
      const report = analyseSynergy(sel, {});

      expect(report.reinforcements.length).toBeGreaterThan(0);
    });

    it('detects wet materials + rain atmosphere reinforcement', () => {
      const custom = makeCustom({
        materials: 'Rain-slicked cobblestones reflecting warm lamplight',
        atmosphere: 'gentle drizzle curtain, cool rain mist',
      });
      const report = analyseSynergy({}, custom);

      expect(report.reinforcements.length).toBeGreaterThan(0);
    });

    it('detects wet surfaces + dry desert conflict', () => {
      const custom = makeCustom({
        materials: 'Wet cobblestones with puddles',
      });
      const sel = makeSelections({
        atmosphere: ['dry desert clarity'],
      });
      const report = analyseSynergy(sel, custom);

      expect(report.conflicts.length).toBeGreaterThan(0);
    });

    it('score is clamped to [-1, 1]', () => {
      // Even with many matching rules, score stays bounded
      const sel = makeSelections({
        lighting: ['golden hour warm sunset glow'],
        atmosphere: ['warm humid tropical heat shimmer'],
        colour: ['warm tones earth tones amber'],
        materials: ['wet rain-slicked damp'],
        action: ['gentle light breeze calm'],
      });
      const report = analyseSynergy(sel, {});

      expect(report.score).toBeGreaterThanOrEqual(-1);
      expect(report.score).toBeLessThanOrEqual(1);
    });

    it('tracks participating categories', () => {
      const sel = makeSelections({
        lighting: ['moonlight'],
        atmosphere: ['nocturnal'],
      });
      const report = analyseSynergy(sel, {});

      expect(report.synergyParticipation).toBeGreaterThan(0);
    });

    it('accepts custom rules', () => {
      const customRules: SynergyRule[] = [
        {
          catA: 'subject',
          catB: 'environment',
          termsA: ['tokyo'],
          termsB: ['shibuya'],
          strength: 0.9,
          reason: 'Tokyo + Shibuya is iconic',
        },
      ];
      const sel = makeSelections({
        subject: ['Tokyo'],
        environment: ['Shibuya Crossing'],
      });
      const report = analyseSynergy(sel, {}, customRules);

      expect(report.reinforcements).toHaveLength(1);
      expect(report.reinforcements[0]?.matchedTermA).toBe('tokyo');
    });

    it('matches are case-insensitive', () => {
      const sel = makeSelections({
        lighting: ['MOONLIGHT'],
        atmosphere: ['NOCTURNAL scene'],
      });
      const report = analyseSynergy(sel, {});

      expect(report.reinforcements.length).toBeGreaterThan(0);
    });

    it('combines selections and customValues for matching', () => {
      const sel = makeSelections({ lighting: ['overcast'] });
      const custom = makeCustom({
        colour: 'cool tones with muted blue palette',
      });
      const report = analyseSynergy(sel, custom);

      expect(report.reinforcements.length).toBeGreaterThan(0);
    });
  });

  describe('hasConflicts', () => {
    it('returns false for compatible combinations', () => {
      const sel = makeSelections({
        lighting: ['moonlight'],
        atmosphere: ['nocturnal'],
      });
      expect(hasConflicts(sel, {})).toBe(false);
    });

    it('returns true for conflicting combinations', () => {
      const sel = makeSelections({
        lighting: ['golden hour'],
        atmosphere: ['deep night darkness'],
      });
      expect(hasConflicts(sel, {})).toBe(true);
    });
  });

  describe('getStrongestSynergy', () => {
    it('returns null for empty map', () => {
      expect(getStrongestSynergy({}, {})).toBeNull();
    });

    it('returns the strongest match', () => {
      const sel = makeSelections({
        lighting: ['golden hour sunset'],
        atmosphere: ['deep night midnight'],
        colour: ['warm tones'],
      });
      const strongest = getStrongestSynergy(sel, {});

      expect(strongest).not.toBeNull();
      // The conflict (-0.9) should be stronger than the warm colour match (+0.7)
      expect(strongest!.rule.strength).toBeLessThan(0);
    });
  });
});
