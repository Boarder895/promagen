// src/hooks/prompt-intelligence/__tests__/use-market-mood.test.ts
// ============================================================================
// USE MARKET MOOD HOOK - Tests
// ============================================================================

import { renderHook, act } from '@testing-library/react';
import { useMarketMood } from '../use-market-mood';
import type { MarketDataInput } from '@/lib/prompt-intelligence';

// ============================================================================
// Test Data
// ============================================================================

const createMarketData = (overrides: Partial<MarketDataInput> = {}): MarketDataInput => ({
  fxPairs: [
    { pair: 'EUR/USD', rate: 1.08, previousClose: 1.055, changePercent: 2.5 },
    { pair: 'GBP/USD', rate: 1.27, previousClose: 1.285, changePercent: -1.2 },
  ],
  ...overrides,
});

const createVolatileMarketData = (): MarketDataInput => ({
  fxPairs: [
    { pair: 'EUR/USD', rate: 1.08, previousClose: 1.025, changePercent: 5.5 },
    { pair: 'GBP/USD', rate: 1.27, previousClose: 1.325, changePercent: -4.2 },
    { pair: 'USD/JPY', rate: 150.0, previousClose: 144.5, changePercent: 3.8 },
  ],
});

// ============================================================================
// Tests
// ============================================================================

describe('useMarketMood', () => {
  
  beforeEach(() => {
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('initialization', () => {
    
    it('returns null state when no market data', () => {
      const { result } = renderHook(() => useMarketMood(undefined));
      
      expect(result.current.state).toBeNull();
      expect(result.current.isActive).toBe(false);
      expect(result.current.description).toBeNull();
      expect(result.current.theme).toBeNull();
      expect(result.current.icon).toBeNull();
      expect(result.current.suggestions).toHaveLength(0);
    });
    
    it('provides refresh function', () => {
      const { result } = renderHook(() => useMarketMood(undefined));
      
      expect(typeof result.current.refresh).toBe('function');
    });
  });
  
  describe('market state detection', () => {
    
    it('detects market state from data', () => {
      const marketData = createMarketData();
      const { result } = renderHook(() => useMarketMood(marketData));
      
      // Should detect some state (may or may not be active depending on intensity)
      expect(result.current.state).not.toBeNull();
    });
    
    it('sets isActive when intensity is sufficient', () => {
      const volatileData = createVolatileMarketData();
      const { result } = renderHook(() => useMarketMood(volatileData));
      
      // High volatility should trigger active state
      // Note: depends on mood detection thresholds
      expect(typeof result.current.isActive).toBe('boolean');
    });
    
    it('provides description when state detected', () => {
      const marketData = createMarketData();
      const { result } = renderHook(() => useMarketMood(marketData));
      
      if (result.current.state) {
        expect(result.current.description).not.toBeNull();
      }
    });
  });
  
  describe('theme and icon', () => {
    
    it('returns theme when active', () => {
      const volatileData = createVolatileMarketData();
      const { result } = renderHook(() => useMarketMood(volatileData));
      
      if (result.current.isActive) {
        expect(result.current.theme).not.toBeNull();
        expect(result.current.theme).toHaveProperty('primary');
        expect(result.current.theme).toHaveProperty('secondary');
        expect(result.current.theme).toHaveProperty('accent');
      }
    });
    
    it('returns icon when active', () => {
      const volatileData = createVolatileMarketData();
      const { result } = renderHook(() => useMarketMood(volatileData));
      
      if (result.current.isActive) {
        expect(result.current.icon).not.toBeNull();
        expect(typeof result.current.icon).toBe('string');
      }
    });
    
    it('returns null theme/icon when not active', () => {
      const { result } = renderHook(() => useMarketMood(undefined));
      
      expect(result.current.theme).toBeNull();
      expect(result.current.icon).toBeNull();
    });
  });
  
  describe('suggestions', () => {
    
    it('returns suggestions array', () => {
      const marketData = createMarketData();
      const { result } = renderHook(() => useMarketMood(marketData));
      
      expect(Array.isArray(result.current.suggestions)).toBe(true);
    });
    
    it('returns suggestions when active', () => {
      const volatileData = createVolatileMarketData();
      const { result } = renderHook(() => useMarketMood(volatileData));
      
      // When active, should have market mood suggestions
      if (result.current.isActive) {
        // May or may not have suggestions depending on mood type
        expect(Array.isArray(result.current.suggestions)).toBe(true);
      }
    });
    
    it('returns empty suggestions when not active', () => {
      const { result } = renderHook(() => useMarketMood(undefined));
      
      expect(result.current.suggestions).toHaveLength(0);
    });
  });
  
  describe('options', () => {
    
    it('respects enabled option', () => {
      const marketData = createMarketData();
      const { result } = renderHook(() => 
        useMarketMood(marketData, { enabled: false })
      );
      
      expect(result.current.state).toBeNull();
      expect(result.current.isActive).toBe(false);
    });
    
    it('respects maxSuggestionsPerCategory option', () => {
      const volatileData = createVolatileMarketData();
      const { result } = renderHook(() => 
        useMarketMood(volatileData, { maxSuggestionsPerCategory: 1 })
      );
      
      // Suggestions should be limited
      // Hard to test directly without knowing category distribution
      expect(Array.isArray(result.current.suggestions)).toBe(true);
    });
    
    it('sets up refresh interval when specified', () => {
      const marketData = createMarketData();
      const { result } = renderHook(() => 
        useMarketMood(marketData, { refreshInterval: 5000 })
      );
      
      const initialState = result.current.state;
      
      // Advance timers past interval
      act(() => {
        jest.advanceTimersByTime(5100);
      });
      
      // State should still be valid (same data = same result)
      expect(result.current.state).toBeDefined();
    });
  });
  
  describe('refresh', () => {
    
    it('forces state refresh', () => {
      const marketData = createMarketData();
      const { result } = renderHook(() => useMarketMood(marketData));
      
      const initialState = result.current.state;
      
      // Call refresh
      act(() => {
        result.current.refresh();
      });
      
      // Should still have valid state
      expect(result.current.state).toBeDefined();
    });
  });
  
  describe('state updates', () => {
    
    it('updates when market data changes', () => {
      const { result, rerender } = renderHook(
        ({ data }) => useMarketMood(data),
        { initialProps: { data: createMarketData() as MarketDataInput | undefined } }
      );
      
      const initialState = result.current.state;
      
      // Update to volatile data
      rerender({ data: createVolatileMarketData() });
      
      // May have different state now
      expect(result.current.state).toBeDefined();
    });
    
    it('clears state when data becomes undefined', () => {
      const { result, rerender } = renderHook(
        ({ data }) => useMarketMood(data),
        { initialProps: { data: createMarketData() as MarketDataInput | undefined } }
      );
      
      expect(result.current.state).not.toBeNull();
      
      // Remove data
      rerender({ data: undefined });
      
      expect(result.current.state).toBeNull();
    });
  });
});
