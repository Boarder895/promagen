/**
 * Prompt Intelligence Integration
 * ================================
 * Connects the vocabulary layer intelligence to the prompt builder UI.
 * 
 * Features:
 * - Real-time conflict detection
 * - Style family suggestions
 * - Market mood integration
 * - Weather-driven suggestions
 * - Platform optimization hints
 * 
 * @version 1.0.0
 * @updated 2026-01-21
 */

import type {
  PromptSelections,
  PromptCategory,
  ConflictWarning,
  StyleSuggestion,
  MarketMoodContext,
  PlatformTier
} from '@/types/prompt-intelligence';

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Conflict database - terms that don't work well together
 * This is a simplified version; full data lives in vocabulary/intelligence/conflicts.json
 */
const CONFLICT_RULES: Array<{
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  terms: string[];
  conflictsWith: string[];
  reason: string;
  exception?: string;
}> = [
  {
    id: 'style-photo-cartoon',
    severity: 'critical',
    terms: ['photorealistic', 'hyperrealistic', 'photo', 'realistic'],
    conflictsWith: ['cartoon', 'anime', 'manga', 'comic book', 'pixel art'],
    reason: 'Fundamental rendering conflict - photorealistic and cartoon styles are mutually exclusive'
  },
  {
    id: 'era-vintage-cyber',
    severity: 'high',
    terms: ['vintage', 'retro', 'antique', 'victorian', 'medieval'],
    conflictsWith: ['cyberpunk', 'futuristic', 'sci-fi', 'neon', 'holographic'],
    reason: 'Temporal aesthetic clash - past vs future',
    exception: 'Steampunk, dieselpunk, or retrofuturism intentionally blend these'
  },
  {
    id: 'mood-dark-bright',
    severity: 'high',
    terms: ['dark', 'moody', 'noir', 'gothic', 'sinister'],
    conflictsWith: ['bright', 'cheerful', 'sunny', 'vibrant', 'joyful'],
    reason: 'Opposing emotional tones',
    exception: 'Chiaroscuro lighting intentionally contrasts dark and light'
  },
  {
    id: 'lighting-day-night',
    severity: 'high',
    terms: ['daylight', 'sunny', 'midday sun', 'bright day'],
    conflictsWith: ['night', 'moonlight', 'starlight', 'midnight', 'nocturnal'],
    reason: 'Time of day conflict',
    exception: 'Twilight or dawn transition scenes'
  },
  {
    id: 'colour-mono-vibrant',
    severity: 'high',
    terms: ['monochrome', 'black and white', 'grayscale', 'desaturated'],
    conflictsWith: ['vibrant', 'colorful', 'rainbow', 'neon colors', 'saturated'],
    reason: 'Color saturation conflict',
    exception: 'Selective color technique (color splash)'
  },
  {
    id: 'style-minimal-ornate',
    severity: 'medium',
    terms: ['minimalist', 'simple', 'clean', 'sparse'],
    conflictsWith: ['maximalist', 'ornate', 'baroque', 'rococo', 'busy', 'detailed'],
    reason: 'Opposing design philosophies'
  },
  {
    id: 'camera-shallow-deep',
    severity: 'high',
    terms: ['shallow depth of field', 'bokeh', 'blurred background', 'f/1.4'],
    conflictsWith: ['deep focus', 'everything sharp', 'f/16', 'infinite focus'],
    reason: 'Mutually exclusive focus techniques'
  },
  {
    id: 'aesthetic-cyber-nature',
    severity: 'medium',
    terms: ['cyberpunk', 'digital', 'synthetic', 'chrome', 'tech'],
    conflictsWith: ['cottagecore', 'pastoral', 'rustic', 'natural', 'organic'],
    reason: 'Tech vs nature aesthetic clash',
    exception: 'Solarpunk or biopunk intentionally blend these'
  },
  {
    id: 'weather-sunny-stormy',
    severity: 'high',
    terms: ['sunny', 'clear sky', 'cloudless', 'perfect weather'],
    conflictsWith: ['stormy', 'thunderstorm', 'hurricane', 'heavy rain', 'lightning'],
    reason: 'Contradictory weather conditions',
    exception: 'Storm approaching or weather transition'
  },
  {
    id: 'format-photo-painting',
    severity: 'high',
    terms: ['photograph', 'photo', 'camera shot', 'captured'],
    conflictsWith: ['painting', 'painted', 'brush strokes', 'canvas'],
    reason: 'Medium format conflict'
  }
];

