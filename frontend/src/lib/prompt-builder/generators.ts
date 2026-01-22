/**
 * 4-Tier Prompt Generators
 * ========================
 * Transforms user selections into platform-optimized prompts.
 * 
 * Tier 1 (CLIP): Weighted keywords with (term:1.2) syntax
 * Tier 2 (Midjourney): Natural + parameters (--ar, --no, etc.)
 * Tier 3 (Natural): Full conversational sentences
 * Tier 4 (Plain): Simple, focused prompts
 * 
 * @version 1.0.0
 * @updated 2026-01-21
 */

import type { PromptSelections, GeneratedPrompts, PlatformTier } from '@/types/prompt-intelligence';

// ============================================================================
// TERM WEIGHTS BY CATEGORY (for Tier 1 CLIP)
// ============================================================================

const CATEGORY_WEIGHTS: Record<string, number> = {
  subject: 1.4,      // Highest priority
  action: 1.2,
  style: 1.3,        // Very important for style transfer
  environment: 1.1,
  composition: 1.0,
  camera: 1.0,
  lighting: 1.2,     // Important for mood
  atmosphere: 1.1,
  colour: 1.1,
  materials: 1.0,
  fidelity: 1.2      // Quality boosters need emphasis
};

// ============================================================================
// QUALITY BOOSTERS (auto-added for certain tiers)
// ============================================================================

const TIER1_QUALITY_BOOSTERS = [
  'masterpiece',
  'best quality',
  'highly detailed'
];

const TIER2_QUALITY_BOOSTERS = [
  'highly detailed',
  'professional',
  'sharp focus'
];

// ============================================================================
// NEGATIVE TO POSITIVE CONVERSIONS (for Tier 3/4)
// ============================================================================

const NEGATIVE_CONVERSIONS: Record<string, string> = {
  'blurry': 'sharp and clear',
  'low quality': 'high quality',
  'bad anatomy': 'anatomically correct',
  'deformed': 'well-proportioned',
  'ugly': 'aesthetically pleasing',
  'watermark': 'clean image',
  'signature': 'unsigned',
  'text': 'no visible text',
  'extra fingers': 'correct number of fingers',
  'missing fingers': 'complete hands',
  'bad hands': 'well-rendered hands',
  'cropped': 'full composition',
  'out of frame': 'fully in frame',
  'duplicate': 'single subject',
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
  'underexposed': 'well-lit'
};

// ============================================================================
// SENTENCE CONNECTORS (for Tier 3)
// ============================================================================

const _SUBJECT_CONNECTORS = [
  'featuring',
  'depicting',
  'showing',
  'with'
];

const STYLE_CONNECTORS = [
  'in the style of',
  'rendered as',
  'created in',
  'with the aesthetic of'
];

const ENVIRONMENT_CONNECTORS = [
  'set in',
  'located in',
  'within',
  'surrounded by'
];

const LIGHTING_CONNECTORS = [
  'illuminated by',
  'lit by',
  'bathed in',
  'under'
];

const ATMOSPHERE_CONNECTORS = [
  'with a',
  'creating a',
  'evoking',
  'radiating'
];

// ============================================================================
// TIER 1: CLIP-BASED GENERATOR
// ============================================================================

function generateTier1Prompt(selections: PromptSelections): string {
  const parts: string[] = [];
  
  // Add quality boosters first (highest weight)
  if (selections.fidelity.length === 0) {
    parts.push(...TIER1_QUALITY_BOOSTERS.map(b => `(${b}:1.3)`));
  }
  
  // Subject with high weight
  if (selections.subject.length > 0) {
    const weight = CATEGORY_WEIGHTS.subject;
    parts.push(`(${selections.subject[0]}:${weight})`);
  }
  
  // Action
  if (selections.action.length > 0) {
    const weight = CATEGORY_WEIGHTS.action;
    parts.push(`(${selections.action[0]}:${weight})`);
  }
  
  // Style(s) - can have multiple with weights
  selections.style.forEach((style: string, i: number) => {
    const weight = (CATEGORY_WEIGHTS.style ?? 1.3) - (i * 0.1); // Slightly decrease for each additional
    parts.push(`(${style}:${weight.toFixed(1)})`);
  });
  
  // Environment
  if (selections.environment.length > 0 && selections.environment[0]) {
    const weight = CATEGORY_WEIGHTS.environment;
    parts.push(`(${selections.environment[0]}:${weight})`);
  }
  
  // Composition
  if (selections.composition.length > 0 && selections.composition[0]) {
    parts.push(selections.composition[0]);
  }
  
  // Camera
  if (selections.camera.length > 0 && selections.camera[0]) {
    parts.push(selections.camera[0]);
  }
  
  // Lighting(s)
  selections.lighting.forEach((light: string, i: number) => {
    const weight = (CATEGORY_WEIGHTS.lighting ?? 1.2) - (i * 0.1);
    parts.push(`(${light}:${weight.toFixed(1)})`);
  });
  
  // Atmosphere(s)
  selections.atmosphere.forEach((atmo: string) => {
    parts.push(`(${atmo}:${CATEGORY_WEIGHTS.atmosphere ?? 1.1})`);
  });
  
  // Colour(s)
  selections.colour.forEach((colour: string) => {
    parts.push(`(${colour}:${CATEGORY_WEIGHTS.colour ?? 1.1})`);
  });
  
  // Materials
  selections.materials.forEach((mat: string) => {
    parts.push(mat);
  });
  
  // Fidelity boosters with weights
  selections.fidelity.forEach((fid: string) => {
    parts.push(`(${fid}:${CATEGORY_WEIGHTS.fidelity ?? 1.2})`);
  });
  
  return parts.join(', ');
}

