// src/hooks/prompt-intelligence/__tests__/use-prompt-analysis.test.ts
// ============================================================================
// USE PROMPT ANALYSIS HOOK - Tests
// ============================================================================

import { renderHook, act, waitFor } from '@testing-library/react';
import { usePromptAnalysis } from '../use-prompt-analysis';
import type { PromptState } from '@/lib/prompt-intelligence';

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

// ============================================================================
// Tests
// ============================================================================

describe('usePromptAnalysis', () => {
  
  beforeEach(() => {
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  describe('initialization', () => {
    
    it('returns null analysis initially', () => {
      const state = createTestState();
      const { result } = renderHook(() => usePromptAnalysis(state));
      
      // Before debounce fires
      expect(result.current.analysis).toBeNull();
    });
    
    it('returns default values before analysis completes', () => {
      const state = createTestState();
      const { result } = renderHook(() => usePromptAnalysis(state));
      
      expect(result.current.healthScore).toBe(0);
      expect(result.current.conflictCount).toBe(0);
      expect(result.current.fillPercent).toBe(0);
      expect(result.current.hasHardConflicts).toBe(false);
    });
    
    it('provides reanalyze function', () => {
      const state = createTestState();
      const { result } = renderHook(() => usePromptAnalysis(state));
      
      expect(typeof result.current.reanalyze).toBe('function');
    });
  });
  
  describe('analysis after debounce', () => {
    
    it('performs analysis after debounce delay', async () => {
      const state = createTestState({
        subject: 'a cyberpunk warrior',
        selections: { style: ['cyberpunk'] },
      });
      
      const { result } = renderHook(() => usePromptAnalysis(state, { debounceMs: 100 }));
      
      // Fast-forward past debounce
      act(() => {
        jest.advanceTimersByTime(150);
      });
      
      await waitFor(() => {
        expect(result.current.analysis).not.toBeNull();
      });
    });
    
    it('calculates health score', async () => {
      const state = createTestState({
        subject: 'a cyberpunk warrior',
        selections: { style: ['cyberpunk'], lighting: ['neon lights'] },
      });
      
      const { result } = renderHook(() => usePromptAnalysis(state, { debounceMs: 50 }));
      
      act(() => {
        jest.advanceTimersByTime(100);
      });
      
      await waitFor(() => {
        expect(result.current.healthScore).toBeGreaterThan(0);
      });
    });
    
    it('detects conflicts', async () => {
      const state = createTestState({
        selections: { style: ['photorealistic', 'abstract'] },
      });
      
      const { result } = renderHook(() => usePromptAnalysis(state, { debounceMs: 50 }));
      
      act(() => {
        jest.advanceTimersByTime(100);
      });
      
      await waitFor(() => {
        expect(result.current.conflictCount).toBeGreaterThan(0);
        expect(result.current.hasHardConflicts).toBe(true);
      });
    });
    
    it('calculates fill percent', async () => {
      const state = createTestState({
        selections: {
          style: ['cyberpunk'],
          lighting: ['neon lights'],
          colour: ['neon pink'],
        },
      });
      
      const { result } = renderHook(() => usePromptAnalysis(state, { debounceMs: 50 }));
      
      act(() => {
        jest.advanceTimersByTime(100);
      });
      
      await waitFor(() => {
        expect(result.current.fillPercent).toBe(30); // 3/10 categories
      });
    });
  });
  
  describe('options', () => {
    
    it('respects enabled option', async () => {
      const state = createTestState({
        subject: 'test',
        selections: { style: ['cyberpunk'] },
      });
      
      const { result } = renderHook(() => usePromptAnalysis(state, { enabled: false }));
      
      act(() => {
        jest.advanceTimersByTime(500);
      });
      
      // Should remain null when disabled
      expect(result.current.analysis).toBeNull();
    });
    
    it('uses custom debounce delay', async () => {
      const state = createTestState({
        subject: 'test',
        selections: { style: ['cyberpunk'] },
      });
      
      const { result } = renderHook(() => usePromptAnalysis(state, { debounceMs: 500 }));
      
      // After 200ms, should still be null
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(result.current.analysis).toBeNull();
      
      // After 500ms, should have analysis
      act(() => {
        jest.advanceTimersByTime(350);
      });
      
      await waitFor(() => {
        expect(result.current.analysis).not.toBeNull();
      });
    });
  });
  
  describe('reanalyze', () => {
    
    it('forces immediate analysis', async () => {
      const state = createTestState({
        subject: 'test',
        selections: { style: ['cyberpunk'] },
      });
      
      const { result } = renderHook(() => usePromptAnalysis(state, { debounceMs: 1000 }));
      
      // Call reanalyze immediately
      act(() => {
        result.current.reanalyze();
      });
      
      await waitFor(() => {
        expect(result.current.analysis).not.toBeNull();
      });
    });
  });
  
  describe('state updates', () => {
    
    it('re-analyzes when selections change', async () => {
      const initialState = createTestState({
        selections: { style: ['cyberpunk'] },
      });
      
      const { result, rerender } = renderHook(
        ({ state }) => usePromptAnalysis(state, { debounceMs: 50 }),
        { initialProps: { state: initialState } }
      );
      
      act(() => {
        jest.advanceTimersByTime(100);
      });
      
      await waitFor(() => {
        expect(result.current.analysis).not.toBeNull();
      });
      
      const firstAnalysis = result.current.analysis;
      
      // Update state
      const newState = createTestState({
        selections: { style: ['cyberpunk', 'neon noir'] },
      });
      
      rerender({ state: newState });
      
      act(() => {
        jest.advanceTimersByTime(100);
      });
      
      await waitFor(() => {
        expect(result.current.analysis).not.toBe(firstAnalysis);
      });
    });
  });
});
