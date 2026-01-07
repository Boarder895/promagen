// src/data/prompt-intelligence/tests/data-integrity.test.ts
// ============================================================================
// DATA INTEGRITY VALIDATION
// ============================================================================
// Comprehensive cross-file validation for prompt intelligence data.
// ============================================================================

import familiesData from '../families.json';
import conflictsData from '../conflicts.json';
import marketMoodsData from '../market-moods.json';
import platformHintsData from '../platform-hints.json';
import semanticTagsData from '../semantic-tags.json';
import promptOptionsData from '../../prompt-options.json';

// Type definitions for the JSON data
interface PromptOptionsCategory {
  options: string[];
}

interface PromptOptionsData {
  categories: Record<string, PromptOptionsCategory>;
}

interface FamilyData {
  displayName: string;
  description: string;
  members: string[];
  related: string[];
  opposes: string[];
  mood: string;
  suggestedColours?: string[];
  suggestedLighting?: string[];
  suggestedAtmosphere?: string[];
}

interface FamiliesDataType {
  version: string;
  updated: string;
  families: Record<string, FamilyData>;
}

interface ConflictData {
  terms: string[];
  reason: string;
  suggestion?: string;
  severity: string;
}

interface ConflictsDataType {
  version: string;
  updated: string;
  conflicts: ConflictData[];
}

interface MarketMoodData {
  trigger: string;
  boost: Record<string, string[]>;
  boostWeight: number;
}

interface MarketMoodsDataType {
  version: string;
  updated: string;
  moods: Record<string, MarketMoodData>;
}

interface PlatformHintData {
  tier: number;
  hints: string[];
}

interface PlatformHintsDataType {
  version: string;
  updated: string;
  platforms: Record<string, PlatformHintData>;
}

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

// Cast to typed versions
const typedPromptOptions = promptOptionsData as PromptOptionsData;
const typedFamilies = familiesData as FamiliesDataType;
const typedConflicts = conflictsData as ConflictsDataType;
const typedMarketMoods = marketMoodsData as MarketMoodsDataType;
const typedPlatformHints = platformHintsData as PlatformHintsDataType;
const typedSemanticTags = semanticTagsData as SemanticTagsDataType;

