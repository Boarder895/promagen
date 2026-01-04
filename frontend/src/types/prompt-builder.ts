// src/types/prompt-builder.ts
// TypeScript types for the enhanced prompt builder system with 12 categories
// Version 3.1.0 - All selection limits set to 1 except negative (5)

/**
 * Available prompt categories - 12 total
 * Order: Subject → Action → Style → Environment → Composition → Camera →
 *        Lighting → Colour → Atmosphere → Materials → Fidelity → Negative
 */
export type PromptCategory =
  | 'subject'      // Subject (identity + key attributes) - limit 1
  | 'action'       // Action / Pose - limit 1
  | 'style'        // Style / Rendering / References - limit 1
  | 'environment'  // Environment (location + time + background) - limit 1
  | 'composition'  // Composition / Framing - limit 1
  | 'camera'       // Camera (angle + lens + DoF) - limit 1
  | 'lighting'     // Lighting (type + direction + intensity) - limit 1
  | 'colour'       // Colour / Grade - limit 1
  | 'atmosphere'   // Atmosphere (fog, haze, rain, particles) - limit 1
  | 'materials'    // Materials / Texture - limit 1
  | 'fidelity'     // Quality boosters (8K, masterpiece, sharp focus) - limit 1
  | 'negative';    // Constraints / Negative prompt - limit 5

/** Canonical category order for optimal prompt construction */
export const CATEGORY_ORDER: PromptCategory[] = [
  'subject',
  'action',
  'style',
  'environment',
  'composition',
  'camera',
  'lighting',
  'colour',
  'atmosphere',
  'materials',
  'fidelity',
  'negative',
];

/** Selection limits for each category - ALL set to 1 except negative (5) */
export const CATEGORY_LIMITS: Record<PromptCategory, number> = {
  subject: 1,
  action: 1,
  style: 1,
  environment: 1,
  composition: 1,
  camera: 1,
  lighting: 1,
  colour: 1,
  atmosphere: 1,
  materials: 1,
  fidelity: 1,
  negative: 5,
};

/** Categories marked as "Core" (always included in Randomise) */
export const CORE_CATEGORIES: PromptCategory[] = [
  'subject',
  'action',
  'style',
  'environment',
  'lighting',
  'camera',
  'colour',
];

/** Categories marked as "Secondary" (always included in Randomise now) */
export const SECONDARY_CATEGORIES: PromptCategory[] = [
  'composition',
  'atmosphere',
  'materials',
  'fidelity',
];

/** Configuration for a single category */
export interface CategoryConfig {
  label: string;
  description: string;
  options: string[];
  tooltipGuidance: string;
}

/** Full prompt options JSON structure */
export interface PromptOptions {
  _meta: {
    version: string;
    description: string;
    updated: string;
  };
  categories: Record<PromptCategory, CategoryConfig>;
}

/**
 * How negative prompts are handled by the platform
 * - 'none': Platform doesn't support negative prompts at all
 * - 'inline': Negatives are embedded inline (e.g., Midjourney's --no)
 * - 'separate': Platform has a dedicated negative prompt field
 * - 'converted': Negatives are converted to positive equivalents (e.g., "blurry" → "sharp focus")
 */
export type NegativeSupport = 'none' | 'inline' | 'separate' | 'converted';

/** Platforms that support native negative prompts (free text allowed) */
export const PLATFORMS_WITH_NATIVE_NEGATIVE: string[] = [
  // Inline support (--no or without)
  'midjourney',
  'bluewillow',
  'ideogram',
  // Separate field support
  'stability',
  'leonardo',
  'flux',
  'novelai',
  'playground',
  'nightcafe',
  'lexica',
  'openart',
  'dreamstudio',
  'getimg',
  'dreamlike',
];

/** Platform-specific prompt format configuration */
export interface PlatformFormat {
  promptStyle: 'keywords' | 'natural';
  separator: string;
  negativeSupport: NegativeSupport;
  negativeSyntax?: string | null;
  categoryOrder: PromptCategory[];
  wrapNegativeInPrompt?: boolean;
  negativeWrapPrefix?: string;
  supportsWeighting?: boolean;
  weightingSyntax?: string;
  tips?: string;
  exampleOutput?: string;
  suffixParams?: string[];
  tokenLimit?: number;
  sweetSpot?: number;
}

/** Full platform formats JSON structure */
export interface PlatformFormats {
  _meta: {
    version: string;
    description: string;
    updated: string;
  };
  _defaults: PlatformFormat;
  platforms: Record<string, PlatformFormat>;
}

/** User selections from dropdowns */
export type PromptSelections = Partial<Record<PromptCategory, string[]>>;

/** Assembled prompt output */
export interface AssembledPrompt {
  /** Main positive prompt text */
  positive: string;
  /** Negative prompt (only if platform supports separate field) */
  negative?: string;
  /** Platform-specific tips for the user */
  tips?: string;
  /** Whether this platform supports negative prompts at all */
  supportsNegative: boolean;
  /** How negatives are handled */
  negativeMode: NegativeSupport;
  /** Was the prompt trimmed to fit token limits */
  wasTrimmed?: boolean;
}

/** State for a single category in the UI */
export interface CategoryState {
  selected: string[];
  customValue: string;
}

/** Full prompt builder state */
export type PromptBuilderState = Record<PromptCategory, CategoryState>;

/** Props for the Combobox component */
export interface ComboboxProps {
  id: string;
  label: string;
  description?: string;
  tooltipGuidance?: string;
  options: string[];
  selected: string[];
  customValue: string;
  onSelectChange: (selected: string[]) => void;
  onCustomChange: (value: string) => void;
  placeholder?: string;
  maxSelections?: number;
  maxCustomChars?: number;
  /** Whether to show the free text input (default: true) */
  allowFreeText?: boolean;
}
