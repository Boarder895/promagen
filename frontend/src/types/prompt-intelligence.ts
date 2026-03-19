/**
 * Prompt Intelligence Types
 * =========================
 * Type definitions for the 4-tier AI prompt generation system.
 * 
 * @version 1.0.0
 * @updated 2026-01-21
 */

// ============================================================================
// PLATFORM TIERS
// ============================================================================

export type PlatformTier = 1 | 2 | 3 | 4;

export interface TierConfig {
  id: PlatformTier;
  name: string;
  description: string;
  promptStyle: 'clip-based' | 'midjourney' | 'natural' | 'plain';
  syntaxFeatures: string[];
  tolerance: 'very-high' | 'high' | 'medium' | 'low';
  platforms: string[];
}

export const TIER_CONFIGS: Record<PlatformTier, TierConfig> = {
  1: {
    id: 1,
    name: 'CLIP-Based',
    description: 'Tokenized keywords, high stacking tolerance',
    promptStyle: 'clip-based',
    syntaxFeatures: ['(term:weight)', '::weight', 'comma-separated'],
    tolerance: 'high',
    platforms: [
      'stability', 'leonardo', 'clipdrop', 'nightcafe', 'dreamstudio',
      'lexica', 'novelai', 'dreamlike', 'getimg', 'openart',
      'playground', 'artguru', 'tensor-art'
    ]
  },
  2: {
    id: 2,
    name: 'Midjourney Family',
    description: 'Parameter-rich, very high tolerance',
    promptStyle: 'midjourney',
    syntaxFeatures: ['--ar', '--no', '--v', '--s', '--c', '::weight'],
    tolerance: 'very-high',
    platforms: ['midjourney', 'bluewillow']
  },
  3: {
    id: 3,
    name: 'Natural Language',
    description: 'Conversational prompts, medium tolerance',
    promptStyle: 'natural',
    syntaxFeatures: ['full-sentences', 'descriptive', 'contextual'],
    tolerance: 'medium',
    platforms: [
      'openai', 'adobe-firefly', 'ideogram', 'runway',
      'microsoft-designer', 'bing', 'flux', 'google-imagen',
      'imagine-meta', 'hotpot', 'recraft', 'kling', 'luma-ai', 'jasper-art'
    ]
  },
  4: {
    id: 4,
    name: 'Plain Language',
    description: 'Simple prompts work best, low tolerance',
    promptStyle: 'plain',
    syntaxFeatures: ['simple', 'focused', 'minimal'],
    tolerance: 'low',
    platforms: [
      'canva', 'craiyon', 'deepai', 'pixlr', 'picwish', 'fotor',
      'visme', 'vistacreate', 'myedit', 'simplified', 'freepik',
      'picsart', 'photoleap', 'artbreeder', '123rf', 'artistly'
    ]
  }
};

// ============================================================================
// CATEGORY TYPES
// ============================================================================

export type PromptCategory =
  | 'subject'
  | 'action'
  | 'style'
  | 'environment'
  | 'composition'
  | 'camera'
  | 'lighting'
  | 'atmosphere'
  | 'colour'
  | 'materials'
  | 'fidelity'
  | 'negative';

export const CATEGORY_ORDER: PromptCategory[] = [
  'subject',
  'action',
  'style',
  'environment',
  'composition',
  'camera',
  'lighting',
  'atmosphere',
  'colour',
  'materials',
  'fidelity',
  'negative'
];

export const STACKABLE_CATEGORIES: PromptCategory[] = [
  'style',
  'lighting',
  'colour',
  'atmosphere',
  'materials',
  'fidelity',
  'negative'
];

export interface CategoryMeta {
  id: PromptCategory;
  label: string;
  description: string;
  icon: string;
  isStackable: boolean;
  tooltipBase: string;
}

