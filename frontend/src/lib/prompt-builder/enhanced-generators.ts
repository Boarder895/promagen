/**
 * Enhanced 4-Tier Prompt Generator
 * =================================
 * Transforms user selections into platform-optimized prompts using
 * the vocabulary integration layer.
 * 
 * Each tier has fundamentally different prompt construction:
 * 
 * Tier 1 (CLIP): "(term:weight), (term:weight), ..."
 * Tier 2 (MJ):   "term, term::weight, term --ar 16:9 --no negative"
 * Tier 3 (NL):   "A [subject] [action], rendered in [style]. The scene..."
 * Tier 4 (Plain): "subject, style, simple, clean"
 * 
 * @version 2.0.0
 * @updated 2026-01-21
 */

import type { PromptCategory, PlatformTier, GeneratedPrompts } from '../../types/prompt-intelligence';
// Commented out - reserved for future vocabulary integration
// import { 
//   getCategoryOptions, 
//   getTierOptimizedValue,
//   type VocabularyOption 
// } from '../vocabulary/vocabulary-integration';

// ============================================================================
// TYPES
// ============================================================================

export interface PromptSelections {
  [key: string]: string[];
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

export interface TierGeneratorConfig {
  tier: PlatformTier;
  separator: string;
  weightSyntax: 'parentheses' | 'doublecolon' | 'none';
  negativeSyntax: 'separate' | 'inline-no' | 'sentence' | 'simple';
  sentenceMode: boolean;
  qualityBoosters: string[];
  maxTerms?: number;
}

// ============================================================================
// TIER CONFIGURATIONS
// ============================================================================

const TIER_CONFIGS: Record<PlatformTier, TierGeneratorConfig> = {
  1: {
    tier: 1,
    separator: ', ',
    weightSyntax: 'parentheses',
    negativeSyntax: 'separate',
    sentenceMode: false,
    qualityBoosters: ['(masterpiece:1.3)', '(best quality:1.3)', '(highly detailed:1.2)']
  },
  2: {
    tier: 2,
    separator: ', ',
    weightSyntax: 'doublecolon',
    negativeSyntax: 'inline-no',
    sentenceMode: false,
    qualityBoosters: ['highly detailed', 'professional', 'sharp focus']
  },
  3: {
    tier: 3,
    separator: '. ',
    weightSyntax: 'none',
    negativeSyntax: 'sentence',
    sentenceMode: true,
    qualityBoosters: ['with exquisite detail', 'professionally rendered', 'in stunning quality']
  },
  4: {
    tier: 4,
    separator: ', ',
    weightSyntax: 'none',
    negativeSyntax: 'simple',
    sentenceMode: false,
    qualityBoosters: ['detailed'],
    maxTerms: 8
  }
};

// ============================================================================
// CATEGORY WEIGHTS FOR TIER 1 (CLIP)
// ============================================================================

const CATEGORY_WEIGHTS: Record<PromptCategory, number> = {
  subject: 1.4,
  action: 1.2,
  style: 1.3,
  environment: 1.1,
  composition: 1.0,
  camera: 1.0,
  lighting: 1.2,
  atmosphere: 1.1,
  colour: 1.1,
  materials: 1.0,
  fidelity: 1.2,
  negative: 1.0
};

// ============================================================================
// SENTENCE TEMPLATES FOR TIER 3 (NATURAL LANGUAGE)
// ============================================================================

const SENTENCE_TEMPLATES = {
  subject: (terms: string[]) => {
    if (terms.length === 0) return '';
    const subject = terms[0] ?? 'scene';
    const article = /^[aeiou]/i.test(subject) ? 'An' : 'A';
    return `${article} ${subject}`;
  },
  
  action: (terms: string[], hasSubject: boolean) => {
    if (terms.length === 0) return '';
    return hasSubject ? ` ${terms[0]}` : `Someone ${terms[0]}`;
  },
  
  environment: (terms: string[]) => {
    if (terms.length === 0) return '';
    const connectors = ['set in', 'located in', 'within', 'surrounded by'];
    const connector = connectors[Math.floor(Math.random() * connectors.length)];
    return `, ${connector} ${terms[0]}`;
  },
  
  style: (terms: string[]) => {
    if (terms.length === 0) return '';
    if (terms.length === 1) {
      return `Rendered in ${terms[0]} style.`;
    }
    return `The style blends ${terms.slice(0, -1).join(', ')} and ${terms[terms.length - 1]}.`;
  },
  
  lighting: (terms: string[]) => {
    if (terms.length === 0) return '';
    const connectors = ['illuminated by', 'bathed in', 'lit by'];
    const connector = connectors[Math.floor(Math.random() * connectors.length)];
    return `The scene is ${connector} ${terms.join(' and ')}.`;
  },
  
  atmosphere: (terms: string[]) => {
    if (terms.length === 0) return '';
    return `The atmosphere is ${terms.join(', ')}.`;
  },
  
  colour: (terms: string[]) => {
    if (terms.length === 0) return '';
    return `Features ${terms.join(' and ')} color palette.`;
  },
  
  composition: (terms: string[]) => {
    if (terms.length === 0) return '';
    return `Composed with ${terms[0]}.`;
  },
  
  camera: (terms: string[]) => {
    if (terms.length === 0) return '';
    return `Shot with ${terms[0]}.`;
  },
  
  materials: (terms: string[]) => {
    if (terms.length === 0) return '';
    return `Rich ${terms.join(' and ')} textures throughout.`;
  },
  
  fidelity: (terms: string[]) => {
    if (terms.length === 0) return '';
    return `${terms.join(', ')} quality.`;
  }
};

// ============================================================================
// NEGATIVE TO POSITIVE CONVERSIONS
// ============================================================================

const NEGATIVE_TO_POSITIVE: Record<string, string> = {
  'blurry': 'sharp and clear',
  'low quality': 'high quality',
  'bad anatomy': 'anatomically correct',
  'deformed': 'well-proportioned',
  'ugly': 'aesthetically pleasing',
  'watermark': 'clean image without marks',
  'signature': 'unsigned',
  'text': 'no visible text',
  'extra fingers': 'correct number of fingers',
  'missing fingers': 'complete hands',
  'bad hands': 'well-rendered hands',
  'cropped': 'full composition',
  'out of frame': 'fully in frame',
  'duplicate': 'single unique subject',
  'mutation': 'natural appearance',
  'disfigured': 'properly formed',
  'gross proportions': 'correct proportions',
  'malformed': 'well-formed',
  'poorly drawn': 'expertly rendered',
  'amateur': 'professional quality',
  'jpeg artifacts': 'artifact-free',
  'noise': 'clean and smooth',
  'grainy': 'crisp and clear',
  'overexposed': 'properly exposed',
  'underexposed': 'well-lit',
  'low resolution': 'high resolution',
  'pixelated': 'crisp details'
};

// ============================================================================
// TIER 1 GENERATOR (CLIP-BASED)
// ============================================================================

function generateTier1(selections: PromptSelections): string {
  const parts: string[] = [];
  
  // Quality boosters first (if no fidelity selected)
  if (selections.fidelity.length === 0) {
    parts.push(...TIER_CONFIGS[1].qualityBoosters);
  }
  
  // Subject with high weight
  selections.subject.forEach((term, i) => {
    const weight = CATEGORY_WEIGHTS.subject - (i * 0.1);
    parts.push(`(${term}:${weight.toFixed(1)})`);
  });
  
  // Action
  selections.action.forEach((term, i) => {
    const weight = CATEGORY_WEIGHTS.action - (i * 0.1);
    parts.push(`(${term}:${weight.toFixed(1)})`);
  });
  
  // Style(s) - important with weights
  selections.style.forEach((term, i) => {
    const weight = CATEGORY_WEIGHTS.style - (i * 0.1);
    parts.push(`(${term}:${weight.toFixed(1)})`);
  });
  
  // Environment
  selections.environment.forEach((term, i) => {
    const weight = CATEGORY_WEIGHTS.environment - (i * 0.05);
    parts.push(`(${term}:${weight.toFixed(1)})`);
  });
  
  // Technical categories without weights
  selections.composition.forEach(term => parts.push(term));
  selections.camera.forEach(term => parts.push(term));
  
  // Lighting with weights (important for mood)
  selections.lighting.forEach((term, i) => {
    const weight = CATEGORY_WEIGHTS.lighting - (i * 0.1);
    parts.push(`(${term}:${weight.toFixed(1)})`);
  });
  
  // Atmosphere and colour
  selections.atmosphere.forEach(term => {
    parts.push(`(${term}:${CATEGORY_WEIGHTS.atmosphere})`);
  });
  
  selections.colour.forEach(term => {
    parts.push(`(${term}:${CATEGORY_WEIGHTS.colour})`);
  });
  
  // Materials
  selections.materials.forEach(term => parts.push(term));
  
  // Fidelity boosters with weights
  selections.fidelity.forEach((term, i) => {
    const weight = CATEGORY_WEIGHTS.fidelity - (i * 0.05);
    parts.push(`(${term}:${weight.toFixed(1)})`);
  });
  
  return parts.join(', ');
}

function generateTier1Negative(selections: PromptSelections): string {
  if (selections.negative.length === 0) {
    return 'blurry, low quality, bad anatomy, watermark, signature, ugly, deformed';
  }
  return selections.negative.join(', ');
}

// ============================================================================
// TIER 2 GENERATOR (MIDJOURNEY)
// ============================================================================

function generateTier2(selections: PromptSelections): string {
  const parts: string[] = [];
  
  // Subject (natural language)
  if (selections.subject.length > 0 && selections.subject[0]) {
    parts.push(selections.subject[0]);
  }
  
  // Action
  if (selections.action.length > 0 && selections.action[0]) {
    parts.push(selections.action[0]);
  }
  
  // Environment with preposition
  if (selections.environment.length > 0) {
    parts.push(`in ${selections.environment[0]}`);
  }
  
  // Style(s) with MJ weighting (::)
  if (selections.style.length > 0) {
    selections.style.forEach((style, i) => {
      const weight = 2 - (i * 0.25);
      parts.push(`${style}::${weight.toFixed(1)}`);
    });
  }
  
  // Composition and camera
  selections.composition.forEach(term => parts.push(term));
  selections.camera.forEach(term => parts.push(term));
  
  // Lighting
  if (selections.lighting.length > 0) {
    parts.push(selections.lighting.join(', '));
  }
  
  // Atmosphere
  if (selections.atmosphere.length > 0) {
    parts.push(`${selections.atmosphere.join(', ')} atmosphere`);
  }
  
  // Colour
  selections.colour.forEach(term => parts.push(term));
  
  // Materials
  selections.materials.forEach(term => parts.push(term));
  
  // Fidelity (or default boosters)
  if (selections.fidelity.length > 0) {
    parts.push(selections.fidelity.join(', '));
  } else {
    parts.push(...TIER_CONFIGS[2].qualityBoosters);
  }
  
  return parts.join(', ');
}

function generateTier2Negative(selections: PromptSelections): string {
  const negatives = selections.negative.length > 0
    ? selections.negative
    : ['blurry', 'low quality', 'bad anatomy', 'watermark', 'ugly', 'deformed', 'mutation', 'disfigured'];
  
  // Midjourney uses --no parameter
  return `--no ${negatives.join(', ')}`;
}

// ============================================================================
// TIER 3 GENERATOR (NATURAL LANGUAGE)
// ============================================================================

function generateTier3(selections: PromptSelections): string {
  const sentences: string[] = [];
  
  // Build main subject sentence
  let mainSentence = '';
  mainSentence += SENTENCE_TEMPLATES.subject(selections.subject);
  mainSentence += SENTENCE_TEMPLATES.action(selections.action, selections.subject.length > 0);
  mainSentence += SENTENCE_TEMPLATES.environment(selections.environment);
  
  if (mainSentence) {
    sentences.push(mainSentence + '.');
  }
  
  // Style sentence
  const styleSentence = SENTENCE_TEMPLATES.style(selections.style);
  if (styleSentence) sentences.push(styleSentence);
  
  // Lighting sentence
  const lightingSentence = SENTENCE_TEMPLATES.lighting(selections.lighting);
  if (lightingSentence) sentences.push(lightingSentence);
  
  // Atmosphere sentence
  const atmosphereSentence = SENTENCE_TEMPLATES.atmosphere(selections.atmosphere);
  if (atmosphereSentence) sentences.push(atmosphereSentence);
  
  // Technical details (combine colour, composition, camera)
  const technicalParts: string[] = [];
  if (selections.colour.length > 0) {
    technicalParts.push(`${selections.colour.join(' and ')} color palette`);
  }
  if (selections.composition.length > 0) {
    technicalParts.push(`${selections.composition[0]} composition`);
  }
  if (selections.camera.length > 0) {
    technicalParts.push(`shot with ${selections.camera[0]}`);
  }
  if (technicalParts.length > 0) {
    sentences.push(`Features ${technicalParts.join(', ')}.`);
  }
  
  // Materials
  const materialsSentence = SENTENCE_TEMPLATES.materials(selections.materials);
  if (materialsSentence) sentences.push(materialsSentence);
  
  // Quality (fidelity)
  if (selections.fidelity.length > 0) {
    sentences.push(`${selections.fidelity.join(', ')} quality.`);
  } else {
    sentences.push(TIER_CONFIGS[3].qualityBoosters[0] + '.');
  }
  
  // Convert negatives to positive requirements
  const positiveConversions: string[] = [];
  selections.negative.slice(0, 3).forEach(neg => {
    const positive = NEGATIVE_TO_POSITIVE[neg.toLowerCase()];
    if (positive) positiveConversions.push(positive);
  });
  if (positiveConversions.length > 0) {
    sentences.push(`The image should be ${positiveConversions.join(', ')}.`);
  }
  
  return sentences.join(' ');
}

function generateTier3Negative(selections: PromptSelections): string {
  // Natural language platforms don't use separate negative prompts
  // Return guidance for user instead
  if (selections.negative.length === 0) return '';
  
  const avoids = selections.negative.slice(0, 3);
  return `Avoid: ${avoids.join(', ')}.`;
}

// ============================================================================
// TIER 4 GENERATOR (PLAIN LANGUAGE)
// ============================================================================

function generateTier4(selections: PromptSelections): string {
  const parts: string[] = [];
  const maxTerms = TIER_CONFIGS[4].maxTerms || 8;
  
  // Subject (essential)
  if (selections.subject.length > 0 && selections.subject[0]) {
    parts.push(selections.subject[0]);
  }
  
  // Action (if space)
  if (selections.action.length > 0 && selections.action[0] && parts.length < maxTerms) {
    parts.push(selections.action[0]);
  }
  
  // Environment (simplified)
  if (selections.environment.length > 0 && selections.environment[0] && parts.length < maxTerms) {
    parts.push(`in ${selections.environment[0]}`);
  }
  
  // Single style only for plain language
  if (selections.style.length > 0 && selections.style[0] && parts.length < maxTerms) {
    parts.push(`${selections.style[0]} style`);
  }
  
  // Single lighting term
  if (selections.lighting.length > 0 && selections.lighting[0] && parts.length < maxTerms) {
    parts.push(selections.lighting[0]);
  }
  
  // Single atmosphere term
  if (selections.atmosphere.length > 0 && selections.atmosphere[0] && parts.length < maxTerms) {
    parts.push(selections.atmosphere[0]);
  }
  
  // Single colour term
  if (selections.colour.length > 0 && selections.colour[0] && parts.length < maxTerms) {
    parts.push(selections.colour[0]);
  }
  
  // Simple quality
  if (parts.length < maxTerms) {
    if (selections.fidelity.length > 0 && selections.fidelity[0]) {
      parts.push(selections.fidelity[0]);
    } else {
      parts.push('detailed');
    }
  }
  
  return parts.join(', ');
}

function generateTier4Negative(selections: PromptSelections): string {
  // Keep negatives minimal for plain language
  const negatives = selections.negative.length > 0
    ? selections.negative.slice(0, 2)
    : ['blurry', 'low quality'];
  
  return negatives.join(', ');
}

// ============================================================================
// MAIN EXPORT FUNCTIONS
// ============================================================================

/**
 * Generate all 4 tier prompts from selections
 */
export function generateAllTierPrompts(selections: PromptSelections): GeneratedPrompts {
  return {
    tier1: generateTier1(selections),
    tier2: generateTier2(selections),
    tier3: generateTier3(selections),
    tier4: generateTier4(selections),
    negative: {
      tier1: generateTier1Negative(selections),
      tier2: generateTier2Negative(selections),
      tier3: generateTier3Negative(selections),
      tier4: generateTier4Negative(selections)
    }
  };
}

/**
 * Generate prompt for a specific tier
 */
export function generatePromptForTier(
  selections: PromptSelections,
  tier: PlatformTier
): { positive: string; negative: string } {
  switch (tier) {
    case 1:
      return { positive: generateTier1(selections), negative: generateTier1Negative(selections) };
    case 2:
      return { positive: generateTier2(selections), negative: generateTier2Negative(selections) };
    case 3:
      return { positive: generateTier3(selections), negative: generateTier3Negative(selections) };
    case 4:
      return { positive: generateTier4(selections), negative: generateTier4Negative(selections) };
    default:
      return { positive: generateTier4(selections), negative: generateTier4Negative(selections) };
  }
}

/**
 * Get combined prompt text (for copy)
 */
export function getCombinedPromptText(
  selections: PromptSelections,
  tier: PlatformTier,
  includeNegative: boolean = true
): string {
  const { positive, negative } = generatePromptForTier(selections, tier);
  
  if (!includeNegative || !negative) {
    return positive;
  }
  
  // Tier 2 has --no inline
  if (tier === 2) {
    return `${positive} ${negative}`;
  }
  
  // Tier 3 doesn't use separate negative
  if (tier === 3) {
    return positive;
  }
  
  // Tier 1 and 4 have separate negative
  return `${positive}\n\nNegative prompt: ${negative}`;
}

/**
 * Get prompt character count
 */
export function getPromptLength(selections: PromptSelections, tier: PlatformTier): number {
  const { positive, negative } = generatePromptForTier(selections, tier);
  return positive.length + (negative?.length || 0);
}

/**
 * Check if prompt exceeds recommended length for tier
 */
export function isPromptTooLong(selections: PromptSelections, tier: PlatformTier): boolean {
  const lengths: Record<PlatformTier, number> = {
    1: 500,   // CLIP has ~77 token limit per segment
    2: 6000,  // Midjourney is generous
    3: 4000,  // DALL-E has 4000 char limit
    4: 200    // Plain language should be short
  };
  
  return getPromptLength(selections, tier) > lengths[tier];
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  TIER_CONFIGS,
  CATEGORY_WEIGHTS,
  NEGATIVE_TO_POSITIVE,
  generateTier1,
  generateTier2,
  generateTier3,
  generateTier4
};

// PromptSelections is already exported as interface above
