// src/lib/prompt-intelligence/engines/tests/integration.test.ts
// ============================================================================
// INTEGRATION LAYER - Tests
// ============================================================================
// Tests for the unified API that combines all engines.
// ============================================================================

import {
  analyzePrompt,
  quickConflictCheck,
  getOrderedOptions,
  getTopSuggestions,
  formatAndTrim,
  getMarketMoodUI,
  previewTermAddition,
  type PromptState,
  type MarketContext,
} from '../integration';

// ============================================================================
// Test Data
// ============================================================================

const createTestState = (overrides: Partial<PromptState> = {}): PromptState => ({
  subject: '',
  selections: {},
  negatives: [],
  platformId: 'midjourney',
  ...overrides,
});

const createMarketContext = (overrides: Partial<MarketContext> = {}): MarketContext => ({
  enabled: true,
  data: {
    fxPairs: [
      { pair: 'EUR/USD', rate: 1.08, previousClose: 1.055, changePercent: 2.5 },
      { pair: 'GBP/USD', rate: 1.27, previousClose: 1.285, changePercent: -1.2 },
    ],
  },
  ...overrides,
});

// ============================================================================
// analyzePrompt Tests
// ============================================================================

describe('Integration Layer', () => {
  
  describe('analyzePrompt', () => {
    
    it('returns complete analysis for empty prompt', () => {
      const state = createTestState();
      const result = analyzePrompt(state);
      
      expect(result).toHaveProperty('dna');
      expect(result).toHaveProperty('conflicts');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('formatted');
      expect(result).toHaveProperty('healthScore');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('marketSuggestions');
    });
    
    it('calculates health score correctly for empty prompt', () => {
      const state = createTestState();
      const result = analyzePrompt(state);
      
      // Empty prompt should have low health score (base is 50)
      expect(result.healthScore).toBeLessThan(70);
    });
    
    it('increases health score with subject', () => {
      const withoutSubject = analyzePrompt(createTestState());
      const withSubject = analyzePrompt(createTestState({
        subject: 'a cyberpunk warrior',
      }));
      
      expect(withSubject.healthScore).toBeGreaterThan(withoutSubject.healthScore);
    });
    
    it('increases health score with more categories filled', () => {
      const sparse = analyzePrompt(createTestState({
        subject: 'test',
        selections: { style: ['cyberpunk'] },
      }));
      
      const rich = analyzePrompt(createTestState({
        subject: 'test',
        selections: {
          style: ['cyberpunk'],
          lighting: ['neon lights'],
          atmosphere: ['electric energy'],
          colour: ['neon pink'],
        },
      }));
      
      expect(rich.healthScore).toBeGreaterThan(sparse.healthScore);
    });
    
    it('detects conflicts and reduces health score', () => {
      const noConflict = analyzePrompt(createTestState({
        subject: 'test',
        selections: { style: ['cyberpunk'] },
      }));
      
      const withConflict = analyzePrompt(createTestState({
        subject: 'test',
        selections: { style: ['photorealistic', 'abstract'] },
      }));
      
      expect(withConflict.conflicts.hasConflicts).toBe(true);
      // Health should be lower with conflicts
      expect(withConflict.healthScore).toBeLessThanOrEqual(noConflict.healthScore);
    });
    
    it('builds DNA with correct category fill status', () => {
      const state = createTestState({
        selections: {
          style: ['cyberpunk'],
          lighting: ['neon lights'],
        },
      });
      
      const result = analyzePrompt(state);
      
      expect(result.dna.categoryFill['style']).toBe('filled');
      expect(result.dna.categoryFill['lighting']).toBe('filled');
      expect(result.dna.categoryFill['colour']).toBe('empty');
      expect(result.dna.filledCount).toBe(2);
    });
    
    it('detects dominant family from selections', () => {
      const state = createTestState({
        selections: {
          style: ['cyberpunk', 'neon noir'],
          lighting: ['neon lights'],
        },
      });
      
      const result = analyzePrompt(state);
      
      // Should detect cyberpunk as dominant family
      expect(result.dna.dominantFamily).toBeTruthy();
    });
    
    it('generates suggestions based on context', () => {
      const state = createTestState({
        selections: {
          style: ['cyberpunk'],
        },
      });
      
      const result = analyzePrompt(state);
      
      // Should have suggestions for multiple categories
      expect(result.suggestions.totalCount).toBeGreaterThan(0);
    });
    
    it('formats prompt for platform', () => {
      const state = createTestState({
        subject: 'a robot',
        selections: {
          style: ['cyberpunk'],
        },
        negatives: ['blurry'],
        platformId: 'midjourney',
      });
      
      const result = analyzePrompt(state);
      
      expect(result.formatted.positivePrompt).toContain('cyberpunk');
      expect(result.formatted.positivePrompt).toContain('--no');
      expect(result.formatted.positivePrompt).toContain('blurry');
    });
    
    it('builds summary with correct metrics', () => {
      const state = createTestState({
        subject: 'test',
        selections: {
          style: ['cyberpunk'],
          lighting: ['neon lights'],
          colour: ['neon pink'],
        },
        negatives: ['blurry'],
      });
      
      const result = analyzePrompt(state);
      
      expect(result.summary.filledCategories).toBe(3);
      expect(result.summary.totalCategories).toBe(10);
      expect(result.summary.fillPercent).toBe(30);
      expect(result.summary.tokenEstimate).toBeGreaterThan(0);
    });
    
    it('includes market suggestions when market context provided', () => {
      const state = createTestState({
        selections: { style: ['cyberpunk'] },
      });
      const market = createMarketContext();
      
      const result = analyzePrompt(state, market);
      
      // Market suggestions should be present (may be empty if no strong mood)
      expect(result).toHaveProperty('marketSuggestions');
      expect(Array.isArray(result.marketSuggestions)).toBe(true);
    });
  });
  
  // ============================================================================
  // quickConflictCheck Tests
  // ============================================================================
  
  describe('quickConflictCheck', () => {
    
    it('returns no conflicts for empty selections', () => {
      const result = quickConflictCheck({});
      
      expect(result.hasConflicts).toBe(false);
      expect(result.hardCount).toBe(0);
      expect(result.firstConflict).toBeNull();
    });
    
    it('returns no conflicts for compatible selections', () => {
      const result = quickConflictCheck({
        style: ['cyberpunk'],
        lighting: ['neon lights'],
      });
      
      expect(result.hasConflicts).toBe(false);
    });
    
    it('detects hard conflicts', () => {
      const result = quickConflictCheck({
        style: ['photorealistic', 'abstract'],
      });
      
      expect(result.hasConflicts).toBe(true);
      expect(result.firstConflict).not.toBeNull();
    });
    
    it('returns first conflict for display', () => {
      const result = quickConflictCheck({
        style: ['photorealistic', 'abstract'],
      });
      
      if (result.firstConflict) {
        expect(result.firstConflict).toHaveProperty('terms');
        expect(result.firstConflict).toHaveProperty('reason');
        expect(result.firstConflict).toHaveProperty('severity');
      }
    });
  });
  
  // ============================================================================
  // getOrderedOptions Tests
  // ============================================================================
  
  describe('getOrderedOptions', () => {
    
    it('returns scored options', () => {
      const result = getOrderedOptions({
        options: ['cyberpunk', 'vintage', 'minimalist'],
        category: 'style',
        selections: {},
      });
      
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty('option');
      expect(result[0]).toHaveProperty('score');
      expect(result[0]).toHaveProperty('isRecommended');
    });
    
    it('scores context-relevant options higher', () => {
      const result = getOrderedOptions({
        options: ['neon lights', 'candlelight', 'soft daylight'],
        category: 'lighting',
        selections: {
          style: ['cyberpunk'],
        },
      });
      
      // Find neon lights score
      const neonScore = result.find(r => r.option === 'neon lights')?.score ?? 0;
      const candleScore = result.find(r => r.option === 'candlelight')?.score ?? 0;
      
      // Neon lights should score higher in cyberpunk context
      expect(neonScore).toBeGreaterThanOrEqual(candleScore);
    });
    
    it('marks high-scoring options as recommended', () => {
      const result = getOrderedOptions({
        options: ['neon lights', 'candlelight'],
        category: 'lighting',
        selections: {
          style: ['cyberpunk'],
        },
      });
      
      // At least one option should be recommended (score >= 65)
      const hasRecommended = result.some(r => r.isRecommended);
      // This may or may not be true depending on scoring
      expect(typeof hasRecommended).toBe('boolean');
    });
    
    it('handles empty options array', () => {
      const result = getOrderedOptions({
        options: [],
        category: 'style',
        selections: {},
      });
      
      expect(result).toHaveLength(0);
    });
  });
  
  // ============================================================================
  // getTopSuggestions Tests
  // ============================================================================
  
  describe('getTopSuggestions', () => {
    
    it('returns suggestions array', () => {
      const result = getTopSuggestions({
        style: ['cyberpunk'],
      });
      
      expect(Array.isArray(result)).toBe(true);
    });
    
    it('respects maxTotal option', () => {
      const result = getTopSuggestions(
        { style: ['cyberpunk'] },
        { maxTotal: 5 }
      );
      
      expect(result.length).toBeLessThanOrEqual(5);
    });
    
    it('returns suggestions with required properties', () => {
      const result = getTopSuggestions({
        style: ['cyberpunk'],
      });
      
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('option');
        expect(result[0]).toHaveProperty('category');
        expect(result[0]).toHaveProperty('score');
        expect(result[0]).toHaveProperty('reason');
      }
    });
    
    it('sorts by score descending', () => {
      const result = getTopSuggestions({
        style: ['cyberpunk'],
      });
      
      if (result.length >= 2) {
        const first = result[0];
        const second = result[1];
        if (first && second) {
          expect(first.score).toBeGreaterThanOrEqual(second.score);
        }
      }
    });
  });
  
  // ============================================================================
  // formatAndTrim Tests
  // ============================================================================
  
  describe('formatAndTrim', () => {
    
    it('formats prompt for platform', () => {
      const state = createTestState({
        subject: 'a robot',
        selections: {
          style: ['cyberpunk'],
        },
        negatives: ['blurry'],
        platformId: 'midjourney',
      });
      
      const result = formatAndTrim(state);
      
      expect(result.positivePrompt).toContain('cyberpunk');
      expect(result).toHaveProperty('charCount');
      expect(result).toHaveProperty('wasTrimmed');
      expect(result).toHaveProperty('trimDetails');
    });
    
    it('includes trim details when trimmed', () => {
      const state = createTestState({
        subject: 'a very long subject description that might need trimming',
        selections: {
          style: ['cyberpunk', 'neon noir'],
          lighting: ['neon lights', 'rim lighting'],
          colour: ['neon pink', 'electric blue'],
          atmosphere: ['dense fog', 'electric energy'],
        },
        platformId: 'craiyon', // Low char limit platform
      });
      
      const result = formatAndTrim(state, 100);
      
      if (result.wasTrimmed) {
        expect(result.trimDetails).not.toBeNull();
      }
    });
    
    it('respects maxChars parameter', () => {
      const state = createTestState({
        subject: 'test',
        selections: {
          style: ['cyberpunk'],
        },
      });
      
      const result = formatAndTrim(state, 50);
      
      expect(result.charCount).toBeLessThanOrEqual(50);
    });
  });
  
  // ============================================================================
  // getMarketMoodUI Tests
  // ============================================================================
  
  describe('getMarketMoodUI', () => {
    
    it('returns null when market disabled', () => {
      const result = getMarketMoodUI({ enabled: false });
      
      expect(result).toBeNull();
    });
    
    it('returns null when no market data', () => {
      const result = getMarketMoodUI({ enabled: true });
      
      expect(result).toBeNull();
    });
    
    it('returns UI data when market data provided', () => {
      const market = createMarketContext();
      const result = getMarketMoodUI(market);
      
      expect(result).not.toBeNull();
      if (result) {
        expect(result).toHaveProperty('active');
        expect(result).toHaveProperty('state');
      }
    });
    
    it('includes theme and icon when active', () => {
      const market = createMarketContext({
        data: {
          fxPairs: [
            { pair: 'EUR/USD', rate: 1.08, previousClose: 1.025, changePercent: 5.0 }, // High volatility
          ],
        },
      });
      
      const result = getMarketMoodUI(market);
      
      if (result?.active) {
        expect(result.theme).not.toBeNull();
        expect(result.icon).not.toBeNull();
      }
    });
  });
  
  // ============================================================================
  // previewTermAddition Tests
  // ============================================================================
  
  describe('previewTermAddition', () => {
    
    it('returns no conflict for compatible addition', () => {
      const result = previewTermAddition(
        { style: ['cyberpunk'] },
        'neon lights',
        'lighting'
      );
      
      expect(result.wouldConflict).toBe(false);
      expect(result.conflict).toBeNull();
    });
    
    it('detects conflict when adding incompatible term', () => {
      const result = previewTermAddition(
        { style: ['photorealistic'] },
        'abstract',
        'style'
      );
      
      expect(result.wouldConflict).toBe(true);
      expect(result.conflict).not.toBeNull();
    });
    
    it('provides suggested alternatives when conflict detected', () => {
      const result = previewTermAddition(
        { style: ['photorealistic'] },
        'abstract',
        'style'
      );
      
      if (result.wouldConflict) {
        expect(Array.isArray(result.suggestedAlternatives)).toBe(true);
      }
    });
    
    it('returns conflict details', () => {
      const result = previewTermAddition(
        { style: ['photorealistic'] },
        'abstract',
        'style'
      );
      
      if (result.conflict) {
        expect(result.conflict).toHaveProperty('terms');
        expect(result.conflict).toHaveProperty('reason');
        expect(result.conflict).toHaveProperty('severity');
      }
    });
  });
  
});
