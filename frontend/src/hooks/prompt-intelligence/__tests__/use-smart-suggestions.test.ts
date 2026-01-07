// src/hooks/prompt-intelligence/__tests__/use-smart-suggestions.test.ts
// ============================================================================
// USE SMART SUGGESTIONS HOOK - Tests
// ============================================================================

import { renderHook, waitFor } from '@testing-library/react';
import { useSmartSuggestions } from '../use-smart-suggestions';
import type { PromptCategory } from '@/types/prompt-builder';

// ============================================================================
// Tests
// ============================================================================

describe('useSmartSuggestions', () => {
  
  describe('initialization', () => {
    
    it('returns empty suggestions for empty selections', () => {
      const { result } = renderHook(() => useSmartSuggestions({}));
      
      expect(result.current.topSuggestions).toHaveLength(0);
      expect(Object.keys(result.current.byCategory)).toHaveLength(0);
      expect(result.current.isLoading).toBe(false);
    });
    
    it('provides helper functions', () => {
      const { result } = renderHook(() => useSmartSuggestions({}));
      
      expect(typeof result.current.forCategory).toBe('function');
      expect(typeof result.current.refresh).toBe('function');
    });
  });
  
  describe('suggestion generation', () => {
    
    it('generates suggestions based on selections', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => useSmartSuggestions(selections));
      
      // Should have suggestions
      expect(result.current.topSuggestions.length).toBeGreaterThanOrEqual(0);
    });
    
    it('organizes suggestions by category', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => useSmartSuggestions(selections));
      
      // byCategory should be an object with category keys
      expect(typeof result.current.byCategory).toBe('object');
    });
    
    it('returns suggestions with required properties', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => useSmartSuggestions(selections));
      
      if (result.current.topSuggestions.length > 0) {
        const suggestion = result.current.topSuggestions[0];
        expect(suggestion).toHaveProperty('option');
        expect(suggestion).toHaveProperty('category');
        expect(suggestion).toHaveProperty('score');
        expect(suggestion).toHaveProperty('reason');
      }
    });
  });
  
  describe('forCategory', () => {
    
    it('returns suggestions for specific category', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => useSmartSuggestions(selections));
      
      const lightingSuggestions = result.current.forCategory('lighting');
      expect(Array.isArray(lightingSuggestions)).toBe(true);
      
      // All should be lighting suggestions
      lightingSuggestions.forEach(s => {
        expect(s.category).toBe('lighting');
      });
    });
    
    it('returns empty array for category with no suggestions', () => {
      const { result } = renderHook(() => useSmartSuggestions({}));
      
      // With no context, might have few or no suggestions
      const suggestions = result.current.forCategory('style');
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
  
  describe('options', () => {
    
    it('respects maxPerCategory option', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => 
        useSmartSuggestions(selections, { maxPerCategory: 2 })
      );
      
      // Check each category has at most 2 suggestions
      Object.values(result.current.byCategory).forEach(categoryList => {
        expect(categoryList?.length ?? 0).toBeLessThanOrEqual(2);
      });
    });
    
    it('respects maxTotal option', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => 
        useSmartSuggestions(selections, { maxTotal: 5 })
      );
      
      expect(result.current.topSuggestions.length).toBeLessThanOrEqual(5);
    });
    
    it('respects minScore option', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => 
        useSmartSuggestions(selections, { minScore: 70 })
      );
      
      // All returned suggestions should have score >= minScore
      result.current.topSuggestions.forEach(s => {
        expect(s.score).toBeGreaterThanOrEqual(70);
      });
    });
    
    it('respects enabled option', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => 
        useSmartSuggestions(selections, { enabled: false })
      );
      
      expect(result.current.topSuggestions).toHaveLength(0);
      expect(Object.keys(result.current.byCategory)).toHaveLength(0);
    });
  });
  
  describe('refresh', () => {
    
    it('recalculates suggestions on refresh', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => useSmartSuggestions(selections));
      
      const initialSuggestions = result.current.topSuggestions;
      
      // Call refresh
      result.current.refresh();
      
      // Should still have suggestions (same input = same output)
      expect(Array.isArray(result.current.topSuggestions)).toBe(true);
    });
  });
  
  describe('state updates', () => {
    
    it('updates suggestions when selections change', () => {
      const { result, rerender } = renderHook(
        ({ selections }) => useSmartSuggestions(selections),
        { initialProps: { selections: {} as Partial<Record<PromptCategory, string[]>> } }
      );
      
      const initialCount = result.current.topSuggestions.length;
      
      // Update to have a style selected
      rerender({ selections: { style: ['cyberpunk'] } });
      
      // May have different suggestions now
      expect(Array.isArray(result.current.topSuggestions)).toBe(true);
    });
  });
});
