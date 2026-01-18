// src/data/platform-tiers.ts
// ============================================================================
// PLATFORM TIERS DATA
// ============================================================================
// Defines the 4-tier system for AI image generation platforms.
// Used by the Learn page to show tier-specific prompting guidance.
// Authority: docs/authority/prompt-builder-page.md §Platform-Aware Selection Limits
// ============================================================================

export type PlatformTierId = 1 | 2 | 3 | 4;

export interface PlatformTier {
  id: PlatformTierId;
  name: string;
  shortName: string;
  promptStyle: string;
  description: string;
  characteristics: string[];
  platforms: string[];
  tips: string[];
}

// ============================================================================
// Tier Definitions
// ============================================================================

export const PLATFORM_TIERS: Record<PlatformTierId, PlatformTier> = {
  1: {
    id: 1,
    name: 'CLIP-Based',
    shortName: 'Tier 1',
    promptStyle: 'Weighted syntax, keyword stacking',
    description: 'These platforms use CLIP-based models that respond well to weighted syntax and keyword stacking. Use parentheses for emphasis and stack multiple style terms.',
    characteristics: [
      'Supports prompt weighting with (keyword:1.5) syntax',
      'Responds well to keyword stacking',
      'Separate negative prompt field available',
      'Benefits from quality boosters like "masterpiece, best quality"',
    ],
    platforms: [
      'artguru',
      'clipdrop',
      'dreamlike',
      'dreamstudio',
      'getimg',
      'jasper-art',
      'leonardo',
      'lexica',
      'nightcafe',
      'novelai',
      'openart',
      'playground',
      'stability',
    ],
    tips: [
      'Use (keyword:1.5) to increase emphasis on specific elements',
      'Stack quality terms: "masterpiece, best quality, highly detailed"',
      'Front-load important keywords — word order matters',
      'Use the negative prompt field for unwanted elements',
    ],
  },
  2: {
    id: 2,
    name: 'Midjourney Family',
    shortName: 'Tier 2',
    promptStyle: 'Parameters, --no negatives',
    description: 'Midjourney-style platforms use parameter flags and inline negative prompts. Master the --ar, --v, --s, and --no parameters for precise control.',
    characteristics: [
      'Uses --ar for aspect ratio (e.g., --ar 16:9)',
      'Uses --no for inline negatives (e.g., --no blur, text)',
      'Supports --v for version and --s for stylization',
      'Responds well to artistic and mood descriptors',
    ],
    platforms: [
      'bluewillow',
      'midjourney',
    ],
    tips: [
      'End prompts with parameters: --ar 16:9 --v 6 --s 500',
      'Use --no for negatives: --no blur, watermark, text',
      'Keep prompts descriptive but not overly long',
      'Use multi-prompts with :: for weighted concepts',
    ],
  },
  3: {
    id: 3,
    name: 'Natural Language',
    shortName: 'Tier 3',
    promptStyle: 'Conversational sentences',
    description: 'These platforms understand natural, conversational prompts. Write as if describing the image to a human artist — complete sentences work best.',
    characteristics: [
      'Prefers conversational, sentence-based prompts',
      'No special syntax or parameters needed',
      'Understands context and relationships well',
      'Negative elements handled inline with "without" or "no"',
    ],
    platforms: [
      'adobe-firefly',
      'bing',
      'flux',
      'google-imagen',
      'hotpot',
      'ideogram',
      'imagine-meta',
      'microsoft-designer',
      'openai',
      'runway',
    ],
    tips: [
      'Write in complete, descriptive sentences',
      'Describe relationships: "A cat sitting on a red velvet chair"',
      'Use "without" for exclusions: "A forest without any buildings"',
      'Be specific about composition and mood in natural language',
    ],
  },
  4: {
    id: 4,
    name: 'Plain Language',
    shortName: 'Tier 4',
    promptStyle: 'Simple, focused prompts',
    description: 'These platforms work best with simple, focused prompts. Keep it short and direct — complex prompts may produce unpredictable results.',
    characteristics: [
      'Works best with short, clear prompts',
      'Limited support for complex syntax',
      'Focus on one main subject and style',
      'Quality over quantity in prompt length',
    ],
    platforms: [
      'artbreeder',
      'artistly',
      'canva',
      'craiyon',
      'deepai',
      'fotor',
      'freepik',
      'myedit',
      'photoleap',
      'picsart',
      'picwish',
      'pixlr',
      'remove-bg',
      'simplified',
      'visme',
      'vistacreate',
      '123rf',
    ],
    tips: [
      'Keep prompts short: 5-15 words ideal',
      'Focus on one main subject or concept',
      'Use simple style descriptors: "realistic", "cartoon", "watercolor"',
      'Avoid complex parameters or weighting syntax',
    ],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the tier for a specific platform
 */
export function getPlatformTier(platformId: string): PlatformTier | undefined {
  for (const tier of Object.values(PLATFORM_TIERS)) {
    if (tier.platforms.includes(platformId)) {
      return tier;
    }
  }
  return undefined;
}

/**
 * Get the tier ID for a specific platform
 */
export function getPlatformTierId(platformId: string): PlatformTierId | undefined {
  const tier = getPlatformTier(platformId);
  return tier?.id;
}

/**
 * Get all tiers as an array
 */
export function getAllTiers(): PlatformTier[] {
  return Object.values(PLATFORM_TIERS);
}

/**
 * Get tier by ID
 */
export function getTierById(tierId: PlatformTierId): PlatformTier {
  return PLATFORM_TIERS[tierId];
}

/**
 * Check if a platform is in a specific tier
 */
export function isPlatformInTier(platformId: string, tierId: PlatformTierId): boolean {
  return PLATFORM_TIERS[tierId].platforms.includes(platformId);
}