function generateTier1Negative(selections: PromptSelections): string {
  const negatives = selections.negative.length > 0
    ? selections.negative
    : ['blurry', 'low quality', 'bad anatomy', 'watermark', 'signature'];
  
  return negatives.join(', ');
}

// ============================================================================
// TIER 2: MIDJOURNEY GENERATOR
// ============================================================================

function generateTier2Prompt(selections: PromptSelections): string {
  const parts: string[] = [];
  
  // Subject
  if (selections.subject.length > 0 && selections.subject[0]) {
    parts.push(selections.subject[0]);
  }
  
  // Action
  if (selections.action.length > 0 && selections.action[0]) {
    parts.push(selections.action[0]);
  }
  
  // Environment with context
  if (selections.environment.length > 0 && selections.environment[0]) {
    parts.push(`in ${selections.environment[0]}`);
  }
  
  // Style(s) - MJ handles multiple well
  if (selections.style.length > 0) {
    // Use :: for style weighting in MJ
    const styleStr = selections.style.map((s: string, i: number) => {
      const weight = 2 - (i * 0.25);
      return `${s}::${weight.toFixed(1)}`;
    }).join(' ');
    parts.push(styleStr);
  }
  
  // Composition
  if (selections.composition.length > 0 && selections.composition[0]) {
    parts.push(selections.composition[0]);
  }
  
  // Camera
  if (selections.camera.length > 0 && selections.camera[0]) {
    parts.push(selections.camera[0]);
  }
  
  // Lighting(s)
  if (selections.lighting.length > 0) {
    parts.push(selections.lighting.join(', '));
  }
  
  // Atmosphere
  if (selections.atmosphere.length > 0) {
    parts.push(`${selections.atmosphere.join(', ')} atmosphere`);
  }
  
  // Colour
  if (selections.colour.length > 0) {
    parts.push(selections.colour.join(', '));
  }
  
  // Materials
  if (selections.materials.length > 0) {
    parts.push(selections.materials.join(', '));
  }
  
  // Fidelity
  if (selections.fidelity.length > 0) {
    parts.push(selections.fidelity.join(', '));
  } else {
    parts.push(...TIER2_QUALITY_BOOSTERS);
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
// TIER 3: NATURAL LANGUAGE GENERATOR
// ============================================================================

function generateTier3Prompt(selections: PromptSelections): string {
  const sentences: string[] = [];
  
  // Build the main subject sentence
  let mainSentence = '';
  
  // Article + Subject
  if (selections.subject.length > 0) {
    const subject = selections.subject[0] ?? 'scene';
    const article = /^[aeiou]/i.test(subject) ? 'An' : 'A';
    mainSentence = `${article} ${subject}`;
  } else {
    mainSentence = 'A scene';
  }
  
  // Add action
  if (selections.action.length > 0 && selections.action[0]) {
    mainSentence += ` ${selections.action[0]}`;
  }
  
  // Add environment
  if (selections.environment.length > 0 && selections.environment[0]) {
    const connector = ENVIRONMENT_CONNECTORS[Math.floor(Math.random() * ENVIRONMENT_CONNECTORS.length)] ?? 'in';
    mainSentence += ` ${connector} ${selections.environment[0]}`;
  }
  
  sentences.push(mainSentence + '.');
  
  // Style sentence
  if (selections.style.length > 0 && selections.style[0]) {
    const connector = STYLE_CONNECTORS[Math.floor(Math.random() * STYLE_CONNECTORS.length)] ?? 'in';
    if (selections.style.length === 1) {
      sentences.push(`Rendered ${connector} ${selections.style[0]}.`);
    } else {
      const lastStyle = selections.style[selections.style.length - 1] ?? '';
      sentences.push(`The style blends ${selections.style.slice(0, -1).join(', ')} and ${lastStyle}.`);
    }
  }
  
  // Lighting and atmosphere sentence
  const moodParts: string[] = [];
  if (selections.lighting.length > 0 && selections.lighting[0]) {
    const connector = LIGHTING_CONNECTORS[Math.floor(Math.random() * LIGHTING_CONNECTORS.length)] ?? 'with';
    moodParts.push(`${connector} ${selections.lighting[0]}`);
  }
  if (selections.atmosphere.length > 0 && selections.atmosphere[0]) {
    const connector = ATMOSPHERE_CONNECTORS[Math.floor(Math.random() * ATMOSPHERE_CONNECTORS.length)] ?? 'and';
    moodParts.push(`${connector} ${selections.atmosphere[0]} mood`);
  }
  if (moodParts.length > 0) {
    sentences.push(`The scene is ${moodParts.join(', ')}.`);
  }
  
  // Colour and composition
  const technicalParts: string[] = [];
  if (selections.colour.length > 0) {
    technicalParts.push(`${selections.colour[0]} color palette`);
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
  if (selections.materials.length > 0) {
    sentences.push(`Rich ${selections.materials.join(' and ')} textures throughout.`);
  }
  
  // Quality
  if (selections.fidelity.length > 0) {
    sentences.push(`${selections.fidelity.join(', ')} quality.`);
  }
  
  // Convert negative to positive for natural language
  const positiveConversions: string[] = [];
  selections.negative.forEach((neg: string) => {
    const positive = NEGATIVE_CONVERSIONS[neg.toLowerCase()];
    if (positive) {
      positiveConversions.push(positive);
    }
  });
  if (positiveConversions.length > 0) {
    sentences.push(`The image should be ${positiveConversions.slice(0, 3).join(', ')}.`);
  }
  
  return sentences.join(' ');
}

function generateTier3Negative(selections: PromptSelections): string {
  // Natural language platforms don't use separate negative prompts
  // Instead, we convert to "without X" phrasing
  if (selections.negative.length === 0) return '';
  
  const negatives = selections.negative.slice(0, 3);
  return `Avoid: ${negatives.join(', ')}.`;
}

// ============================================================================
// TIER 4: PLAIN LANGUAGE GENERATOR
// ============================================================================

function generateTier4Prompt(selections: PromptSelections): string {
  const parts: string[] = [];
  
  // Keep it simple - just the essentials
  if (selections.subject.length > 0 && selections.subject[0]) {
    parts.push(selections.subject[0]);
  }
  
  if (selections.action.length > 0 && selections.action[0]) {
    parts.push(selections.action[0]);
  }
  
  if (selections.environment.length > 0 && selections.environment[0]) {
    parts.push(`in ${selections.environment[0]}`);
  }
  
  // Only one style for plain language
  if (selections.style.length > 0 && selections.style[0]) {
    parts.push(`${selections.style[0]} style`);
  }
  
  // Simplify lighting to mood
  if (selections.lighting.length > 0 && selections.lighting[0]) {
    parts.push(selections.lighting[0]);
  }
  
  // One atmosphere term
  if (selections.atmosphere.length > 0 && selections.atmosphere[0]) {
    parts.push(selections.atmosphere[0]);
  }
  
  // Skip technical details for plain language
  // Just add "high quality" if no fidelity selected
  if (selections.fidelity.length > 0 && selections.fidelity[0]) {
    parts.push(selections.fidelity[0]);
  } else {
    parts.push('detailed');
  }
  
  return parts.join(', ');
}

function generateTier4Negative(selections: PromptSelections): string {
  // Keep negatives minimal for plain language platforms
  const negatives = selections.negative.length > 0
    ? selections.negative.slice(0, 2)
    : ['blurry', 'low quality'];
  
  return negatives.join(', ');
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateAllTierPrompts(selections: PromptSelections): GeneratedPrompts {
  return {
    tier1: generateTier1Prompt(selections),
    tier2: generateTier2Prompt(selections),
    tier3: generateTier3Prompt(selections),
    tier4: generateTier4Prompt(selections),
    negative: {
      tier1: generateTier1Negative(selections),
      tier2: generateTier2Negative(selections),
      tier3: generateTier3Negative(selections),
      tier4: generateTier4Negative(selections)
    }
  };
}

export function generatePromptForTier(
  selections: PromptSelections,
  tier: PlatformTier
): { positive: string; negative: string } {
  const all = generateAllTierPrompts(selections);
  
  switch (tier) {
    case 1:
      return { positive: all.tier1, negative: all.negative.tier1 };
    case 2:
      return { positive: all.tier2, negative: all.negative.tier2 };
    case 3:
      return { positive: all.tier3, negative: all.negative.tier3 };
    case 4:
      return { positive: all.tier4, negative: all.negative.tier4 };
    default:
      return { positive: all.tier4, negative: all.negative.tier4 };
  }
}

// ============================================================================
// PROMPT PREVIEW (combined for display)
// ============================================================================

export function getPromptPreview(
  selections: PromptSelections,
  tier: PlatformTier,
  includeNegative: boolean = false
): string {
  const { positive, negative } = generatePromptForTier(selections, tier);
  
  if (!includeNegative || !negative) {
    return positive;
  }
  
  // Format based on tier
  if (tier === 2) {
    // Midjourney: append --no
    return `${positive} ${negative}`;
  }
  
  return positive;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  generateTier1Prompt,
  generateTier2Prompt,
  generateTier3Prompt,
  generateTier4Prompt,
  NEGATIVE_CONVERSIONS,
  CATEGORY_WEIGHTS
};