/**
 * Check all selections for conflicts
 */
export function detectConflicts(selections: PromptSelections): ConflictWarning[] {
  const warnings: ConflictWarning[] = [];
  
  // Collect all selected terms with their categories
  const allTerms: Array<{ term: string; category: PromptCategory }> = [];
  
  (Object.entries(selections) as [PromptCategory, string[]][]).forEach(([category, terms]: [PromptCategory, string[]]) => {
    terms.forEach((term: string) => {
      allTerms.push({ term: term.toLowerCase(), category });
    });
  });
  
  // Check each pair of terms against conflict rules
  for (let i = 0; i < allTerms.length; i++) {
    for (let j = i + 1; j < allTerms.length; j++) {
      const term1 = allTerms[i];
      const term2 = allTerms[j];
      if (!term1 || !term2) continue;
      
      for (const rule of CONFLICT_RULES) {
        const t1InTerms = rule.terms.some((t: string) => term1.term.includes(t) || t.includes(term1.term));
        const t2InConflicts = rule.conflictsWith.some((t: string) => term2.term.includes(t) || t.includes(term2.term));
        
        const t1InConflicts = rule.conflictsWith.some((t: string) => term1.term.includes(t) || t.includes(term1.term));
        const t2InTerms = rule.terms.some((t: string) => term2.term.includes(t) || t.includes(term2.term));
        
        if ((t1InTerms && t2InConflicts) || (t1InConflicts && t2InTerms)) {
          // Avoid duplicates
          const exists = warnings.some((w: ConflictWarning) => 
            (w.term1 === term1.term && w.term2 === term2.term) ||
            (w.term1 === term2.term && w.term2 === term1.term)
          );
          
          if (!exists) {
            warnings.push({
              term1: term1.term,
              term2: term2.term,
              severity: rule.severity,
              reason: rule.reason,
              exception: rule.exception,
              category1: term1.category,
              category2: term2.category
            });
          }
        }
      }
    }
  }
  
  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return warnings;
}

/**
 * Get conflict badge color
 */
export function getConflictColor(severity: ConflictWarning['severity']): string {
  switch (severity) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
}

// ============================================================================
// STYLE FAMILY SUGGESTIONS
// ============================================================================

/**
 * Style family database
 * Simplified version; full data in vocabulary/intelligence/families.json
 */
const STYLE_FAMILIES: Array<{
  id: string;
  name: string;
  members: string[];
  bestWith: string[];
  avoidWith: string[];
}> = [
  {
    id: 'impressionism',
    name: 'Impressionism',
    members: ['impressionist', 'monet style', 'renoir style', 'degas style'],
    bestWith: ['natural lighting', 'golden hour', 'outdoor scenes', 'soft focus'],
    avoidWith: ['sharp edges', 'digital', 'neon']
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    members: ['cyberpunk', 'blade runner style', 'tech noir', 'neon city'],
    bestWith: ['neon lighting', 'rain', 'night scenes', 'urban environment'],
    avoidWith: ['pastoral', 'natural', 'daylight', 'rustic']
  },
  {
    id: 'anime-manga',
    name: 'Anime/Manga',
    members: ['anime style', 'manga style', 'studio ghibli', 'shonen', 'shoujo'],
    bestWith: ['dynamic poses', 'colorful', 'expressive', 'fantasy'],
    avoidWith: ['photorealistic', 'western comic', 'documentary']
  },
  {
    id: 'photorealism',
    name: 'Photorealism',
    members: ['photorealistic', 'hyperrealistic', 'lifelike', 'photo-accurate'],
    bestWith: ['sharp focus', 'realistic lighting', 'accurate materials'],
    avoidWith: ['cartoon', 'stylized', 'abstract', 'impressionistic']
  },
  {
    id: 'art-nouveau',
    name: 'Art Nouveau',
    members: ['art nouveau', 'mucha style', 'klimt style', 'decorative'],
    bestWith: ['flowing lines', 'floral elements', 'gold accents', 'elegant'],
    avoidWith: ['industrial', 'brutalist', 'harsh angles']
  },
  {
    id: 'gothic',
    name: 'Gothic',
    members: ['gothic', 'dark fantasy', 'victorian gothic', 'macabre'],
    bestWith: ['dark lighting', 'fog', 'dramatic', 'mysterious'],
    avoidWith: ['bright', 'cheerful', 'pastel', 'minimal']
  }
];

