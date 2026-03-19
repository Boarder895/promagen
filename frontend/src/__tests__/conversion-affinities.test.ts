// src/__tests__/conversion-affinities.test.ts
import {
  COLD_START_AFFINITIES,
  getColdStartAffinity,
  getAverageAffinity,
  getWeightedAverageAffinity,
  blendAffinity,
  hasAffinityData,
  LEARNED_OVERRIDE_THRESHOLD,
} from '@/lib/prompt-builder/conversion-affinities';

describe('Cold-Start Affinity Map', () => {
  describe('COLD_START_AFFINITIES coverage', () => {
    it('should cover all 11 fidelity NL outputs', () => {
      const outputs = [
        'captured with extraordinary clarity', 'high-resolution detail',
        'museum-quality composition', 'professional-grade photograph',
        'fine-grained detail in every surface',
        'hyper-detailed rendering with crystalline clarity',
        'crisp high-resolution output', 'tack-sharp focus throughout',
        'intricate surface textures visible', 'meticulously rendered fine details',
        'delicate fine details preserved',
      ];
      for (const o of outputs) { expect(COLD_START_AFFINITIES).toHaveProperty(o); }
    });

    it('should have all scores between 0 and 1', () => {
      for (const pairs of Object.values(COLD_START_AFFINITIES)) {
        for (const entry of Object.values(pairs)) {
          expect(entry.score).toBeGreaterThanOrEqual(0);
          expect(entry.score).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('getColdStartAffinity()', () => {
    it('should return high for sharp focus + macro', () => {
      const s = getColdStartAffinity('sharp focus', 'macro photography');
      expect(s).not.toBeNull();
      expect(s!).toBeGreaterThanOrEqual(0.9);
    });

    it('should return low for sharp focus + dreamy', () => {
      const s = getColdStartAffinity('sharp focus', 'dreamy');
      expect(s).not.toBeNull();
      expect(s!).toBeLessThanOrEqual(0.2);
    });

    it('should return null for unknown output', () => {
      expect(getColdStartAffinity('xyz', 'photorealistic')).toBeNull();
    });

    it('should inherit from tack-sharp to sharp focus', () => {
      const s = getColdStartAffinity('tack-sharp focus throughout', 'macro photography');
      expect(s).not.toBeNull();
      expect(s!).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('getAverageAffinity()', () => {
    it('should return 0.5 for empty', () => {
      expect(getAverageAffinity('sharp focus', [])).toBe(0.5);
    });

    it('should average matched pairs', () => {
      const avg = getAverageAffinity('sharp focus', ['macro photography', 'photorealistic']);
      expect(avg).toBeGreaterThan(0.8);
    });
  });

  describe('getWeightedAverageAffinity()', () => {
    it('should return 0.5 for empty', () => {
      expect(getWeightedAverageAffinity('sharp focus', [])).toBe(0.5);
    });

    it('should produce valid weighted result', () => {
      const tagged = [
        { term: 'photorealistic', category: 'style' as const },
        { term: 'marble texture', category: 'materials' as const },
      ];
      const w = getWeightedAverageAffinity('sharp focus', tagged);
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(1);
    });
  });

  describe('blendAffinity()', () => {
    it('should return cold-start at confidence 0', () => {
      expect(blendAffinity(0.8, 0.3, 0)).toBe(0.8);
    });

    it('should return learned at threshold', () => {
      expect(blendAffinity(0.8, 0.3, LEARNED_OVERRIDE_THRESHOLD)).toBe(0.3);
    });

    it('should blend below threshold', () => {
      expect(blendAffinity(0.8, 0.4, 0.15)).toBeCloseTo(0.74, 2);
    });
  });

  describe('hasAffinityData()', () => {
    it('should find direct entries', () => { expect(hasAffinityData('sharp focus')).toBe(true); });
    it('should find inherited', () => { expect(hasAffinityData('tack-sharp focus throughout')).toBe(true); });
    it('should miss parametric', () => { expect(hasAffinityData('--quality 2')).toBe(false); });
  });
});
