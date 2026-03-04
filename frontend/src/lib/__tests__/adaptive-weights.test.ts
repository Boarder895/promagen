// src/lib/__tests__/adaptive-weights.test.ts
// ============================================================================
// ADAPTIVE WEIGHT CALIBRATION — Extra 4 Tests
// ============================================================================

import {
  densityMultiplier,
  calibrateWeight,
  calibrateWeights,
  analyseWeightBudget,
  PLATFORM_BUDGETS,
} from '../weather/adaptive-weights';
import type { WeatherCategoryMap, WeatherCategoryMeta } from '@/types/prompt-builder';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeMap(overrides: Partial<WeatherCategoryMap> = {}): WeatherCategoryMap {
  const meta: WeatherCategoryMeta = {
    city: 'Tokyo',
    venue: 'Shibuya Crossing',
    venueSetting: 'street',
    mood: 'nocturnal',
    conditions: 'clear sky',
    emoji: '🌙',
    tempC: 18,
    localTime: '22:00',
    source: 'weather-intelligence',
  };

  return {
    selections: {
      subject: ['Tokyo'],
      environment: ['Shibuya Crossing'],
      lighting: ['moonlight'],
    },
    customValues: {
      lighting: 'Cool white moonlight over neon-lit streets',
    },
    negative: ['blurry', 'watermarks'],
    weightOverrides: {
      subject: 1.3,
      environment: 1.2,
      lighting: 1.3,
    },
    meta,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Adaptive Weight Calibration', () => {
  describe('densityMultiplier', () => {
    it('returns 1.0 for a single category', () => {
      expect(densityMultiplier(1)).toBe(1);
    });

    it('returns lower values for more categories', () => {
      const m1 = densityMultiplier(1);
      const m5 = densityMultiplier(5);
      const m10 = densityMultiplier(10);

      expect(m5).toBeLessThan(m1);
      expect(m10).toBeLessThan(m5);
    });

    it('never goes below 0.5', () => {
      expect(densityMultiplier(12)).toBeGreaterThanOrEqual(0.5);
    });

    it('clamps to valid range', () => {
      expect(densityMultiplier(0)).toBe(densityMultiplier(1));
      expect(densityMultiplier(20)).toBe(densityMultiplier(12));
    });

    it('returns monotonically decreasing values', () => {
      for (let i = 1; i < 12; i++) {
        expect(densityMultiplier(i)).toBeGreaterThanOrEqual(densityMultiplier(i + 1));
      }
    });
  });

  describe('calibrateWeight', () => {
    it('preserves weight of 1.0 (no emphasis)', () => {
      expect(calibrateWeight(1.0, 10, 1.0)).toBe(1.0);
    });

    it('scales emphasis down with lower multiplier', () => {
      const full = calibrateWeight(1.3, 10, 1.0);
      const reduced = calibrateWeight(1.3, 10, 0.5);

      expect(reduced).toBeLessThan(full);
    });

    it('gives more emphasis to higher importance categories', () => {
      const high = calibrateWeight(1.3, 10, 0.8);
      const low = calibrateWeight(1.3, 2, 0.8);

      expect(high).toBeGreaterThan(low);
    });

    it('never returns below 1.0', () => {
      expect(calibrateWeight(1.3, 0, 0.1)).toBeGreaterThanOrEqual(1.0);
    });

    it('handles weights already at 1.0', () => {
      expect(calibrateWeight(1.0, 5, 0.5)).toBe(1.0);
    });

    it('handles weights below 1.0', () => {
      expect(calibrateWeight(0.8, 5, 0.5)).toBe(0.8);
    });
  });

  describe('calibrateWeights', () => {
    it('returns unchanged map for non-weight platforms', () => {
      const map = makeMap();
      const result = calibrateWeights(map, 'midjourney');

      expect(result.weightOverrides).toEqual(map.weightOverrides);
    });

    it('returns unchanged map for unknown platforms', () => {
      const map = makeMap();
      const result = calibrateWeights(map, 'nonexistent');

      expect(result.weightOverrides).toEqual(map.weightOverrides);
    });

    it('adjusts weights for CLIP platform', () => {
      const map = makeMap();
      const result = calibrateWeights(map, 'clip');

      // Weights should be adjusted but still maintain hierarchy
      expect(result.weightOverrides?.subject).toBeDefined();
      expect(result.weightOverrides?.lighting).toBeDefined();
    });

    it('subject weight stays higher than less important categories', () => {
      const map = makeMap({
        selections: {
          subject: ['Tokyo'],
          environment: ['Shibuya'],
          lighting: ['moonlight'],
          atmosphere: ['nocturnal'],
          style: ['photorealistic'],
          colour: ['cool tones'],
          fidelity: ['sharp'],
        },
        weightOverrides: {
          subject: 1.3,
          environment: 1.2,
          lighting: 1.3,
        },
      });
      const result = calibrateWeights(map, 'clip');

      // Subject (importance 10) should get more emphasis than colour (importance 4)
      const subjectW = result.weightOverrides?.subject ?? 1.0;
      const colourW = result.weightOverrides?.colour ?? 1.0;
      expect(subjectW).toBeGreaterThanOrEqual(colourW);
    });

    it('produces lower weights with many categories than with few', () => {
      const fewCats = makeMap({
        selections: { subject: ['Tokyo'], lighting: ['moonlight'] },
        weightOverrides: { subject: 1.3, lighting: 1.3 },
      });
      const manyCats = makeMap({
        selections: {
          subject: ['Tokyo'],
          environment: ['Shibuya'],
          lighting: ['moonlight'],
          atmosphere: ['nocturnal'],
          style: ['photorealistic'],
          colour: ['cool tones'],
          fidelity: ['sharp'],
          camera: ['35mm'],
        },
        customValues: {
          materials: 'Wet cobblestones',
          action: 'Wind gusting',
        },
        weightOverrides: { subject: 1.3, lighting: 1.3 },
      });

      const fewResult = calibrateWeights(fewCats, 'clip');
      const manyResult = calibrateWeights(manyCats, 'clip');

      const fewSubject = fewResult.weightOverrides?.subject ?? 1.0;
      const manySubject = manyResult.weightOverrides?.subject ?? 1.0;

      expect(fewSubject).toBeGreaterThanOrEqual(manySubject);
    });

    it('assigns default weights to populated categories without explicit overrides', () => {
      const map = makeMap({
        selections: {
          subject: ['Tokyo'],
          environment: ['Shibuya'],
          lighting: ['moonlight'],
          atmosphere: ['nocturnal'],
        },
        weightOverrides: { subject: 1.3 },
      });
      const result = calibrateWeights(map, 'clip');

      // atmosphere should get an auto-assigned weight
      expect(result.weightOverrides?.atmosphere).toBeDefined();
      expect(result.weightOverrides?.atmosphere).toBeGreaterThanOrEqual(1.0);
    });

    it('does not assign weights to negative category', () => {
      const map = makeMap();
      const result = calibrateWeights(map, 'clip');

      expect(result.weightOverrides?.negative).toBeUndefined();
    });

    it('preserves all non-weight fields', () => {
      const map = makeMap();
      const result = calibrateWeights(map, 'clip');

      expect(result.selections).toEqual(map.selections);
      expect(result.customValues).toEqual(map.customValues);
      expect(result.negative).toEqual(map.negative);
      expect(result.meta).toEqual(map.meta);
    });
  });

  describe('PLATFORM_BUDGETS', () => {
    it('defines budgets for key platforms', () => {
      expect(PLATFORM_BUDGETS.clip).toBeDefined();
      expect(PLATFORM_BUDGETS.flux).toBeDefined();
      expect(PLATFORM_BUDGETS.midjourney).toBeDefined();
      expect(PLATFORM_BUDGETS.natural).toBeDefined();
      expect(PLATFORM_BUDGETS.plain).toBeDefined();
    });

    it('only CLIP supports weights', () => {
      expect(PLATFORM_BUDGETS.clip!.supportsWeights).toBe(true);
      expect(PLATFORM_BUDGETS.flux!.supportsWeights).toBe(false);
      expect(PLATFORM_BUDGETS.midjourney!.supportsWeights).toBe(false);
    });
  });

  describe('analyseWeightBudget', () => {
    it('returns zero emphasis for unweighted map', () => {
      const map = makeMap({ weightOverrides: {} });
      const analysis = analyseWeightBudget(map);

      expect(analysis.totalEmphasis).toBe(0);
      expect(analysis.emphasizedCount).toBe(0);
      expect(analysis.topCategory).toBeNull();
    });

    it('correctly computes total emphasis above 1.0', () => {
      const map = makeMap({
        weightOverrides: {
          subject: 1.3,
          environment: 1.2,
          lighting: 1.3,
        },
      });
      const analysis = analyseWeightBudget(map);

      // 0.3 + 0.2 + 0.3 = 0.8
      expect(analysis.totalEmphasis).toBe(0.8);
      expect(analysis.emphasizedCount).toBe(3);
    });

    it('identifies top category', () => {
      const map = makeMap({
        weightOverrides: {
          subject: 1.3,
          environment: 1.2,
          lighting: 1.5,
        },
      });
      const analysis = analyseWeightBudget(map);

      expect(analysis.topCategory).toBe('lighting');
    });

    it('counts populated categories', () => {
      const map = makeMap({
        selections: {
          subject: ['Tokyo'],
          environment: ['Shibuya'],
          lighting: ['moonlight'],
        },
        customValues: {
          materials: 'Wet stones',
        },
      });
      const analysis = analyseWeightBudget(map);

      expect(analysis.populatedCount).toBe(4);
    });

    it('includes density multiplier', () => {
      const map = makeMap();
      const analysis = analyseWeightBudget(map);

      expect(analysis.densityMultiplier).toBeGreaterThan(0);
      expect(analysis.densityMultiplier).toBeLessThanOrEqual(1);
    });
  });
});
