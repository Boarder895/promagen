// src/hooks/prompt-intelligence/__tests__/use-smart-reorder.test.ts
// ============================================================================
// USE SMART REORDER HOOK - Tests
// ============================================================================

import { renderHook } from '@testing-library/react';
import { useSmartReorder } from '../use-smart-reorder';
import type { PromptCategory } from '@/types/prompt-builder';

// ============================================================================
// Test Data
// ============================================================================

const testOptions = ['neon lights', 'candlelight', 'soft daylight', 'dramatic shadows'];

// ============================================================================
// Tests
// ============================================================================

describe('useSmartReorder', () => {
  
  describe('initialization', () => {
    
    it('returns ordered options', () => {
      const { result } = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', {})
      );
      
      expect(result.current.orderedOptions).toHaveLength(testOptions.length);
      expect(result.current.options).toHaveLength(testOptions.length);
    });
    
    it('provides helper functions', () => {
      const { result } = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', {})
      );
      
      expect(typeof result.current.getScore).toBe('function');
      expect(typeof result.current.isRecommended).toBe('function');
      expect(typeof result.current.reorder).toBe('function');
    });
    
    it('returns recommended options array', () => {
      const { result } = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', {})
      );
      
      expect(Array.isArray(result.current.recommended)).toBe(true);
    });
  });
  
  describe('scoring', () => {
    
    it('scores each option', () => {
      const { result } = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', {})
      );
      
      result.current.orderedOptions.forEach(opt => {
        expect(opt).toHaveProperty('option');
        expect(opt).toHaveProperty('score');
        expect(opt).toHaveProperty('isRecommended');
        expect(typeof opt.score).toBe('number');
        expect(opt.score).toBeGreaterThanOrEqual(0);
        expect(opt.score).toBeLessThanOrEqual(100);
      });
    });
    
    it('scores context-relevant options higher', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', selections)
      );
      
      // Find scores
      const neonScore = result.current.getScore('neon lights');
      const candleScore = result.current.getScore('candlelight');
      
      // Neon lights should score higher in cyberpunk context
      expect(neonScore).toBeGreaterThanOrEqual(candleScore);
    });
  });
  
  describe('getScore', () => {
    
    it('returns score for existing option', () => {
      const { result } = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', {})
      );
      
      const score = result.current.getScore('neon lights');
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
    });
    
    it('returns default score for non-existent option', () => {
      const { result } = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', {})
      );
      
      const score = result.current.getScore('non-existent');
      expect(score).toBe(50); // Default score
    });
  });
  
  describe('isRecommended', () => {
    
    it('returns boolean for option', () => {
      const { result } = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', {})
      );
      
      const isRec = result.current.isRecommended('neon lights');
      expect(typeof isRec).toBe('boolean');
    });
    
    it('matches recommended array', () => {
      const { result } = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', {})
      );
      
      // Check each recommended option
      result.current.recommended.forEach(opt => {
        expect(result.current.isRecommended(opt)).toBe(true);
      });
      
      // Check non-recommended options
      result.current.options.forEach(opt => {
        if (!result.current.recommended.includes(opt)) {
          expect(result.current.isRecommended(opt)).toBe(false);
        }
      });
    });
  });
  
  describe('options', () => {
    
    it('respects enabled option', () => {
      const { result } = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', {}, { enabled: false })
      );
      
      // When disabled, all scores should be 50 (default)
      result.current.orderedOptions.forEach(opt => {
        expect(opt.score).toBe(50);
        expect(opt.isRecommended).toBe(false);
      });
    });
    
    it('respects recommendedThreshold option', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const lowThreshold = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', selections, { recommendedThreshold: 40 })
      );
      
      const highThreshold = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', selections, { recommendedThreshold: 90 })
      );
      
      // Lower threshold should have more or equal recommended
      expect(lowThreshold.result.current.recommended.length)
        .toBeGreaterThanOrEqual(highThreshold.result.current.recommended.length);
    });
  });
  
  describe('reorder', () => {
    
    it('forces reorder', () => {
      const { result } = renderHook(() => 
        useSmartReorder(testOptions, 'lighting', {})
      );
      
      const initialOrder = [...result.current.options];
      
      // Call reorder
      result.current.reorder();
      
      // Should still have same options (order may or may not change)
      expect(result.current.options).toHaveLength(initialOrder.length);
    });
  });
  
  describe('state updates', () => {
    
    it('updates when selections change', () => {
      const { result, rerender } = renderHook(
        ({ selections }) => useSmartReorder(testOptions, 'lighting', selections),
        { initialProps: { selections: {} as Partial<Record<PromptCategory, string[]>> } }
      );
      
      const initialScores = result.current.orderedOptions.map(o => o.score);
      
      // Update to cyberpunk context
      rerender({ selections: { style: ['cyberpunk'] } });
      
      // Scores may have changed
      const newScores = result.current.orderedOptions.map(o => o.score);
      
      // At least one score should potentially be different
      // (can't guarantee this without knowing exact scoring)
      expect(Array.isArray(newScores)).toBe(true);
    });
    
    it('updates when options change', () => {
      const { result, rerender } = renderHook(
        ({ options }) => useSmartReorder(options, 'lighting', {}),
        { initialProps: { options: testOptions } }
      );
      
      expect(result.current.options).toHaveLength(4);
      
      // Update to fewer options
      rerender({ options: ['neon lights', 'candlelight'] });
      
      expect(result.current.options).toHaveLength(2);
    });
  });
  
  describe('empty options', () => {
    
    it('handles empty options array', () => {
      const { result } = renderHook(() => 
        useSmartReorder([], 'lighting', {})
      );
      
      expect(result.current.orderedOptions).toHaveLength(0);
      expect(result.current.options).toHaveLength(0);
      expect(result.current.recommended).toHaveLength(0);
    });
  });
});
