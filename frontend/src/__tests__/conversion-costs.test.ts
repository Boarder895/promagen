// src/__tests__/conversion-costs.test.ts
import {
  FIDELITY_CONVERSIONS,
  NEGATIVE_CONVERSIONS,
  getConversionCost,
  getAllFidelityConversions,
  isFidelityConversionPlatform,
  getFidelityFamily,
} from '@/lib/prompt-builder/conversion-costs';

describe('Conversion Cost Registry', () => {
  describe('FIDELITY_CONVERSIONS structure', () => {
    it('should have entries for midjourney, flux, recraft, luma-ai', () => {
      expect(FIDELITY_CONVERSIONS).toHaveProperty('midjourney');
      expect(FIDELITY_CONVERSIONS).toHaveProperty('flux');
      expect(FIDELITY_CONVERSIONS).toHaveProperty('recraft');
      expect(FIDELITY_CONVERSIONS).toHaveProperty('luma-ai');
    });

    it('should have 11 MJ fidelity entries', () => {
      expect(Object.keys(FIDELITY_CONVERSIONS['midjourney']!)).toHaveLength(11);
    });

    it('should have all MJ entries as parametric with cost 0', () => {
      for (const entry of Object.values(FIDELITY_CONVERSIONS['midjourney']!)) {
        expect(entry.isParametric).toBe(true);
        expect(entry.cost).toBe(0);
        expect(entry.category).toBe('fidelity');
      }
    });

    it('should have 11 Flux fidelity entries with non-zero costs', () => {
      const fluxEntries = Object.values(FIDELITY_CONVERSIONS['flux']!);
      expect(fluxEntries).toHaveLength(11);
      for (const entry of fluxEntries) {
        expect(entry.isParametric).toBe(false);
        expect(entry.cost).toBeGreaterThan(0);
      }
    });

    it('should have valid costConfidence on all entries', () => {
      for (const familyMap of Object.values(FIDELITY_CONVERSIONS)) {
        for (const entry of Object.values(familyMap)) {
          expect(['exact', 'estimated']).toContain(entry.costConfidence);
        }
      }
    });
  });

  describe('NEGATIVE_CONVERSIONS structure', () => {
    it('should have 44 negative entries', () => {
      expect(Object.keys(NEGATIVE_CONVERSIONS)).toHaveLength(44);
    });

    it('should have all entries as non-parametric', () => {
      for (const entry of Object.values(NEGATIVE_CONVERSIONS)) {
        expect(entry.isParametric).toBe(false);
        expect(entry.cost).toBeGreaterThan(0);
        expect(entry.category).toBe('negative');
      }
    });

    it('should have blurry → sharp focus with cost 2', () => {
      const entry = NEGATIVE_CONVERSIONS['blurry'];
      expect(entry).toBeDefined();
      expect(entry!.output).toBe('sharp focus');
      expect(entry!.cost).toBe(2);
    });
  });

  describe('getConversionCost()', () => {
    it('should return MJ parametric for 8k fidelity', () => {
      const entry = getConversionCost('8k', 'fidelity', 'midjourney');
      expect(entry).not.toBeNull();
      expect(entry!.output).toBe('--quality 2');
      expect(entry!.isParametric).toBe(true);
    });

    it('should return Flux NL clause for 8k fidelity', () => {
      const entry = getConversionCost('8k', 'fidelity', 'flux');
      expect(entry).not.toBeNull();
      expect(entry!.output).toBe('captured with extraordinary clarity');
      expect(entry!.cost).toBe(4);
    });

    it('should return null for unknown terms', () => {
      expect(getConversionCost('xyz', 'fidelity', 'midjourney')).toBeNull();
    });

    it('should return null for non-conversion platforms', () => {
      expect(getConversionCost('8k', 'fidelity', 'stability')).toBeNull();
    });

    it('should return negative conversion on any platform', () => {
      const entry = getConversionCost('blurry', 'negative', 'openai');
      expect(entry).not.toBeNull();
      expect(entry!.output).toBe('sharp focus');
    });

    it('should be case-insensitive', () => {
      expect(getConversionCost('8K', 'fidelity', 'midjourney')).not.toBeNull();
      expect(getConversionCost('Blurry', 'negative', 'openai')).not.toBeNull();
    });
  });

  describe('getAllFidelityConversions()', () => {
    it('should return 11 MJ entries with from field', () => {
      const entries = getAllFidelityConversions('midjourney');
      expect(entries).toHaveLength(11);
      for (const e of entries) { expect(e.from).toBeDefined(); }
    });

    it('should return empty for non-conversion platform', () => {
      expect(getAllFidelityConversions('stability')).toHaveLength(0);
    });
  });

  describe('isFidelityConversionPlatform()', () => {
    it('should identify conversion platforms', () => {
      expect(isFidelityConversionPlatform('midjourney')).toBe(true);
      expect(isFidelityConversionPlatform('flux')).toBe(true);
      expect(isFidelityConversionPlatform('bluewillow')).toBe(true);
    });

    it('should reject non-conversion platforms', () => {
      expect(isFidelityConversionPlatform('stability')).toBe(false);
      expect(isFidelityConversionPlatform('openai')).toBe(false);
    });
  });

  describe('getFidelityFamily()', () => {
    it('should map bluewillow to midjourney', () => {
      expect(getFidelityFamily('bluewillow')).toBe('midjourney');
    });

    it('should return null for non-conversion platform', () => {
      expect(getFidelityFamily('openai')).toBeNull();
    });
  });
});