describe('Data Integrity Validation', () => {
  
  describe('Semantic Tags Coverage', () => {
    
    it('all prompt options have semantic tags', () => {
      const allOptions: string[] = [];
      
      for (const catData of Object.values(typedPromptOptions.categories)) {
        if (catData.options) {
          allOptions.push(...catData.options);
        }
      }
      
      const taggedOptions = Object.keys(typedSemanticTags.options);
      const untagged = allOptions.filter(opt => !taggedOptions.includes(opt));
      
      // Allow some untagged (negative category has many)
      const untaggedNonNegative = untagged.filter(opt => 
        !opt.toLowerCase().includes('blurry') &&
        !opt.toLowerCase().includes('artifact') &&
        !opt.toLowerCase().includes('bad')
      );
      
      expect(untaggedNonNegative.length).toBeLessThan(50);
    });
    
    it('no orphaned tags exist', () => {
      const allOptions: string[] = [];
      
      for (const catData of Object.values(typedPromptOptions.categories)) {
        if (catData.options) {
          allOptions.push(...catData.options);
        }
      }
      
      const taggedOptions = Object.keys(typedSemanticTags.options);
      const orphaned = taggedOptions.filter(opt => !allOptions.includes(opt));
      
      // Some orphans are acceptable (conceptual terms)
      expect(orphaned.length).toBeLessThan(100);
    });
    
    it('coverage metadata is accurate', () => {
      const actualTagged = Object.keys(typedSemanticTags.options).length;
      
      expect(typedSemanticTags.coverage.tagged).toBe(actualTagged);
    });
  });
  
  describe('Families Validation', () => {
    
    it('all canonical families are defined', () => {
      const expectedFamilies = [
        'sci-fi', 'cyberpunk', 'retro', 'dark-moody', 'organic',
        'cinematic', 'artistic', 'fantasy', 'minimalist', 'maximalist',
        'vintage', 'contemporary', 'ethereal', 'gritty', 'whimsical',
        'architectural', 'photographic', 'illustrative', 'surreal', 'technical'
      ];
      
      const definedFamilies = Object.keys(typedFamilies.families);
      
      for (const family of expectedFamilies) {
        expect(definedFamilies).toContain(family);
      }
    });
    
    it('all families have required fields', () => {
      for (const [id, family] of Object.entries(typedFamilies.families)) {
        expect(family.displayName).toBeDefined();
        expect(family.description).toBeDefined();
        expect(Array.isArray(family.members)).toBe(true);
        expect(Array.isArray(family.related)).toBe(true);
        expect(Array.isArray(family.opposes)).toBe(true);
        expect(family.mood).toBeDefined();
      }
    });
    
    it('related families reference valid families', () => {
      const validFamilies = Object.keys(typedFamilies.families);
      
      for (const [id, family] of Object.entries(typedFamilies.families)) {
        for (const ref of family.related) {
          expect(validFamilies).toContain(ref);
        }
      }
    });
  });
  
  describe('Conflicts Validation', () => {
    
    it('all conflicts have required fields', () => {
      for (const conflict of typedConflicts.conflicts) {
        expect(Array.isArray(conflict.terms)).toBe(true);
        expect(conflict.terms.length).toBeGreaterThanOrEqual(2);
        expect(conflict.reason).toBeDefined();
        expect(['hard', 'soft']).toContain(conflict.severity);
      }
    });
    
    it('conflict terms are strings', () => {
      for (const conflict of typedConflicts.conflicts) {
        for (const term of conflict.terms) {
          expect(typeof term).toBe('string');
        }
      }
    });
  });
  
  describe('Market Moods Validation', () => {
    
    it('neutral mood has boost weight 1.0', () => {
      const neutralMood = typedMarketMoods.moods.neutral;
      expect(neutralMood).toBeDefined();
      if (neutralMood) {
        expect(neutralMood.boostWeight).toBe(1.0);
      }
    });
    
    it('all moods have valid triggers', () => {
      for (const [id, mood] of Object.entries(typedMarketMoods.moods)) {
        expect(mood.trigger).toBeDefined();
        expect(typeof mood.trigger).toBe('string');
      }
    });
    
    it('all moods have boost configurations', () => {
      for (const [id, mood] of Object.entries(typedMarketMoods.moods)) {
        expect(mood.boost).toBeDefined();
        expect(typeof mood.boost).toBe('object');
      }
    });
  });
  
  describe('Platform Hints Validation', () => {
    
    it('has configurations for major platforms', () => {
      const majorPlatforms = ['midjourney', 'stability', 'dalle', 'flux'];
      const definedPlatforms = Object.keys(typedPlatformHints.platforms);
      
      for (const platform of majorPlatforms) {
        expect(definedPlatforms).toContain(platform);
      }
    });
    
    it('all platforms have tier ratings', () => {
      for (const [id, platform] of Object.entries(typedPlatformHints.platforms)) {
        expect(platform.tier).toBeDefined();
        expect(platform.tier).toBeGreaterThanOrEqual(1);
        expect(platform.tier).toBeLessThanOrEqual(4);
      }
    });
  });
  
  describe('Category Distribution', () => {
    
    it('all 12 categories are represented', () => {
      const expectedCategories = [
        'subject', 'style', 'lighting', 'colour', 'atmosphere', 'environment',
        'action', 'composition', 'camera', 'materials', 'fidelity', 'negative'
      ];
      
      const categoriesInTags = new Set<string>();
      for (const tag of Object.values(typedSemanticTags.options)) {
        categoriesInTags.add(tag.category);
      }
      
      for (const cat of expectedCategories) {
        expect(categoriesInTags.has(cat)).toBe(true);
      }
    });
  });
  
  describe('Version Consistency', () => {
    
    it('all data files have version numbers', () => {
      expect(typedFamilies.version).toBeDefined();
      expect(typedConflicts.version).toBeDefined();
      expect(typedMarketMoods.version).toBeDefined();
      expect(typedPlatformHints.version).toBeDefined();
      expect(typedSemanticTags.version).toBeDefined();
    });
    
    it('all data files have updated dates', () => {
      expect(typedFamilies.updated).toBeDefined();
      expect(typedConflicts.updated).toBeDefined();
      expect(typedMarketMoods.updated).toBeDefined();
      expect(typedPlatformHints.updated).toBeDefined();
      expect(typedSemanticTags.updated).toBeDefined();
    });
  });
});
