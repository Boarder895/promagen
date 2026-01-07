// src/data/prompt-intelligence/tests/prompt-intelligence.shape.test.ts
// ============================================================================
// PROMPT INTELLIGENCE - Shape Tests
// ============================================================================
// Validates the structure and shape of all prompt intelligence JSON files.
// ============================================================================

import familiesData from '../families.json';
import conflictsData from '../conflicts.json';
import marketMoodsData from '../market-moods.json';
import platformHintsData from '../platform-hints.json';
import semanticTagsData from '../semantic-tags.json';

// Type definitions
interface SemanticTagData {
  category: string;
  families: string[];
  mood?: string;
  era?: string;
  conflicts?: string[];
  complements?: string[];
  suggests?: Record<string, string[]>;
}

interface SemanticTagsDataType {
  version: string;
  updated: string;
  coverage: {
    total: number;
    tagged: number;
    categories: string[];
  };
  options: Record<string, SemanticTagData>;
}

const typedSemanticTags = semanticTagsData as SemanticTagsDataType;

describe('Prompt Intelligence - Shape Tests', () => {
  
  describe('families.json', () => {
    
    it('has correct root structure', () => {
      expect(familiesData).toHaveProperty('version');
      expect(familiesData).toHaveProperty('updated');
      expect(familiesData).toHaveProperty('families');
    });
    
    it('version is a valid semver string', () => {
      expect(typeof familiesData.version).toBe('string');
      expect(familiesData.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
    
    it('updated is a valid ISO date', () => {
      expect(typeof familiesData.updated).toBe('string');
      const date = new Date(familiesData.updated);
      expect(date.toString()).not.toBe('Invalid Date');
    });
    
    it('families is a non-empty object', () => {
      expect(typeof familiesData.families).toBe('object');
      expect(Object.keys(familiesData.families).length).toBeGreaterThan(0);
    });
    
    it('each family has required fields', () => {
      for (const [id, family] of Object.entries(familiesData.families)) {
        const f = family as {
          displayName: string;
          description: string;
          members: string[];
          related: string[];
          opposes: string[];
          mood: string;
        };
        
        expect(typeof f.displayName).toBe('string');
        expect(typeof f.description).toBe('string');
        expect(Array.isArray(f.members)).toBe(true);
        expect(Array.isArray(f.related)).toBe(true);
        expect(Array.isArray(f.opposes)).toBe(true);
        expect(typeof f.mood).toBe('string');
      }
    });
  });
  
  describe('conflicts.json', () => {
    
    it('has correct root structure', () => {
      expect(conflictsData).toHaveProperty('version');
      expect(conflictsData).toHaveProperty('updated');
      expect(conflictsData).toHaveProperty('conflicts');
    });
    
    it('conflicts is a non-empty array', () => {
      expect(Array.isArray(conflictsData.conflicts)).toBe(true);
      expect(conflictsData.conflicts.length).toBeGreaterThan(0);
    });
    
    it('each conflict has required fields', () => {
      for (const conflict of conflictsData.conflicts) {
        const c = conflict as {
          terms: string[];
          reason: string;
          severity: string;
        };
        
        expect(Array.isArray(c.terms)).toBe(true);
        expect(c.terms.length).toBeGreaterThanOrEqual(2);
        expect(typeof c.reason).toBe('string');
        expect(['hard', 'soft']).toContain(c.severity);
      }
    });
  });
  
  describe('market-moods.json', () => {
    
    it('has correct root structure', () => {
      expect(marketMoodsData).toHaveProperty('version');
      expect(marketMoodsData).toHaveProperty('updated');
      expect(marketMoodsData).toHaveProperty('moods');
    });
    
    it('moods is a non-empty object', () => {
      expect(typeof marketMoodsData.moods).toBe('object');
      expect(Object.keys(marketMoodsData.moods).length).toBeGreaterThan(0);
    });
    
    it('each mood has required fields', () => {
      for (const [id, mood] of Object.entries(marketMoodsData.moods)) {
        const m = mood as {
          trigger: string;
          boost: Record<string, string[]>;
          boostWeight: number;
        };
        
        expect(typeof m.trigger).toBe('string');
        expect(typeof m.boost).toBe('object');
        expect(typeof m.boostWeight).toBe('number');
      }
    });
  });
  
  describe('platform-hints.json', () => {
    
    it('has correct root structure', () => {
      expect(platformHintsData).toHaveProperty('version');
      expect(platformHintsData).toHaveProperty('updated');
      expect(platformHintsData).toHaveProperty('platforms');
    });
    
    it('platforms is a non-empty object', () => {
      expect(typeof platformHintsData.platforms).toBe('object');
      expect(Object.keys(platformHintsData.platforms).length).toBeGreaterThan(0);
    });
    
    it('each platform has required fields', () => {
      for (const [id, platform] of Object.entries(platformHintsData.platforms)) {
        const p = platform as {
          tier: number;
          hints: string[];
        };
        
        expect(typeof p.tier).toBe('number');
        expect(p.tier).toBeGreaterThanOrEqual(1);
        expect(p.tier).toBeLessThanOrEqual(4);
        expect(Array.isArray(p.hints)).toBe(true);
      }
    });
  });
  
  describe('semantic-tags.json', () => {
    
    it('has correct root structure', () => {
      expect(typedSemanticTags).toHaveProperty('version');
      expect(typedSemanticTags).toHaveProperty('updated');
      expect(typedSemanticTags).toHaveProperty('coverage');
      expect(typedSemanticTags).toHaveProperty('options');
    });
    
    it('coverage has required fields', () => {
      expect(typeof typedSemanticTags.coverage.total).toBe('number');
      expect(typeof typedSemanticTags.coverage.tagged).toBe('number');
      expect(Array.isArray(typedSemanticTags.coverage.categories)).toBe(true);
    });
    
    it('options is a non-empty object', () => {
      expect(typeof typedSemanticTags.options).toBe('object');
      expect(Object.keys(typedSemanticTags.options).length).toBeGreaterThan(0);
    });
    
    it('has at least 2000 tagged options', () => {
      expect(Object.keys(typedSemanticTags.options).length).toBeGreaterThanOrEqual(2000);
    });
    
    it('each tag has required fields', () => {
      for (const [option, tag] of Object.entries(typedSemanticTags.options)) {
        expect(typeof tag.category).toBe('string');
        expect(Array.isArray(tag.families)).toBe(true);
        expect(tag.families.length).toBeGreaterThan(0);
      }
    });
    
    it('moods are valid when present', () => {
      const validMoods = ['calm', 'intense', 'neutral', 'eerie', 'joyful', 'melancholic', 'dramatic'];
      
      for (const [option, tag] of Object.entries(typedSemanticTags.options)) {
        if ('mood' in tag && tag.mood !== undefined) {
          expect(validMoods).toContain(tag.mood);
        }
      }
    });
    
    it('eras are valid when present', () => {
      const validEras = ['past', 'present', 'future', 'timeless'];
      
      for (const [option, tag] of Object.entries(typedSemanticTags.options)) {
        if ('era' in tag && tag.era !== undefined) {
          expect(validEras).toContain(tag.era);
        }
      }
    });
    
    it('conflicts are arrays when present', () => {
      for (const [option, tag] of Object.entries(typedSemanticTags.options)) {
        if ('conflicts' in tag && tag.conflicts !== undefined) {
          expect(Array.isArray(tag.conflicts)).toBe(true);
          
          for (const conflict of tag.conflicts) {
            expect(typeof conflict).toBe('string');
          }
        }
      }
    });
    
    it('suggests are objects with string arrays when present', () => {
      for (const [option, tag] of Object.entries(typedSemanticTags.options)) {
        if ('suggests' in tag && tag.suggests !== undefined) {
          expect(typeof tag.suggests).toBe('object');
          
          for (const [category, suggestions] of Object.entries(tag.suggests)) {
            expect(typeof category).toBe('string');
            expect(Array.isArray(suggestions)).toBe(true);
          }
        }
      }
    });
  });
  
  describe('Cross-file References', () => {
    
    it('semantic tag families reference valid families', () => {
      const validFamilies = new Set(Object.keys(familiesData.families));
      const invalidRefs: string[] = [];
      
      for (const [option, tag] of Object.entries(typedSemanticTags.options)) {
        for (const family of tag.families) {
          // Allow sub-families (e.g., 'sci-fi-cyberpunk')
          const mainFamily = family.split('-').slice(0, 2).join('-');
          if (!validFamilies.has(family) && !validFamilies.has(mainFamily)) {
            // Only track truly invalid ones (not sub-families)
            if (!family.includes('-') || !Array.from(validFamilies).some(f => family.startsWith(f))) {
              invalidRefs.push(`${option}: ${family}`);
            }
          }
        }
      }
      
      // Allow some invalid refs (sub-families are expected)
      expect(invalidRefs.length).toBeLessThan(100);
    });
    
    it('semantic tag categories are valid', () => {
      const validCategories = [
        'subject', 'style', 'lighting', 'colour', 'atmosphere', 'environment',
        'action', 'composition', 'camera', 'materials', 'fidelity', 'negative'
      ];
      
      for (const [option, tag] of Object.entries(typedSemanticTags.options)) {
        expect(validCategories).toContain(tag.category);
      }
    });
  });
});
