// src/__tests__/conversion-assembly-integration.test.ts
import { assemblePrompt } from '@/lib/prompt-builder';
import type { PromptSelections } from '@/types/prompt-builder';

describe('Conversion Assembly Integration', () => {
  describe('Midjourney fidelity → parametric', () => {
    it('should convert fidelity to --quality/--stylize', () => {
      const r = assemblePrompt('midjourney', { subject: ['mountain landscape'], style: ['photorealistic'], fidelity: ['8k', 'masterpiece'] });
      expect(r.positive).toContain('--quality 2');
      expect(r.positive).toContain('--stylize 300');
      expect(r.positive).not.toMatch(/\b8k\b/i);
    });

    it('should include parametric regardless of prompt length', () => {
      const r = assemblePrompt('midjourney', { subject: ['very detailed mountain landscape'], style: ['hyperrealistic photography'], lighting: ['dramatic rim lighting'], fidelity: ['8k', 'masterpiece', 'highly detailed'] });
      expect(r.positive).toContain('--quality 2');
      expect(r.positive).toContain('--stylize 300');
    });

    it('should attach conversion metadata', () => {
      const r = assemblePrompt('midjourney', { subject: ['portrait'], fidelity: ['8k'] });
      expect(r.conversions).toBeDefined();
      expect(r.conversions!.some(c => c.included && c.isParametric)).toBe(true);
    });
  });

  describe('Flux fidelity → NL clauses', () => {
    it('should convert to NL on Flux', () => {
      const r = assemblePrompt('flux', { subject: ['cat'], fidelity: ['8k'] });
      expect(r.positive).toContain('captured with extraordinary clarity');
    });

    it('should not include literal 8k on Flux', () => {
      const r = assemblePrompt('flux', { subject: ['cat'], fidelity: ['8k'] });
      expect(r.positive).not.toMatch(/\b8k\b/i);
    });

    it('should have conversionBudget metadata', () => {
      const r = assemblePrompt('flux', { subject: ['cat'], fidelity: ['8k'] });
      expect(r.conversionBudget).toBeDefined();
      expect(r.conversionBudget!.ceiling).toBe(80);
    });
  });

  describe('DALL-E negative conversions', () => {
    it('should convert negatives to positives', () => {
      const r = assemblePrompt('openai', { subject: ['portrait of a woman'], negative: ['blurry', 'watermark'] });
      expect(r.positive.toLowerCase()).toContain('sharp focus');
    });

    it('should include conversion metadata for negatives', () => {
      const r = assemblePrompt('openai', { subject: ['portrait'], negative: ['blurry'] });
      expect(r.conversions).toBeDefined();
      expect(r.conversions!.some(c => c.category === 'negative')).toBe(true);
    });
  });

  describe('Leonardo (Gap 3: separate negatives)', () => {
    it('should NOT convert negatives on separate-field platforms', () => {
      const r = assemblePrompt('leonardo', { subject: ['landscape'], negative: ['blurry', 'watermark'] });
      expect(r.negative).toBeDefined();
      expect(r.negative!.toLowerCase()).toContain('blurry');
      const negPoolConv = r.conversions?.filter(c => c.category === 'negative') ?? [];
      expect(negPoolConv).toHaveLength(0);
    });
  });

  describe('Non-conversion platforms', () => {
    it('should pass fidelity through on Stability', () => {
      const r = assemblePrompt('stability', { subject: ['cat'], fidelity: ['8k', 'masterpiece'] });
      expect(r.positive.toLowerCase()).toContain('8k');
    });

    it('should not have conversion metadata', () => {
      const r = assemblePrompt('stability', { subject: ['cat'], fidelity: ['8k'] });
      expect(r.conversions).toBeUndefined();
    });
  });

  describe('Kling negative conversion', () => {
    it('should convert negatives (negativeSupport: none)', () => {
      const r = assemblePrompt('kling', { subject: ['portrait'], negative: ['blurry'] });
      expect(r.positive.toLowerCase()).toContain('sharp focus');
    });
  });

  describe('Unknown negatives', () => {
    it('should keep unknown for sub-assembler without handling', () => {
      const r = assemblePrompt('openai', { subject: ['landscape'], negative: ['chromatic aberration'] });
      expect(r.positive.toLowerCase()).toContain('without');
      expect(r.positive.toLowerCase()).toContain('chromatic aberration');
    });
  });

  describe('Empty selections', () => {
    it('should return empty prompt', () => {
      const r = assemblePrompt('flux', {});
      expect(r.positive).toBe('');
      expect(r.conversions).toBeUndefined();
    });

    it('should work with only fidelity', () => {
      const r = assemblePrompt('midjourney', { fidelity: ['8k'] });
      expect(r.positive).toContain('--quality 2');
    });
  });

  describe('Metadata accuracy', () => {
    it('should have correct included+deferred totals', () => {
      const r = assemblePrompt('flux', { subject: ['portrait'], fidelity: ['8k'] });
      if (r.conversions) {
        const inc = r.conversions.filter(c => c.included).length;
        const def = r.conversions.filter(c => !c.included).length;
        expect(inc + def).toBe(r.conversions.length);
      }
    });

    it('should have scores between 0 and 1', () => {
      const r = assemblePrompt('openai', { subject: ['portrait'], style: ['photorealistic'], fidelity: ['8k'], negative: ['blurry'] });
      for (const c of r.conversions ?? []) {
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(1);
      }
    });
  });
});
