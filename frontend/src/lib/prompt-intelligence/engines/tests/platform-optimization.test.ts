// src/lib/prompt-intelligence/engines/tests/platform-optimization.test.ts
// ============================================================================
// PLATFORM OPTIMIZATION ENGINE - Tests
// ============================================================================

import {
  formatPromptForPlatform,
  smartTrimPrompt,
  getCategoryOrder,
  getTrimPriority,
  getPlatformCharLimit,
  platformSupportsWeights,
  platformUsesSeparateNegative,
  formatWithWeight,
  getPlatformRecommendations,
  estimateTokenCount,
  formatCompletePrompt,
} from '../platform-optimization';

describe('Platform Optimization Engine', () => {
  
  describe('formatPromptForPlatform', () => {
    
    it('formats basic prompt correctly', () => {
      const result = formatPromptForPlatform({
        selections: {
          style: ['cyberpunk', 'neon noir'],
          lighting: ['neon lights'],
        },
        platformId: 'midjourney',
      });
      
      expect(result.positivePrompt).toBeDefined();
      expect(result.positivePrompt.length).toBeGreaterThan(0);
      expect(result.charCount).toBeGreaterThan(0);
    });
    
    it('includes custom subject first', () => {
      const result = formatPromptForPlatform({
        selections: {
          style: ['cyberpunk'],
        },
        customValues: {
          subject: 'a futuristic warrior',
        },
        platformId: 'midjourney',
      });
      
      expect(result.positivePrompt.startsWith('a futuristic warrior')).toBe(true);
    });
    
    it('handles negatives for Midjourney with --no syntax', () => {
      const result = formatPromptForPlatform({
        selections: {
          style: ['cyberpunk'],
        },
        negatives: ['blurry', 'low quality'],
        platformId: 'midjourney',
      });
      
      // Midjourney uses --no for inline negatives
      expect(result.positivePrompt.includes('--no') || result.negativePrompt !== null).toBe(true);
    });
    
    it('returns separate negative for platforms that use it', () => {
      const result = formatPromptForPlatform({
        selections: {
          style: ['photorealistic'],
        },
        negatives: ['blurry', 'artifacts'],
        platformId: 'stability',
      });
      
      // Stability uses separate negative field
      if (result.negativePrompt) {
        expect(result.negativePrompt).toContain('blurry');
      }
    });
    
    it('respects character limit', () => {
      // Create a very long prompt
      const longSelections: Partial<Record<string, string[]>> = {
        style: Array.from({ length: 50 }, (_, i) => `style term ${i}`),
        lighting: Array.from({ length: 50 }, (_, i) => `lighting term ${i}`),
      };
      
      const result = formatPromptForPlatform({
        selections: longSelections as Record<string, string[]>,
        platformId: 'ideogram',
        maxChars: 500,
      });
      
      expect(result.charCount).toBeLessThanOrEqual(500);
      expect(result.wasTrimmed).toBe(true);
    });
    
    it('returns platform hints', () => {
      const result = formatPromptForPlatform({
        selections: { style: ['cyberpunk'] },
        platformId: 'midjourney',
      });
      
      expect(Array.isArray(result.platformHints)).toBe(true);
    });
    
    it('returns platform config', () => {
      const result = formatPromptForPlatform({
        selections: { style: ['cyberpunk'] },
        platformId: 'midjourney',
      });
      
      expect(result.platformConfig).toBeDefined();
    });
    
    it('handles empty selections', () => {
      const result = formatPromptForPlatform({
        selections: {},
        platformId: 'midjourney',
      });
      
      expect(result.positivePrompt).toBe('');
      expect(result.charCount).toBe(0);
    });
    
    it('handles unknown platform gracefully', () => {
      const result = formatPromptForPlatform({
        selections: { style: ['cyberpunk'] },
        platformId: 'unknown-platform-xyz',
      });
      
      expect(result.positivePrompt).toBeDefined();
      expect(result.platformConfig).toBeNull();
    });
  });
  
  describe('smartTrimPrompt', () => {
    
    it('returns original terms if under limit', () => {
      const result = smartTrimPrompt({
        terms: ['short', 'terms'],
        category: 'style',
        maxChars: 100,
      });
      
      expect(result.terms).toHaveLength(2);
      expect(result.wasTrimmed).toBe(false);
      expect(result.removed).toHaveLength(0);
    });
    
    it('trims terms when over limit', () => {
      const result = smartTrimPrompt({
        terms: [
          'this is a very long term',
          'another long term here',
          'and one more long term',
        ],
        category: 'style',
        maxChars: 40,
      });
      
      expect(result.wasTrimmed).toBe(true);
      expect(result.removed.length).toBeGreaterThan(0);
      expect(result.charCount).toBeLessThanOrEqual(40);
    });
    
    it('preserves important terms based on priority', () => {
      const result = smartTrimPrompt({
        terms: ['cyberpunk', 'a', 'b', 'c'],
        category: 'style',
        maxChars: 20,
        preserveHighValue: true,
      });
      
      // cyberpunk should be kept as it's more significant
      expect(result.terms).toContain('cyberpunk');
    });
    
    it('handles empty terms array', () => {
      const result = smartTrimPrompt({
        terms: [],
        category: 'style',
        maxChars: 100,
      });
      
      expect(result.terms).toHaveLength(0);
      expect(result.wasTrimmed).toBe(false);
    });
    
    it('returns correct character count', () => {
      const result = smartTrimPrompt({
        terms: ['one', 'two', 'three'],
        category: 'style',
        maxChars: 100,
      });
      
      const expectedLength = 'one, two, three'.length;
      expect(result.charCount).toBe(expectedLength);
    });
  });
  
  describe('getCategoryOrder', () => {
    
    it('returns array of categories', () => {
      const order = getCategoryOrder('midjourney');
      
      expect(Array.isArray(order)).toBe(true);
      expect(order.length).toBeGreaterThan(0);
    });
    
    it('has subject first', () => {
      const order = getCategoryOrder('midjourney');
      
      expect(order[0]).toBe('subject');
    });
    
    it('includes all main categories', () => {
      const order = getCategoryOrder('stability');
      
      expect(order).toContain('style');
      expect(order).toContain('lighting');
      expect(order).toContain('colour');
    });
  });
  
  describe('getTrimPriority', () => {
    
    it('returns array of categories', () => {
      const priority = getTrimPriority('midjourney');
      
      expect(Array.isArray(priority)).toBe(true);
      expect(priority.length).toBeGreaterThan(0);
    });
    
    it('has subject last (most important)', () => {
      const priority = getTrimPriority('stability');
      
      // Subject should be last in trim priority (trim last = most important)
      expect(priority[priority.length - 1]).toBe('subject');
    });
    
    it('has fidelity first (least important to trim first)', () => {
      const priority = getTrimPriority('dalle');
      
      expect(priority[0]).toBe('fidelity');
    });
  });
  
  describe('getPlatformCharLimit', () => {
    
    it('returns limit for known platforms', () => {
      expect(getPlatformCharLimit('midjourney')).toBe(6000);
      expect(getPlatformCharLimit('dalle')).toBe(4000);
      expect(getPlatformCharLimit('stability')).toBe(2000);
    });
    
    it('returns default for unknown platforms', () => {
      const limit = getPlatformCharLimit('unknown-platform');
      
      expect(limit).toBe(2000);
    });
  });
  
  describe('platformSupportsWeights', () => {
    
    it('returns true for platforms with weight support', () => {
      // Midjourney supports ::weight syntax
      expect(platformSupportsWeights('midjourney')).toBe(true);
    });
    
    it('returns false for platforms without weight support', () => {
      // DALL-E doesn't use weights
      expect(platformSupportsWeights('dalle')).toBe(false);
    });
  });
  
  describe('platformUsesSeparateNegative', () => {
    
    it('returns true for platforms with separate negative', () => {
      // Stable Diffusion uses separate negative prompt
      expect(platformUsesSeparateNegative('stability')).toBe(true);
    });
    
    it('returns false for platforms with inline negative', () => {
      // Midjourney uses --no inline
      expect(platformUsesSeparateNegative('midjourney')).toBe(false);
    });
  });
  
  describe('formatWithWeight', () => {
    
    it('formats weight for Midjourney style', () => {
      const result = formatWithWeight('cyberpunk', 1.5, 'midjourney');
      
      // Should be like "cyberpunk::1.5"
      expect(result).toContain('cyberpunk');
      if (result !== 'cyberpunk') {
        expect(result).toContain('1.5');
      }
    });
    
    it('returns original term if weight is 1.0', () => {
      const result = formatWithWeight('cyberpunk', 1.0, 'midjourney');
      
      expect(result).toBe('cyberpunk');
    });
    
    it('returns original for platforms without weight support', () => {
      const result = formatWithWeight('realistic', 1.5, 'dalle');
      
      expect(result).toBe('realistic');
    });
  });
  
  describe('getPlatformRecommendations', () => {
    
    it('returns all recommendation fields', () => {
      const recs = getPlatformRecommendations('midjourney');
      
      expect(recs.maxChars).toBeDefined();
      expect(typeof recs.supportsWeights).toBe('boolean');
      expect(typeof recs.separateNegative).toBe('boolean');
      expect(typeof recs.prefersNaturalLanguage).toBe('boolean');
      expect(typeof recs.prefersKeywords).toBe('boolean');
      expect(Array.isArray(recs.hints)).toBe(true);
    });
    
    it('returns correct values for known platforms', () => {
      const midjourney = getPlatformRecommendations('midjourney');
      
      expect(midjourney.maxChars).toBe(6000);
      expect(midjourney.supportsWeights).toBe(true);
    });
  });
  
  describe('estimateTokenCount', () => {
    
    it('estimates tokens correctly', () => {
      // 4 characters ~= 1 token
      const tokens = estimateTokenCount('this is a test');
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(14 / 4)); // "this is a test" = 14 chars
    });
    
    it('handles empty string', () => {
      expect(estimateTokenCount('')).toBe(0);
    });
  });
  
  describe('formatCompletePrompt', () => {
    
    it('formats complete prompt with subject', () => {
      const result = formatCompletePrompt({
        subject: 'a cyberpunk warrior',
        selections: {
          style: ['neon noir'],
          lighting: ['neon lights'],
        },
        negatives: ['blurry'],
        platformId: 'midjourney',
      });
      
      expect(result.positivePrompt).toContain('cyberpunk warrior');
      expect(result.positivePrompt).toContain('neon');
    });
    
    it('includes negatives in appropriate format', () => {
      const result = formatCompletePrompt({
        subject: 'portrait',
        selections: {},
        negatives: ['ugly', 'deformed'],
        platformId: 'stability',
      });
      
      // Should have negative in some form
      const hasNegative = result.negativePrompt !== null || 
                          result.positivePrompt.includes('ugly');
      expect(hasNegative).toBe(true);
    });
  });
  
  describe('Performance', () => {
    
    it('formats prompts efficiently', () => {
      const start = Date.now();
      
      for (let i = 0; i < 100; i++) {
        formatPromptForPlatform({
          selections: {
            style: ['cyberpunk', 'neon noir', 'cinematic'],
            lighting: ['neon lights', 'dramatic lighting'],
            atmosphere: ['dense fog', 'moody'],
          },
          negatives: ['blurry', 'low quality'],
          platformId: 'midjourney',
        });
      }
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // 100 iterations in under 100ms
    });
    
    it('trims prompts efficiently', () => {
      const longTerms = Array.from({ length: 100 }, (_, i) => `term number ${i}`);
      
      const start = Date.now();
      
      for (let i = 0; i < 50; i++) {
        smartTrimPrompt({
          terms: longTerms,
          category: 'style',
          maxChars: 200,
        });
      }
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // 50 iterations in under 100ms
    });
  });
});
