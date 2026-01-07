// src/hooks/prompt-intelligence/__tests__/use-conflict-detection.test.ts
// ============================================================================
// USE CONFLICT DETECTION HOOK - Tests
// ============================================================================

import { renderHook, act, waitFor } from '@testing-library/react';
import { useConflictDetection } from '../use-conflict-detection';
import type { PromptCategory } from '@/types/prompt-builder';

// ============================================================================
// Tests
// ============================================================================

describe('useConflictDetection', () => {
  
  describe('initialization', () => {
    
    it('returns empty conflicts for empty selections', () => {
      const { result } = renderHook(() => useConflictDetection({}));
      
      expect(result.current.conflicts).toHaveLength(0);
      expect(result.current.hasConflicts).toBe(false);
      expect(result.current.hasHardConflicts).toBe(false);
      expect(result.current.hardCount).toBe(0);
      expect(result.current.softCount).toBe(0);
    });
    
    it('provides helper functions', () => {
      const { result } = renderHook(() => useConflictDetection({}));
      
      expect(typeof result.current.forCategory).toBe('function');
      expect(typeof result.current.forTerm).toBe('function');
      expect(typeof result.current.wouldConflict).toBe('function');
      expect(typeof result.current.redetect).toBe('function');
    });
  });
  
  describe('conflict detection', () => {
    
    it('detects hard conflicts', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['photorealistic', 'abstract'],
      };
      
      const { result } = renderHook(() => useConflictDetection(selections));
      
      expect(result.current.hasConflicts).toBe(true);
      expect(result.current.hasHardConflicts).toBe(true);
      expect(result.current.hardCount).toBeGreaterThan(0);
    });
    
    it('detects no conflicts for compatible selections', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
        lighting: ['neon lights'],
      };
      
      const { result } = renderHook(() => useConflictDetection(selections));
      
      expect(result.current.hasConflicts).toBe(false);
      expect(result.current.hasHardConflicts).toBe(false);
    });
    
    it('counts conflicts correctly', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['photorealistic', 'abstract'],
      };
      
      const { result } = renderHook(() => useConflictDetection(selections));
      
      const totalCount = result.current.hardCount + result.current.softCount;
      expect(result.current.conflicts.length).toBe(totalCount);
    });
  });
  
  describe('forCategory', () => {
    
    it('returns conflicts for specific category', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['photorealistic', 'abstract'],
      };
      
      const { result } = renderHook(() => useConflictDetection(selections));
      
      const styleConflicts = result.current.forCategory('style');
      expect(Array.isArray(styleConflicts)).toBe(true);
      
      // All returned conflicts should include 'style' category
      styleConflicts.forEach(conflict => {
        expect(conflict.categories).toContain('style');
      });
    });
    
    it('returns empty array for category with no conflicts', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => useConflictDetection(selections));
      
      const lightingConflicts = result.current.forCategory('lighting');
      expect(lightingConflicts).toHaveLength(0);
    });
  });
  
  describe('forTerm', () => {
    
    it('returns conflicts for specific term', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['photorealistic', 'abstract'],
      };
      
      const { result } = renderHook(() => useConflictDetection(selections));
      
      const photoConflicts = result.current.forTerm('photorealistic');
      expect(Array.isArray(photoConflicts)).toBe(true);
    });
    
    it('returns empty array for term with no conflicts', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => useConflictDetection(selections));
      
      const conflicts = result.current.forTerm('cyberpunk');
      expect(conflicts).toHaveLength(0);
    });
  });
  
  describe('wouldConflict', () => {
    
    it('returns no conflict for compatible addition', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => useConflictDetection(selections));
      
      const preview = result.current.wouldConflict('neon lights', 'lighting');
      expect(preview.wouldConflict).toBe(false);
      expect(preview.conflict).toBeNull();
    });
    
    it('detects conflict for incompatible addition', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['photorealistic'],
      };
      
      const { result } = renderHook(() => useConflictDetection(selections));
      
      const preview = result.current.wouldConflict('abstract', 'style');
      expect(preview.wouldConflict).toBe(true);
      expect(preview.conflict).not.toBeNull();
    });
    
    it('provides suggested alternatives', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['photorealistic'],
      };
      
      const { result } = renderHook(() => useConflictDetection(selections));
      
      const preview = result.current.wouldConflict('abstract', 'style');
      expect(Array.isArray(preview.suggestedAlternatives)).toBe(true);
    });
  });
  
  describe('options', () => {
    
    it('respects enabled option', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['photorealistic', 'abstract'],
      };
      
      const { result } = renderHook(() => 
        useConflictDetection(selections, { enabled: false })
      );
      
      expect(result.current.conflicts).toHaveLength(0);
      expect(result.current.hasConflicts).toBe(false);
    });
    
    it('respects includeSoftConflicts option', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['vintage style'],
        lighting: ['neon lights'],
      };
      
      const withSoft = renderHook(() => 
        useConflictDetection(selections, { includeSoftConflicts: true })
      );
      
      const withoutSoft = renderHook(() => 
        useConflictDetection(selections, { includeSoftConflicts: false })
      );
      
      // Without soft should have fewer or equal conflicts
      expect(withoutSoft.result.current.conflicts.length)
        .toBeLessThanOrEqual(withSoft.result.current.conflicts.length);
    });
  });
  
  describe('redetect', () => {
    
    it('forces re-detection', () => {
      const selections: Partial<Record<PromptCategory, string[]>> = {
        style: ['cyberpunk'],
      };
      
      const { result } = renderHook(() => useConflictDetection(selections));
      
      // Call redetect
      act(() => {
        result.current.redetect();
      });
      
      // Should still have same result (no conflicts)
      expect(result.current.hasConflicts).toBe(false);
    });
  });
  
  describe('state updates', () => {
    
    it('re-detects when selections change', () => {
      const { result, rerender } = renderHook(
        ({ selections }) => useConflictDetection(selections),
        { initialProps: { selections: { style: ['cyberpunk'] } as Partial<Record<PromptCategory, string[]>> } }
      );
      
      expect(result.current.hasConflicts).toBe(false);
      
      // Update to conflicting selections
      rerender({ selections: { style: ['photorealistic', 'abstract'] } });
      
      expect(result.current.hasConflicts).toBe(true);
    });
  });
});