export const CATEGORY_META: Record<PromptCategory, CategoryMeta> = {
  subject: {
    id: 'subject',
    label: 'Subject',
    description: 'The main focus of your image',
    icon: '👤',
    isStackable: false,
    tooltipBase: 'Pick 1 main subject'
  },
  action: {
    id: 'action',
    label: 'Action / Pose',
    description: 'What the subject is doing',
    icon: '🎬',
    isStackable: false,
    tooltipBase: 'Pick 1 primary action'
  },
  style: {
    id: 'style',
    label: 'Style / Rendering',
    description: 'Art style and rendering approach',
    icon: '🎨',
    isStackable: true,
    tooltipBase: 'Pick complementary styles'
  },
  environment: {
    id: 'environment',
    label: 'Environment',
    description: 'Location and setting',
    icon: '🌍',
    isStackable: false,
    tooltipBase: 'Pick 1 setting'
  },
  composition: {
    id: 'composition',
    label: 'Composition',
    description: 'Framing and perspective',
    icon: '📐',
    isStackable: false,
    tooltipBase: 'Pick 1 framing approach'
  },
  camera: {
    id: 'camera',
    label: 'Camera',
    description: 'Lens and camera settings',
    icon: '📷',
    isStackable: false,
    tooltipBase: 'Pick 1 lens/angle'
  },
  lighting: {
    id: 'lighting',
    label: 'Lighting',
    description: 'Light sources and quality',
    icon: '💡',
    isStackable: true,
    tooltipBase: 'Combine light sources'
  },
  atmosphere: {
    id: 'atmosphere',
    label: 'Atmosphere',
    description: 'Mood and environmental effects',
    icon: '🌫️',
    isStackable: true,
    tooltipBase: 'Layer atmospheric effects'
  },
  colour: {
    id: 'colour',
    label: 'Colour / Grade',
    description: 'Color palette and grading',
    icon: '🎭',
    isStackable: true,
    tooltipBase: 'Combine color treatments'
  },
  materials: {
    id: 'materials',
    label: 'Materials',
    description: 'Textures and surfaces',
    icon: '🧱',
    isStackable: true,
    tooltipBase: 'Layer material qualities'
  },
  fidelity: {
    id: 'fidelity',
    label: 'Fidelity',
    description: 'Quality and detail boosters',
    icon: '✨',
    isStackable: true,
    tooltipBase: 'Stack quality boosters'
  },
  negative: {
    id: 'negative',
    label: 'Constraints',
    description: 'Elements to avoid',
    icon: '🚫',
    isStackable: true,
    tooltipBase: 'Add exclusions'
  }
};

// ============================================================================
// SELECTION LIMITS
// ============================================================================

export interface SelectionLimits {
  subject: number;
  action: number;
  style: number;
  environment: number;
  composition: number;
  camera: number;
  lighting: number;
  atmosphere: number;
  colour: number;
  materials: number;
  fidelity: number;
  negative: number;
}

// Standard Promagen limits by tier
// ============================================================================
// TIER-GENERIC LIMITS (legacy fallback)
// ============================================================================
// These are conservative tier-level defaults used ONLY when a platform is not
// found in PLATFORM_SPECIFIC_LIMITS (constants.ts). The per-platform system
// is the source of truth. These reflect typical values for each tier.
//
// Authority: docs/authority/optimal-prompt-stacking.md v2.0.0
// ============================================================================

export const STANDARD_LIMITS: Record<PlatformTier, SelectionLimits> = {
  1: { // CLIP-Based — 75-token budget, moderate stacking
    subject: 1, action: 1, style: 1, environment: 1,
    composition: 1, camera: 1, lighting: 1, atmosphere: 1,
    colour: 1, materials: 1, fidelity: 1, negative: 5
  },
  2: { // Midjourney — fidelity confirmed ineffective (0/0)
    subject: 1, action: 1, style: 1, environment: 1,
    composition: 1, camera: 1, lighting: 1, atmosphere: 1,
    colour: 1, materials: 1, fidelity: 0, negative: 2
  },
  3: { // Natural Language — NLU handles more, but attention dilution limits
    subject: 1, action: 1, style: 1, environment: 1,
    composition: 1, camera: 1, lighting: 1, atmosphere: 1,
    colour: 1, materials: 1, fidelity: 1, negative: 3
  },
  4: { // Plain Language — simple prompts work best
    subject: 1, action: 1, style: 1, environment: 1,
    composition: 1, camera: 1, lighting: 1, atmosphere: 1,
    colour: 1, materials: 1, fidelity: 1, negative: 0
  }
};