/**
 * Get style suggestions based on current selections
 */
export function getStyleSuggestions(selections: PromptSelections): StyleSuggestion[] {
  const suggestions: StyleSuggestion[] = [];
  const selectedStyles = (selections.style ?? []).map((s: string) => s.toLowerCase());
  
  // Find which families the current styles belong to
  const matchedFamilies: string[] = [];
  
  for (const family of STYLE_FAMILIES) {
    const hasMatch = family.members.some((m: string) => 
      selectedStyles.some((s: string) => s.includes(m) || m.includes(s))
    );
    if (hasMatch) {
      matchedFamilies.push(family.id);
      
      // Suggest other members from same family
      for (const member of family.members) {
        if (!selectedStyles.some((s: string) => s.includes(member))) {
          suggestions.push({
            term: member,
            reason: `Works well with your ${family.name} selections`,
            familyId: family.id,
            confidence: 0.8
          });
        }
      }
      
      // Suggest compatible lighting/atmosphere
      for (const best of family.bestWith) {
        const lightingArr = selections.lighting ?? [];
        const atmosphereArr = selections.atmosphere ?? [];
        const environmentArr = selections.environment ?? [];
        
        const alreadySelected = 
          lightingArr.some((l: string) => l.toLowerCase().includes(best)) ||
          atmosphereArr.some((a: string) => a.toLowerCase().includes(best)) ||
          environmentArr.some((e: string) => e.toLowerCase().includes(best));
        
        if (!alreadySelected) {
          suggestions.push({
            term: best,
            reason: `Complements ${family.name} style`,
            familyId: family.id,
            confidence: 0.6
          });
        }
      }
    }
  }
  
  // Sort by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);
  
  return suggestions.slice(0, 5); // Top 5 suggestions
}

// ============================================================================
// MARKET MOOD INTEGRATION
// ============================================================================

/**
 * Market state configurations
 */
const MARKET_MOODS: Record<string, {
  moodTerms: string[];
  colorSuggestions: string[];
  lightingSuggestions: string[];
  atmosphereSuggestions: string[];
}> = {
  bullish: {
    moodTerms: ['triumphant', 'ascending', 'powerful', 'victorious', 'radiant'],
    colorSuggestions: ['gold', 'green', 'warm white', 'emerald'],
    lightingSuggestions: ['golden hour', 'bright sunlight', 'upward lighting'],
    atmosphereSuggestions: ['energetic', 'optimistic', 'dynamic']
  },
  bearish: {
    moodTerms: ['dramatic', 'intense', 'stormy', 'transformative'],
    colorSuggestions: ['deep red', 'dark blue', 'charcoal', 'burgundy'],
    lightingSuggestions: ['dramatic shadows', 'low key', 'storm light'],
    atmosphereSuggestions: ['turbulent', 'powerful', 'raw']
  },
  volatile: {
    moodTerms: ['chaotic', 'electric', 'unpredictable', 'dynamic'],
    colorSuggestions: ['electric blue', 'hot pink', 'neon green', 'purple'],
    lightingSuggestions: ['lightning flash', 'neon glow', 'prismatic'],
    atmosphereSuggestions: ['energetic', 'explosive', 'glitching']
  },
  consolidating: {
    moodTerms: ['contemplative', 'patient', 'balanced', 'anticipation'],
    colorSuggestions: ['grey', 'silver', 'muted blue', 'neutral'],
    lightingSuggestions: ['soft ambient', 'overcast', 'diffused'],
    atmosphereSuggestions: ['calm', 'watchful', 'meditative']
  },
  recovery: {
    moodTerms: ['hopeful', 'healing', 'resilient', 'renewing'],
    colorSuggestions: ['soft green', 'morning gold', 'gentle blue'],
    lightingSuggestions: ['morning light', 'gentle sunrise', 'healing glow'],
    atmosphereSuggestions: ['peaceful', 'fresh', 'emerging']
  }
};

/**
 * Get market mood context for prompt suggestions
 */
export function getMarketMoodContext(marketState: string): MarketMoodContext | null {
  const mood = MARKET_MOODS[marketState.toLowerCase()];
  if (!mood) return null;
  
  return {
    state: marketState,
    moodTerms: mood.moodTerms,
    colorSuggestions: mood.colorSuggestions,
    lightingSuggestions: mood.lightingSuggestions,
    atmosphereSuggestions: mood.atmosphereSuggestions
  };
}

/**
 * Get mood intensity based on percentage change
 */
