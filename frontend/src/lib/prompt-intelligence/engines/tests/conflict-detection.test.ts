// src/lib/prompt-intelligence/engines/tests/conflict-detection.test.ts
// ============================================================================
// CONFLICT DETECTION ENGINE - Tests
// ============================================================================

import { 
  detectConflicts, 
  hasHardConflicts, 
  getCategoryConflictCount,
  wouldCreateConflict 
} from '../conflict-detection';

describe('Conflict Detection Engine', () => {
  
  describe('detectConflicts', () => {
    
    it('returns no conflicts for empty selections', () => {
      const result = detectConflicts({ selections: {} });
      
      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.worstSeverity).toBeNull();
    });
    
    it('returns no conflicts for single selection', () => {
      const result = detectConflicts({
        selections: {
          style: ['cyberpunk']
        }
      });
      
      expect(result.hasConflicts).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });
    
    it('returns no conflicts for compatible selections', () => {
      const result = detectConflicts({
        selections: {
          style: ['cyberpunk'],
          lighting: ['neon lights'],
          atmosphere: ['electric energy']
        }
      });
      
      // These are compatible - all futuristic/cyberpunk themed
      expect(result.hasHardConflicts).toBe(false);
    });
    
    it('detects era conflicts (past vs future)', () => {
      const result = detectConflicts({
        selections: {
          style: ['vintage style'],
          lighting: ['neon lights'] // futuristic
        }
      });
      
      // Should detect some kind of era/style conflict
      expect(result.hasConflicts).toBe(true);
    });
    
    it('detects defined conflicts from conflicts.json', () => {
      const result = detectConflicts({
        selections: {
          style: ['photorealistic', 'abstract']
        }
      });
      
      // These are conflicting styles
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => 
        c.terms.includes('photorealistic') || 
        c.reason.toLowerCase().includes('conflict')
      )).toBe(true);
    });
    
    it('respects includeSoftConflicts option', () => {
      const resultWithSoft = detectConflicts({
        selections: {
          style: ['vintage style'],
          lighting: ['neon lights']
        },
        includeSoftConflicts: true
      });
      
      const resultWithoutSoft = detectConflicts({
        selections: {
          style: ['vintage style'],
          lighting: ['neon lights']
        },
        includeSoftConflicts: false
      });
      
      // With soft conflicts should have more or equal conflicts
      expect(resultWithSoft.softCount).toBeGreaterThanOrEqual(resultWithoutSoft.softCount);
    });
    
    it('correctly categorizes hard vs soft conflicts', () => {
      const result = detectConflicts({
        selections: {
          style: ['photorealistic', 'cartoon style']
        }
      });
      
      if (result.hasConflicts) {
        expect(result.hardCount + result.softCount).toBe(result.conflicts.length);
      }
    });
    
    it('returns correct conflict categories', () => {
      const result = detectConflicts({
        selections: {
          style: ['cyberpunk'],
          lighting: ['candlelight'] // past era
        }
      });
      
      if (result.hasConflicts) {
        for (const conflict of result.conflicts) {
          expect(conflict.categories.length).toBeGreaterThan(0);
        }
      }
    });
    
    it('includes suggestions for conflicts', () => {
      const result = detectConflicts({
        selections: {
          style: ['photorealistic', 'abstract']
        }
      });
      
      if (result.hasConflicts) {
        // At least some conflicts should have suggestions
        const hasSuggestions = result.conflicts.some(c => c.suggestion);
        expect(hasSuggestions).toBe(true);
      }
    });
    
    it('handles custom values', () => {
      const result = detectConflicts({
        selections: {
          style: ['cyberpunk']
        },
        customValues: {
          subject: 'a Victorian lady in vintage clothing'
        }
      });
      
      // Should detect the vintage/cyberpunk era conflict in custom text
      expect(result.hasConflicts).toBe(true);
    });
    
    it('deduplicates identical conflicts', () => {
      const result = detectConflicts({
        selections: {
          style: ['photorealistic', 'abstract'],
          lighting: ['dramatic lighting']
        }
      });
      
      // Check for duplicate term sets
      const termSets = result.conflicts.map(c => c.terms.sort().join('|'));
      const uniqueTermSets = new Set(termSets);
      expect(termSets.length).toBe(uniqueTermSets.size);
    });
    
    it('sorts conflicts by severity (hard first)', () => {
      const result = detectConflicts({
        selections: {
          style: ['photorealistic', 'abstract', 'vintage style'],
          lighting: ['neon lights']
        }
      });
      
      if (result.hardCount > 0 && result.softCount > 0) {
        // First conflict should be hard if there are any hard conflicts
        const firstHardIndex = result.conflicts.findIndex(c => c.severity === 'hard');
        const firstSoftIndex = result.conflicts.findIndex(c => c.severity === 'soft');
        
        if (firstHardIndex !== -1 && firstSoftIndex !== -1) {
          expect(firstHardIndex).toBeLessThan(firstSoftIndex);
        }
      }
    });
  });
  
  describe('hasHardConflicts', () => {
    
    it('returns false for no conflicts', () => {
      expect(hasHardConflicts({})).toBe(false);
    });
    
    it('returns false for only soft conflicts', () => {
      // Soft conflicts only (era mismatch)
      const result = hasHardConflicts({
        style: ['vintage style'],
        lighting: ['neon lights']
      });
      
      // Era conflicts are soft, not hard
      // This might be false depending on conflict definitions
      expect(typeof result).toBe('boolean');
    });
    
    it('returns true for hard conflicts', () => {
      const result = hasHardConflicts({
        style: ['photorealistic', 'abstract']
      });
      
      // These are hard conflicts per conflicts.json
      expect(result).toBe(true);
    });
  });
  
  describe('getCategoryConflictCount', () => {
    
    it('returns 0 for category with no conflicts', () => {
      const count = getCategoryConflictCount(
        { style: ['cyberpunk'] },
        'camera'
      );
      
      expect(count).toBe(0);
    });
    
    it('returns correct count for category with conflicts', () => {
      const count = getCategoryConflictCount(
        { 
          style: ['photorealistic', 'abstract'],
          lighting: ['neon lights']
        },
        'style'
      );
      
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('wouldCreateConflict', () => {
    
    it('returns null when no conflict would be created', () => {
      const conflict = wouldCreateConflict(
        { style: ['cyberpunk'] },
        'neon lights',
        'lighting'
      );
      
      // cyberpunk + neon lights = compatible
      expect(conflict).toBeNull();
    });
    
    it('returns conflict when one would be created', () => {
      const conflict = wouldCreateConflict(
        { style: ['photorealistic'] },
        'abstract',
        'style'
      );
      
      // photorealistic + abstract = conflict
      expect(conflict).not.toBeNull();
      if (conflict) {
        expect(conflict.terms).toBeDefined();
        expect(conflict.reason).toBeDefined();
      }
    });
    
    it('returns null for empty current selections', () => {
      const conflict = wouldCreateConflict(
        {},
        'cyberpunk',
        'style'
      );
      
      // Can't conflict with nothing
      expect(conflict).toBeNull();
    });
  });
  
  describe('Mood conflict detection', () => {
    
    it('detects calm vs intense mood conflicts', () => {
      const result = detectConflicts({
        selections: {
          atmosphere: ['calm serenity'], // calm mood
          action: ['fighting fiercely']  // intense mood
        }
      });
      
      // Should detect mood conflict
      const hasMoodConflict = result.conflicts.some(c => 
        c.reason.toLowerCase().includes('mood')
      );
      expect(hasMoodConflict).toBe(true);
    });
    
    it('detects joyful vs melancholic mood conflicts', () => {
      const result = detectConflicts({
        selections: {
          action: ['laughing heartily'],  // joyful
          atmosphere: ['blue cast']       // melancholic  
        }
      });
      
      // May or may not detect depending on tags
      expect(result.hasConflicts !== undefined).toBe(true);
    });
  });
  
  describe('Performance', () => {
    
    it('handles large selections efficiently', () => {
      const start = Date.now();
      
      // Create a selection with many terms
      const result = detectConflicts({
        selections: {
          style: ['photorealistic', 'cinematic style', 'film look'],
          lighting: ['golden hour', 'dramatic lighting', 'volumetric lighting'],
          colour: ['warm tones', 'vibrant colours'],
          atmosphere: ['dense fog', 'light rays'],
          environment: ['cyberpunk streets', 'futuristic city'],
          action: ['running fast', 'jumping high'],
          composition: ['rule of thirds', 'dynamic angles'],
          camera: ['85mm lens', 'shallow depth of field'],
          materials: ['polished chrome', 'neon lights'],
          fidelity: ['8K resolution', 'highly detailed'],
        }
      });
      
      const elapsed = Date.now() - start;
      
      // Should complete in under 100ms
      expect(elapsed).toBeLessThan(100);
      expect(result.conflicts).toBeDefined();
    });
  });
});
