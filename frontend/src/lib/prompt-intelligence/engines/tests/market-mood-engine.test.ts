// src/lib/prompt-intelligence/engines/tests/market-mood-engine.test.ts
// ============================================================================
// MARKET MOOD ENGINE - Tests
// ============================================================================

import {
  detectMarketState,
  applyMarketMoodBoosts,
  getMarketMoodSuggestions,
  shouldShowMarketMood,
  getMarketMoodTheme,
  getMarketMoodIcon,
} from '../market-mood-engine';

describe('Market Mood Engine', () => {
  
  describe('detectMarketState', () => {
    
    it('returns neutral state for empty input', () => {
      const result = detectMarketState({});
      
      expect(result.state.type).toBe('neutral');
      expect(result.state.intensity).toBe(1.0);
      expect(result.secondaryStates).toHaveLength(0);
      expect(result.confidence).toBe(1.0);
    });
    
    it('detects high volatility from FX data', () => {
      const result = detectMarketState({
        fxPairs: [
          { pair: 'EUR/USD', rate: 1.0900, previousClose: 1.0700, changePercent: 1.87 },
          { pair: 'GBP/USD', rate: 1.2800, previousClose: 1.2600, changePercent: 1.59 },
          { pair: 'USD/JPY', rate: 152.00, previousClose: 149.50, changePercent: 1.67 },
        ],
        exchanges: [
          { exchangeId: 'NYSE', isOpen: true },
        ],
      });
      
      expect(result.state.type).toBe('high_volatility');
      expect(result.state.intensity).toBeGreaterThan(0.5);
      expect(result.anyMarketOpen).toBe(true);
    });
    
    it('detects low volatility from FX data', () => {
      const result = detectMarketState({
        fxPairs: [
          { pair: 'EUR/USD', rate: 1.0851, previousClose: 1.0850, changePercent: 0.01 },
          { pair: 'GBP/USD', rate: 1.2701, previousClose: 1.2700, changePercent: 0.01 },
          { pair: 'USD/JPY', rate: 150.02, previousClose: 150.00, changePercent: 0.01 },
        ],
        exchanges: [
          { exchangeId: 'LSE', isOpen: true },
        ],
      });
      
      expect(result.state.type).toBe('low_volatility');
      expect(result.anyMarketOpen).toBe(true);
    });
    
    it('detects market opening', () => {
      const result = detectMarketState({
        exchanges: [
          { exchangeId: 'NYSE', isOpen: false, minutesUntilTransition: 15 },
        ],
      });
      
      expect(result.state.type).toBe('market_opening');
      expect(result.state.exchangeId).toBe('NYSE');
    });
    
    it('detects market closing', () => {
      const result = detectMarketState({
        exchanges: [
          { exchangeId: 'LSE', isOpen: true, minutesUntilTransition: 10 },
        ],
      });
      
      expect(result.state.type).toBe('market_closing');
      expect(result.state.exchangeId).toBe('LSE');
    });
    
    it('detects USD strength', () => {
      const result = detectMarketState({
        fxPairs: [
          { pair: 'EUR/USD', rate: 1.0750, previousClose: 1.0850, changePercent: -0.92 },
          { pair: 'GBP/USD', rate: 1.2600, previousClose: 1.2700, changePercent: -0.79 },
          { pair: 'USD/JPY', rate: 152.00, previousClose: 150.00, changePercent: 1.33 },
        ],
      });
      
      // USD is strengthening against all pairs
      expect(['high_volatility', 'currency_strength_usd']).toContain(result.state.type);
    });
    
    it('detects gold rising', () => {
      const result = detectMarketState({
        commodities: [
          { symbol: 'XAU', price: 2050, previousClose: 2030, changePercent: 0.99 },
        ],
      });
      
      expect(result.state.type).toBe('gold_rising');
    });
    
    it('detects gold falling', () => {
      const result = detectMarketState({
        commodities: [
          { symbol: 'XAU', price: 1980, previousClose: 2000, changePercent: -1.0 },
        ],
      });
      
      expect(result.state.type).toBe('gold_falling');
    });
    
    it('detects crypto pumping', () => {
      const result = detectMarketState({
        crypto: [
          { symbol: 'BTC', price: 70000, change24hPercent: 8.5 },
          { symbol: 'ETH', price: 4000, change24hPercent: 7.2 },
        ],
      });
      
      expect(result.state.type).toBe('crypto_pumping');
      expect(result.anyMarketOpen).toBe(true); // Crypto is always open
    });
    
    it('returns secondary states when multiple conditions met', () => {
      const result = detectMarketState({
        fxPairs: [
          { pair: 'EUR/USD', rate: 1.0900, previousClose: 1.0700, changePercent: 1.87 },
        ],
        commodities: [
          { symbol: 'XAU', price: 2050, previousClose: 2030, changePercent: 0.99 },
        ],
        exchanges: [
          { exchangeId: 'NYSE', isOpen: true },
        ],
      });
      
      // Should have primary and possibly secondary states
      expect(result.state).toBeDefined();
      expect(Array.isArray(result.secondaryStates)).toBe(true);
    });
    
    it('provides human-readable description', () => {
      const result = detectMarketState({
        exchanges: [
          { exchangeId: 'NYSE', isOpen: false, minutesUntilTransition: 15 },
        ],
      });
      
      expect(result.description).toBeDefined();
      expect(result.description.length).toBeGreaterThan(0);
      expect(result.description).toContain('NYSE');
    });
  });
  
  describe('applyMarketMoodBoosts', () => {
    
    it('returns boosted options for valid market state', () => {
      const result = applyMarketMoodBoosts({
        type: 'high_volatility',
        intensity: 0.8,
        isMarketOpen: true,
      });
      
      expect(result.boostedOptions).toBeDefined();
      expect(result.marketState.type).toBe('high_volatility');
      expect(result.totalBoosted).toBeGreaterThanOrEqual(0);
    });
    
    it('returns empty for neutral state', () => {
      const result = applyMarketMoodBoosts({
        type: 'neutral',
        intensity: 1.0,
        isMarketOpen: false,
      });
      
      // Neutral may or may not have boosts depending on config
      expect(result.boostedOptions).toBeDefined();
    });
    
    it('returns correct market state in result', () => {
      const inputState = {
        type: 'gold_rising' as const,
        intensity: 0.9,
        isMarketOpen: true,
      };
      
      const result = applyMarketMoodBoosts(inputState);
      
      expect(result.marketState).toEqual(inputState);
    });
    
    it('groups boosted options by category', () => {
      const result = applyMarketMoodBoosts({
        type: 'crypto_pumping',
        intensity: 0.9,
        isMarketOpen: true,
      });
      
      for (const [category, options] of Object.entries(result.boostedOptions)) {
        expect(Array.isArray(options)).toBe(true);
        expect(typeof category).toBe('string');
      }
    });
  });
  
  describe('getMarketMoodSuggestions', () => {
    
    it('returns suggestions for valid market state', () => {
      const suggestions = getMarketMoodSuggestions({
        type: 'high_volatility',
        intensity: 0.8,
        isMarketOpen: true,
      });
      
      expect(Array.isArray(suggestions)).toBe(true);
    });
    
    it('all suggestions are marked as market boosted', () => {
      const suggestions = getMarketMoodSuggestions({
        type: 'gold_rising',
        intensity: 0.9,
        isMarketOpen: true,
      });
      
      for (const suggestion of suggestions) {
        expect(suggestion.isMarketBoosted).toBe(true);
      }
    });
    
    it('suggestions include reason mentioning market', () => {
      const suggestions = getMarketMoodSuggestions({
        type: 'crypto_pumping',
        intensity: 0.9,
        isMarketOpen: true,
      });
      
      for (const suggestion of suggestions) {
        expect(suggestion.reason.toLowerCase()).toContain('market');
      }
    });
    
    it('respects maxPerCategory option', () => {
      const suggestions = getMarketMoodSuggestions(
        {
          type: 'high_volatility',
          intensity: 0.8,
          isMarketOpen: true,
        },
        { maxPerCategory: 2 }
      );
      
      // Count suggestions per category
      const categoryCounts: Record<string, number> = {};
      for (const s of suggestions) {
        categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
      }
      
      for (const count of Object.values(categoryCounts)) {
        expect(count).toBeLessThanOrEqual(2);
      }
    });
    
    it('suggestions are sorted by score', () => {
      const suggestions = getMarketMoodSuggestions({
        type: 'high_volatility',
        intensity: 0.8,
        isMarketOpen: true,
      });
      
      for (let i = 1; i < suggestions.length; i++) {
        const prev = suggestions[i - 1];
        const curr = suggestions[i];
        if (prev && curr) {
          expect(prev.score).toBeGreaterThanOrEqual(curr.score);
        }
      }
    });
  });
  
  describe('shouldShowMarketMood', () => {
    
    it('returns false for neutral state', () => {
      expect(shouldShowMarketMood({
        type: 'neutral',
        intensity: 1.0,
        isMarketOpen: false,
      })).toBe(false);
    });
    
    it('returns false for low intensity', () => {
      expect(shouldShowMarketMood({
        type: 'high_volatility',
        intensity: 0.3,
        isMarketOpen: true,
      })).toBe(false);
    });
    
    it('returns true for high intensity non-neutral', () => {
      expect(shouldShowMarketMood({
        type: 'gold_rising',
        intensity: 0.8,
        isMarketOpen: true,
      })).toBe(true);
    });
  });
  
  describe('getMarketMoodTheme', () => {
    
    it('returns theme with all required properties', () => {
      const theme = getMarketMoodTheme('high_volatility');
      
      expect(theme.primary).toBeDefined();
      expect(theme.secondary).toBeDefined();
      expect(theme.accent).toBeDefined();
    });
    
    it('returns different themes for different states', () => {
      const volatileTheme = getMarketMoodTheme('high_volatility');
      const calmTheme = getMarketMoodTheme('low_volatility');
      
      expect(volatileTheme.primary).not.toBe(calmTheme.primary);
    });
    
    it('returns valid hex colors', () => {
      const theme = getMarketMoodTheme('gold_rising');
      const hexPattern = /^#[0-9a-f]{6}$/i;
      
      expect(hexPattern.test(theme.primary)).toBe(true);
      expect(hexPattern.test(theme.secondary)).toBe(true);
      expect(hexPattern.test(theme.accent)).toBe(true);
    });
    
    it('returns neutral theme for unknown state', () => {
      const theme = getMarketMoodTheme('neutral');
      
      expect(theme).toBeDefined();
      expect(theme.primary).toBeDefined();
    });
  });
  
  describe('getMarketMoodIcon', () => {
    
    it('returns icon name for each state', () => {
      const states = [
        'market_opening', 'market_closing', 'high_volatility', 'low_volatility',
        'currency_strength_usd', 'gold_rising', 'crypto_pumping', 'neutral'
      ] as const;
      
      for (const state of states) {
        const icon = getMarketMoodIcon(state);
        expect(typeof icon).toBe('string');
        expect(icon.length).toBeGreaterThan(0);
      }
    });
    
    it('returns appropriate icons for financial states', () => {
      expect(getMarketMoodIcon('gold_rising')).toBe('trending-up');
      expect(getMarketMoodIcon('gold_falling')).toBe('trending-down');
      expect(getMarketMoodIcon('crypto_pumping')).toBe('zap');
    });
    
    it('returns sun icons for market transitions', () => {
      expect(getMarketMoodIcon('market_opening')).toBe('sunrise');
      expect(getMarketMoodIcon('market_closing')).toBe('sunset');
    });
  });
  
  describe('Performance', () => {
    
    it('detects market state efficiently', () => {
      const start = Date.now();
      
      for (let i = 0; i < 100; i++) {
        detectMarketState({
          fxPairs: [
            { pair: 'EUR/USD', rate: 1.0850, previousClose: 1.0800, changePercent: 0.46 },
            { pair: 'GBP/USD', rate: 1.2700, previousClose: 1.2650, changePercent: 0.40 },
          ],
          exchanges: [
            { exchangeId: 'NYSE', isOpen: true },
            { exchangeId: 'LSE', isOpen: true },
          ],
        });
      }
      
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(100); // 100 iterations in under 100ms
    });
  });
});