export function getMoodIntensity(percentChange: number): {
  level: number;
  intensifier: string[];
} {
  const absChange = Math.abs(percentChange);
  
  if (absChange > 10) {
    return { level: 10, intensifier: ['explosive', 'historic', 'legendary'] };
  } else if (absChange > 5) {
    return { level: 8, intensifier: ['powerful', 'surging', 'commanding'] };
  } else if (absChange > 2) {
    return { level: 6, intensifier: ['strong', 'confident', 'advancing'] };
  } else if (absChange > 0.5) {
    return { level: 4, intensifier: ['gentle', 'steady', 'encouraging'] };
  } else {
    return { level: 2, intensifier: ['neutral', 'balanced', 'stable'] };
  }
}

// ============================================================================
// PLATFORM OPTIMIZATION HINTS
// ============================================================================

/**
 * Get optimization hints for a platform tier
 */
export function getPlatformHints(tier: PlatformTier, selections: PromptSelections): string[] {
  const hints: string[] = [];
  const styleArr = selections.style ?? [];
  const fidelityArr = selections.fidelity ?? [];
  const subjectArr = selections.subject ?? [];
  const negativeArr = selections.negative ?? [];
  
  switch (tier) {
    case 1: // CLIP-Based
      if (styleArr.length > 2) {
        hints.push('💡 Consider using 2 styles max for cleaner results');
      }
      if (fidelityArr.length === 0) {
        hints.push('✨ Add quality boosters like "masterpiece" or "best quality"');
      }
      if (subjectArr.length > 0 && subjectArr[0] && !subjectArr[0].includes(',')) {
        hints.push('🎯 Front-loading important terms improves CLIP attention');
      }
      break;
      
    case 2: // Midjourney
      if (negativeArr.length > 0) {
        hints.push('🎨 Midjourney handles complex prompts well - feel free to stack terms');
      }
      if (styleArr.length > 3) {
        hints.push('💡 Even MJ works best with 2-3 focused styles');
      }
      break;
      
    case 3: // Natural Language
      if (negativeArr.length > 3) {
        hints.push('💬 Natural language platforms prefer fewer exclusions');
      }
      hints.push('📝 Describe your scene as if talking to an artist');
      break;
      
    case 4: // Plain Language
      if (styleArr.length > 1) {
        hints.push('🎯 Plain language platforms work best with one clear style');
      }
      if (fidelityArr.length > 1) {
        hints.push('💡 Keep quality terms simple - "detailed" often works better than stacking');
      }
      hints.push('✨ Simpler prompts often yield better results on this platform');
      break;
  }
  
  return hints;
}

// ============================================================================
// WEATHER INTEGRATION
// ============================================================================

/**
 * Get atmosphere suggestions based on weather
 */
export function getWeatherSuggestions(weather: {
  temperature?: number;
  humidity?: number;
  conditions?: string;
}): string[] {
  const suggestions: string[] = [];
  
  if (weather.temperature !== undefined) {
    if (weather.temperature <= 0) {
      suggestions.push('frozen', 'icy', 'crystalline', 'winter wonderland');
    } else if (weather.temperature <= 10) {
      suggestions.push('crisp', 'cool morning', 'autumn chill');
    } else if (weather.temperature <= 20) {
      suggestions.push('pleasant', 'comfortable', 'spring-like');
    } else if (weather.temperature <= 30) {
      suggestions.push('warm', 'summer', 'golden hour');
    } else {
      suggestions.push('scorching', 'heat haze', 'tropical');
    }
  }
  
  if (weather.conditions) {
    const cond = weather.conditions.toLowerCase();
    if (cond.includes('rain')) {
      suggestions.push('rain-soaked', 'reflective puddles', 'moody overcast');
    } else if (cond.includes('snow')) {
      suggestions.push('snow-covered', 'pristine white', 'silent winter');
    } else if (cond.includes('fog') || cond.includes('mist')) {
      suggestions.push('mysterious fog', 'ethereal mist', 'dreamy atmosphere');
    } else if (cond.includes('clear') || cond.includes('sun')) {
      suggestions.push('brilliant sunlight', 'clear skies', 'vivid colors');
    } else if (cond.includes('cloud')) {
      suggestions.push('soft overcast', 'diffused light', 'gentle shadows');
    }
  }
  
  return suggestions;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  CONFLICT_RULES,
  STYLE_FAMILIES,
  MARKET_MOODS
};