// Pro tier-generic limits — conservative per-platform bonuses
// Real per-platform pro numbers are in PLATFORM_SPECIFIC_LIMITS (constants.ts)
export const PRO_LIMITS: Record<PlatformTier, SelectionLimits> = {
  1: {
    subject: 2, action: 1, style: 2, environment: 2,
    composition: 1, camera: 1, lighting: 2, atmosphere: 2,
    colour: 1, materials: 2, fidelity: 2, negative: 8
  },
  2: {
    subject: 3, action: 1, style: 2, environment: 2,
    composition: 1, camera: 1, lighting: 2, atmosphere: 2,
    colour: 2, materials: 2, fidelity: 0, negative: 4
  },
  3: {
    subject: 2, action: 1, style: 2, environment: 2,
    composition: 1, camera: 1, lighting: 2, atmosphere: 2,
    colour: 1, materials: 2, fidelity: 1, negative: 5
  },
  4: {
    subject: 2, action: 1, style: 1, environment: 1,
    composition: 1, camera: 1, lighting: 1, atmosphere: 1,
    colour: 1, materials: 1, fidelity: 1, negative: 0
  }
};

// ============================================================================
// PROMPT STATE
// ============================================================================

export interface PromptSelections {
  subject: string[];
  action: string[];
  style: string[];
  environment: string[];
  composition: string[];
  camera: string[];
  lighting: string[];
  atmosphere: string[];
  colour: string[];
  materials: string[];
  fidelity: string[];
  negative: string[];
}

export const EMPTY_SELECTIONS: PromptSelections = {
  subject: [],
  action: [],
  style: [],
  environment: [],
  composition: [],
  camera: [],
  lighting: [],
  atmosphere: [],
  colour: [],
  materials: [],
  fidelity: [],
  negative: []
};

// ============================================================================
// GENERATED PROMPTS
// ============================================================================

export interface GeneratedPrompts {
  tier1: string; // CLIP-Based with weights
  tier2: string; // Midjourney with parameters
  tier3: string; // Natural language sentences
  tier4: string; // Plain, simple
  negative: {
    tier1: string; // Negative for CLIP
    tier2: string; // --no for Midjourney
    tier3: string; // "without X" for natural
    tier4: string; // Simple exclusions
  };
}

// ============================================================================
// INTELLIGENCE TYPES
// ============================================================================

export interface ConflictWarning {
  term1: string;
  term2: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  exception?: string;
  category1: PromptCategory;
  category2: PromptCategory;
}

export interface StyleSuggestion {
  term: string;
  reason: string;
  familyId: string;
  confidence: number;
}

export interface MarketMoodContext {
  state: string;
  moodTerms: string[];
  colorSuggestions: string[];
  lightingSuggestions: string[];
  atmosphereSuggestions: string[];
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface PromptBuilderProps {
  platformId: string;
  platformTier: PlatformTier;
  isPro: boolean;
  isLocked: boolean;
  marketMood?: MarketMoodContext;
  weatherContext?: {
    temperature?: number;
    humidity?: number;
    conditions?: string;
    city?: string;
  };
  onPromptGenerated?: (prompts: GeneratedPrompts) => void;
  onConflictDetected?: (conflicts: ConflictWarning[]) => void;
}

export interface CategoryDropdownProps {
  category: PromptCategory;
  selections: string[];
  options: string[];
  subcategories?: Record<string, string[]>;
  limit: number;
  disabled: boolean;
  onSelectionChange: (selections: string[]) => void;
  conflicts?: string[];
  suggestions?: StyleSuggestion[];
  tooltipText?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getTierForPlatform(platformId: string): PlatformTier {
  for (const [tier, config] of Object.entries(TIER_CONFIGS)) {
    if (config.platforms.includes(platformId)) {
      return Number(tier) as PlatformTier;
    }
  }
  return 4; // Default to plain language
}

export function getLimitsForTier(tier: PlatformTier, isPro: boolean): SelectionLimits {
  return isPro ? PRO_LIMITS[tier] : STANDARD_LIMITS[tier];
}

export function getCategoryLimit(
  category: PromptCategory,
  tier: PlatformTier,
  isPro: boolean
): number {
  const limits = getLimitsForTier(tier, isPro);
  return limits[category];
}

export function getDynamicTooltip(
  category: PromptCategory,
  tier: PlatformTier,
  isPro: boolean
): string {
  const meta = CATEGORY_META[category];
  const limit = getCategoryLimit(category, tier, isPro);
  const tierConfig = TIER_CONFIGS[tier];
  
  if (limit === 1) {
    return `${meta.tooltipBase}. Keep it focused for ${tierConfig.name}.`;
  }
  
  return `Pick up to ${limit} ${category === 'negative' ? 'exclusions' : 'options'}. ${tierConfig.name} handles ${limit > 2 ? 'complex' : 'moderate'} stacking well.`;
}
