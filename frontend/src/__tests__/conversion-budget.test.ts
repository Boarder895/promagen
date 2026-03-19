// src/__tests__/conversion-budget.test.ts
import {
  getConversionBudget,
  getStaticCeiling,
  countWords,
  countWordsInArray,
  getClipTokenCeiling,
} from '@/lib/prompt-builder/conversion-budget';

describe('Conversion Budget Calculator', () => {
  describe('getConversionBudget()', () => {
    it('should calculate remaining = ceiling - core - prefix - suffix', () => {
      const b = getConversionBudget(20, 3, 2, 'flux');
      expect(b.ceiling).toBe(80);
      expect(b.consumed).toBe(25);
      expect(b.remaining).toBe(55);
      expect(b.unit).toBe('words');
      expect(b.source).toBe('static');
    });

    it('should floor remaining at 0', () => {
      const b = getConversionBudget(100, 5, 5, 'midjourney');
      expect(b.remaining).toBe(0);
    });

    it('should use correct static ceilings', () => {
      expect(getConversionBudget(0, 0, 0, 'midjourney').ceiling).toBe(30);
      expect(getConversionBudget(0, 0, 0, 'flux').ceiling).toBe(80);
      expect(getConversionBudget(0, 0, 0, 'openai').ceiling).toBe(160);
      expect(getConversionBudget(0, 0, 0, 'canva').ceiling).toBe(30);
      expect(getConversionBudget(0, 0, 0, 'luma-ai').ceiling).toBe(231);
    });

    it('should default to 60 for unknown platforms', () => {
      expect(getConversionBudget(10, 0, 0, 'unknown-xyz').ceiling).toBe(60);
    });

    it('should include prefix + suffix in budget (Gap 2)', () => {
      const b = getConversionBudget(50, 5, 3, 'flux');
      expect(b.consumed).toBe(58);
      expect(b.remaining).toBe(22);
    });

    it('should return null diminishingReturnsAt without learned data', () => {
      expect(getConversionBudget(20, 0, 0, 'flux').diminishingReturnsAt).toBeNull();
    });

    it('should return null clipTokenBudget for non-Tier-1', () => {
      expect(getConversionBudget(20, 0, 0, 'flux').clipTokenBudget).toBeNull();
    });

    it('should return null clipTokenBudget when no tokens provided', () => {
      expect(getConversionBudget(20, 0, 0, 'stability', null, null).clipTokenBudget).toBeNull();
    });

    it('should compute CLIP budget for Tier 1 with tokens', () => {
      const b = getConversionBudget(20, 0, 0, 'stability', null, 50);
      expect(b.clipTokenBudget).not.toBeNull();
      expect(b.clipTokenBudget!.ceiling).toBe(77);
      expect(b.clipTokenBudget!.consumed).toBe(50);
      expect(b.clipTokenBudget!.remaining).toBe(27);
    });

    it('should floor CLIP remaining at 0', () => {
      const b = getConversionBudget(20, 0, 0, 'stability', null, 100);
      expect(b.clipTokenBudget!.remaining).toBe(0);
    });
  });

  describe('getStaticCeiling()', () => {
    it('should return correct values', () => {
      expect(getStaticCeiling('midjourney')).toBe(30);
      expect(getStaticCeiling('flux')).toBe(80);
      expect(getStaticCeiling('tensor-art')).toBe(58);
      expect(getStaticCeiling('leonardo')).toBe(154);
    });

    it('should return 60 for unknown', () => {
      expect(getStaticCeiling('nonexistent')).toBe(60);
    });
  });

  describe('getClipTokenCeiling()', () => {
    it('should return 77 for standard CLIP', () => {
      expect(getClipTokenCeiling('stability')).toBe(77);
    });

    it('should return 75 for tensor-art', () => {
      expect(getClipTokenCeiling('tensor-art')).toBe(75);
    });

    it('should return null for non-Tier-1', () => {
      expect(getClipTokenCeiling('midjourney')).toBeNull();
      expect(getClipTokenCeiling('flux')).toBeNull();
    });
  });

  describe('countWords()', () => {
    it('should count words', () => {
      expect(countWords('hello world')).toBe(2);
      expect(countWords('')).toBe(0);
    });
  });

  describe('countWordsInArray()', () => {
    it('should sum across array', () => {
      expect(countWordsInArray(['hello world', 'foo bar baz'])).toBe(5);
    });

    it('should return 0 for empty', () => {
      expect(countWordsInArray(undefined)).toBe(0);
      expect(countWordsInArray([])).toBe(0);
    });
  });
});
