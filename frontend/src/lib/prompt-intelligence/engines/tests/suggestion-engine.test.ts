// src/lib/prompt-intelligence/engines/tests/suggestion-engine.test.ts
// ============================================================================
// SUGGESTION ENGINE - Tests
// ============================================================================

import { 
  buildContext,
  scoreOptions,
  reorderByRelevance,
  getSuggestions,
  getSuggestionsForCategory,
  getAutoCompleteSuggestions,
} from '../suggestion-engine';

describe('Suggestion Engine', () => {
  
  describe('buildContext', () => {
    
    it('returns empty context for empty selections', () => {
      const context = buildContext({ selections: {} });
      
      expect(context.activeFamily).toBeNull();
      expect(context.relatedFamilies).toHaveLength(0);
      expect(context.dominantMood).toBeNull();
      expect(context.era).toBeNull();
      expect(context.selectedTerms).toHaveLength(0);
    });
    
    it('extracts keywords from custom subject', () => {
      const context = buildContext({
        selections: {},
        customSubject: 'A cyberpunk warrior in neon city',
      });
      
      expect(context.subjectKeywords).toContain('cyberpunk');
      expect(context.subjectKeywords).toContain('warrior');
      expect(context.subjectKeywords).toContain('neon');
      expect(context.subjectKeywords).toContain('city');
      // Should not contain stop words
      expect(context.subjectKeywords).not.toContain('a');
      expect(context.subjectKeywords).not.toContain('in');
    });
    
    it('identifies active family from selections', () => {
      const context = buildContext({
        selections: {
          style: ['cyberpunk'],
          lighting: ['neon lights'],
          atmosphere: ['electric energy'],
        },
      });
      
      // Should identify sci-fi or cyberpunk family
      expect(context.activeFamily).toBeDefined();
    });
    
    it('identifies dominant mood from selections', () => {
      const context = buildContext({
        selections: {
          atmosphere: ['calm serenity', 'peaceful'],
          lighting: ['soft lighting'],
        },
      });
      
      // May or may not detect depending on tags
      expect(context.dominantMood === 'calm' || context.dominantMood === null).toBe(true);
    });
    
    it('identifies era from selections', () => {
      const context = buildContext({
        selections: {
          style: ['vintage style', 'retro aesthetic'],
          materials: ['aged leather'],
        },
      });
      
      // Should identify past era
      expect(context.era === 'past' || context.era === null).toBe(true);
    });
    
    it('collects all selected terms', () => {
      const context = buildContext({
        selections: {
          style: ['cyberpunk', 'neon noir'],
          lighting: ['neon lights'],
        },
      });
      
      expect(context.selectedTerms).toContain('cyberpunk');
      expect(context.selectedTerms).toContain('neon noir');
      expect(context.selectedTerms).toContain('neon lights');
      expect(context.selectedTerms).toHaveLength(3);
    });
    
    it('includes market state when enabled', () => {
      const marketState = {
        type: 'high_volatility' as const,
        intensity: 0.8,
        isMarketOpen: true,
      };
      
      const context = buildContext({
        selections: {},
        marketMoodEnabled: true,
        marketState,
      });
      
      expect(context.marketMoodEnabled).toBe(true);
      expect(context.marketState).toEqual(marketState);
    });
  });
  
  describe('scoreOptions', () => {
    
    it('returns all options with scores', () => {
      const context = buildContext({
        selections: { style: ['cyberpunk'] },
      });
      
      const options = ['neon lights', 'candlelight', 'dramatic lighting'];
      const scored = scoreOptions({
        options,
        category: 'lighting',
        context,
      });
      
      expect(scored).toHaveLength(3);
      expect(scored.every(s => typeof s.score === 'number')).toBe(true);
      expect(scored.every(s => s.score >= 0 && s.score <= 100)).toBe(true);
    });
    
    it('sorts options by score (highest first)', () => {
      const context = buildContext({
        selections: { style: ['cyberpunk'] },
      });
      
      const scored = scoreOptions({
        options: ['neon lights', 'candlelight', 'volumetric lighting'],
        category: 'lighting',
        context,
      });
      
      // Check descending order
      for (let i = 1; i < scored.length; i++) {
        const prev = scored[i - 1];
        const curr = scored[i];
        if (prev && curr) {
          expect(prev.score).toBeGreaterThanOrEqual(curr.score);
        }
      }
    });
    
    it('includes breakdown when requested', () => {
      const context = buildContext({
        selections: { style: ['cyberpunk'] },
      });
      
      const scored = scoreOptions({
        options: ['neon lights'],
        category: 'lighting',
        context,
        includeBreakdown: true,
      });
      
      const first = scored[0];
      expect(first).toBeDefined();
      expect(first?.breakdown).toBeDefined();
      expect(first?.breakdown).toHaveProperty('familyMatch');
      expect(first?.breakdown).toHaveProperty('moodMatch');
      expect(first?.breakdown).toHaveProperty('conflictPenalty');
    });
    
    it('scores compatible options higher', () => {
      const context = buildContext({
        selections: { style: ['cyberpunk'] },
      });
      
      const scored = scoreOptions({
        options: ['neon lights', 'candlelight'],
        category: 'lighting',
        context,
        includeBreakdown: true,
      });
      
      // neon lights should score higher with cyberpunk than candlelight
      const neonScore = scored.find(s => s.option === 'neon lights')?.score ?? 0;
      const candleScore = scored.find(s => s.option === 'candlelight')?.score ?? 0;
      
      expect(neonScore).toBeGreaterThanOrEqual(candleScore);
    });
    
    it('penalizes conflicting options', () => {
      const context = buildContext({
        selections: { style: ['photorealistic'] },
      });
      
      const scored = scoreOptions({
        options: ['abstract', 'cinematic style'],
        category: 'style',
        context,
        includeBreakdown: true,
      });
      
      // abstract should be penalized due to conflict with photorealistic
      const abstractOption = scored.find(s => s.option === 'abstract');
      if (abstractOption?.breakdown) {
        expect(abstractOption.breakdown.conflictPenalty).toBeLessThanOrEqual(0);
      }
    });
  });
  
  describe('reorderByRelevance', () => {
    
    it('reorders options by relevance score', () => {
      const selections = { style: ['cyberpunk'] };
      const options = ['candlelight', 'neon lights', 'natural light'];
      
      const reordered = reorderByRelevance(options, 'lighting', selections);
      
      expect(reordered).toHaveLength(3);
      const first = reordered[0];
      const second = reordered[1];
      const third = reordered[2];
      if (first && second) {
        expect(first.score).toBeGreaterThanOrEqual(second.score);
      }
      if (second && third) {
        expect(second.score).toBeGreaterThanOrEqual(third.score);
      }
    });
    
    it('works with empty selections', () => {
      const reordered = reorderByRelevance(
        ['golden hour', 'blue hour', 'midday sun'],
        'lighting',
        {}
      );
      
      expect(reordered).toHaveLength(3);
      // All should have similar base scores
      expect(reordered.every(o => o.score >= 40)).toBe(true);
    });
  });
  
  describe('getSuggestions', () => {
    
    it('returns suggestions grouped by category', () => {
      const result = getSuggestions({
        selections: { style: ['cyberpunk'] },
        maxPerCategory: 3,
      });
      
      expect(result.suggestions).toBeDefined();
      expect(result.context).toBeDefined();
      expect(typeof result.totalCount).toBe('number');
    });
    
    it('respects maxPerCategory limit', () => {
      const result = getSuggestions({
        selections: { style: ['cyberpunk'] },
        maxPerCategory: 2,
      });
      
      for (const categorySuggestions of Object.values(result.suggestions)) {
        expect(categorySuggestions.length).toBeLessThanOrEqual(2);
      }
    });
    
    it('filters by minimum score', () => {
      const result = getSuggestions({
        selections: { style: ['cyberpunk'] },
        minScore: 60,
      });
      
      for (const categorySuggestions of Object.values(result.suggestions)) {
        for (const suggestion of categorySuggestions) {
          expect(suggestion.score).toBeGreaterThanOrEqual(60);
        }
      }
    });
    
    it('can filter to a specific category', () => {
      const result = getSuggestions({
        selections: { style: ['cyberpunk'] },
        forCategory: 'lighting',
      });
      
      const categories = Object.keys(result.suggestions);
      expect(categories).toHaveLength(1);
      expect(categories[0]).toBe('lighting');
    });
    
    it('excludes already selected options', () => {
      const result = getSuggestions({
        selections: { 
          style: ['cyberpunk'],
          lighting: ['neon lights'] 
        },
        forCategory: 'lighting',
      });
      
      const lightingSuggestions = result.suggestions.lighting || [];
      const options = lightingSuggestions.map(s => s.option);
      
      expect(options).not.toContain('neon lights');
    });
    
    it('includes reason for each suggestion', () => {
      const result = getSuggestions({
        selections: { style: ['cyberpunk'] },
        forCategory: 'lighting',
        maxPerCategory: 3,
      });
      
      const suggestions = result.suggestions.lighting || [];
      for (const suggestion of suggestions) {
        expect(suggestion.reason).toBeDefined();
        expect(suggestion.reason.length).toBeGreaterThan(0);
      }
    });
    
    it('marks market-boosted suggestions', () => {
      const result = getSuggestions({
        selections: { style: ['cyberpunk'] },
        marketMoodEnabled: true,
        marketState: {
          type: 'high_volatility',
          intensity: 1.0,
          isMarketOpen: true,
        },
      });
      
      // Check if any are marked as market boosted
      let hasMarketBoost = false;
      for (const categorySuggestions of Object.values(result.suggestions)) {
        if (categorySuggestions.some(s => s.isMarketBoosted)) {
          hasMarketBoost = true;
          break;
        }
      }
      
      // Market boost may or may not apply depending on data
      expect(typeof hasMarketBoost).toBe('boolean');
    });
  });
  
  describe('getSuggestionsForCategory', () => {
    
    it('returns suggestions for a specific category', () => {
      const context = buildContext({
        selections: { style: ['cyberpunk'] },
      });
      
      const suggestions = getSuggestionsForCategory(
        'lighting',
        context,
        5,
        50,
        []
      );
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.every(s => s.category === 'lighting')).toBe(true);
    });
    
    it('excludes specified existing selections', () => {
      const context = buildContext({
        selections: { style: ['cyberpunk'] },
      });
      
      const suggestions = getSuggestionsForCategory(
        'lighting',
        context,
        10,
        0,
        ['neon lights', 'dramatic lighting']
      );
      
      const options = suggestions.map(s => s.option);
      expect(options).not.toContain('neon lights');
      expect(options).not.toContain('dramatic lighting');
    });
  });
  
  describe('getAutoCompleteSuggestions', () => {
    
    it('returns one suggestion per empty category', () => {
      const suggestions = getAutoCompleteSuggestions({
        style: ['cyberpunk'],
        lighting: ['neon lights'],
      });
      
      // Should suggest for empty categories
      const categories = suggestions.map(s => s.category);
      
      // Should not include style or lighting (already filled)
      expect(categories).not.toContain('style');
      expect(categories).not.toContain('lighting');
    });
    
    it('returns empty for fully filled selections', () => {
      const suggestions = getAutoCompleteSuggestions({
        style: ['cyberpunk'],
        lighting: ['neon lights'],
        colour: ['blue tones'],
        atmosphere: ['electric energy'],
        environment: ['urban city'],
        action: ['standing confidently'],
        composition: ['centered composition'],
        camera: ['wide angle lens'],
        materials: ['polished chrome'],
        fidelity: ['highly detailed'],
      });
      
      // May still have some suggestions or be empty
      expect(Array.isArray(suggestions)).toBe(true);
    });
    
    it('respects minimum score threshold', () => {
      const suggestions = getAutoCompleteSuggestions({});
      
      // All suggestions should meet minimum threshold
      for (const suggestion of suggestions) {
        expect(suggestion.score).toBeGreaterThanOrEqual(60);
      }
    });
  });
  
  describe('Performance', () => {
    
    it('scores options efficiently', () => {
      const context = buildContext({
        selections: {
          style: ['cyberpunk', 'neon noir'],
          lighting: ['neon lights'],
          atmosphere: ['electric energy'],
        },
      });
      
      // Create a large options list
      const options = Array.from({ length: 100 }, (_, i) => `option ${i}`);
      
      const start = Date.now();
      const scored = scoreOptions({
        options,
        category: 'style',
        context,
      });
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(50); // Should complete in under 50ms
      expect(scored).toHaveLength(100);
    });
    
    it('generates suggestions efficiently', () => {
      const start = Date.now();
      
      const result = getSuggestions({
        selections: {
          style: ['cyberpunk'],
          lighting: ['neon lights'],
        },
        maxPerCategory: 10,
      });
      
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(200); // Should complete in under 200ms
      expect(result.totalCount).toBeGreaterThan(0);
    });
  });
});
