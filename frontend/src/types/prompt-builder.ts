// src/types/prompt-builder.ts
// TypeScript types for the enhanced prompt builder system with 12 categories
// Version 3.2.0 - Rich phrase handling + WeatherCategoryMap + Prompt DNA
// Changelog:
//   3.2.0 - Added WeatherCategoryMap, PromptSource, PromptDNAFingerprint
//   3.1.0 - All selection limits set to 1 except negative (5)

/**
 * Available prompt categories - 12 total
 * Order: Subject → Action → Style → Environment → Composition → Camera →
 *        Lighting → Colour → Atmosphere → Materials → Fidelity → Negative
 */
export type PromptCategory =
  | 'subject' // Subject (identity + key attributes) - limit 1
  | 'action' // Action / Pose - limit 1
  | 'style' // Style / Rendering / References - limit 1
  | 'environment' // Environment (location + time + background) - limit 1
  | 'composition' // Composition / Framing - limit 1
  | 'camera' // Camera (angle + lens + DoF) - limit 1
  | 'lighting' // Lighting (type + direction + intensity) - limit 1
  | 'colour' // Colour / Grade - limit 1
  | 'atmosphere' // Atmosphere (fog, haze, rain, particles) - limit 1
  | 'materials' // Materials / Texture - limit 1
  | 'fidelity' // Quality boosters (8K, masterpiece, sharp focus) - limit 1
  | 'negative'; // Constraints / Negative prompt - limit 5

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
  'lexica',
  'dreamstudio',
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

  // ── Tier-aware assembly config ──
  // Quality terms auto-prepended before user selections (e.g., SD "masterpiece")
  qualityPrefix?: string[];
  // Quality terms auto-appended after user selections (e.g., Flux "8K")
  qualitySuffix?: string[];
  // Standard quality negatives auto-included with user negatives
  qualityNegative?: string[];
  // Per-category weighting — maps category key to emphasis weight.
  // Applied using weightingSyntax. e.g., { "subject": 1.2, "lighting": 1.1 }
  weightedCategories?: Record<string, number>;
  // Categories to front-load in output for maximum platform impact.
  // These appear first, before remaining categoryOrder entries.
  // For CLIP: weighted categories. For MJ: subject + style + mood.
  // For NatLang: controls sentence clause order after the core subject+action nucleus.
  impactPriority?: PromptCategory[];
  /** Call 3 group knowledge — short platform-specific trait injected into the optimisation system prompt.
   *  Lives here (not in builder code) so all platform traits have one maintenance point. */
  groupKnowledge?: string;
  /** Call 3 routing mode — controls whether GPT is called or a deterministic path is used. */
  call3Mode?: 'reorder_only' | 'format_only' | 'gpt_rewrite' | 'pass_through' | 'mj_deterministic';
  /** Whether semantic rewriting is allowed on Call 3 for this platform. */
  semanticRewriteAllowed?: boolean;
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
  /**
   * v11.1.1 Improvement 5: Estimated CLIP token count for the positive prompt.
   * CLIP uses BPE tokenisation where ~1.3 words ≈ 1 token.
   * Standard CLIP models process 77 tokens per encoding pass.
   */
  estimatedTokens?: number;
  /** Platform's configured token limit (e.g., 77 for CLIP, 60 for MJ) */
  tokenLimit?: number;

  // ── Part 5/6: Budget-Aware Conversion Metadata ──

  /** Conversion results for transparency panel (fidelity + negative) */
  conversions?: ConversionResultMeta[];
  /** Budget state at assembly time */
  conversionBudget?: {
    ceiling: number;
    coreLength: number;
    remaining: number;
    unit: 'words';
    source: 'learned' | 'static';
  };
}

/**
 * Part 6: Metadata for a single conversion (fidelity or negative).
 * Attached to AssembledPrompt.conversions for the transparency panel.
 */
export interface ConversionResultMeta {
  /** User's original selection: "8K", "blurry" */
  from: string;
  /** Converted output: "--quality 2", "sharp focus" */
  to: string;
  /** Source category */
  category: 'fidelity' | 'negative';
  /** Made it into the prompt? */
  included: boolean;
  /** If excluded, why */
  reason?: 'budget' | 'low-coherence';
  /** Conversion score (0–1) */
  score: number;
  /** Word cost of the conversion */
  cost: number;
  /** Parametric = free (doesn't consume prompt budget) */
  isParametric: boolean;
  /** Human-readable scoring breakdown */
  scoreExplanation?: string;
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

// ============================================================================
// Prompt Source Tracking (Phase A — Unified Brain)
// ============================================================================

/**
 * Identifies where a prompt's data originated.
 * Used by the assembler to apply source-specific intelligence:
 *   - 'user': manual dropdown selections (existing behaviour, no change)
 *   - 'weather': weather intelligence computed phrases (rich phrase handling)
 *   - 'scene-starter': scene starter presets (standard dropdown terms)
 *   - 'randomiser': randomise button output (standard dropdown terms)
 */
export type PromptSource = 'user' | 'weather' | 'scene-starter' | 'randomiser';

// ============================================================================
// Weather Category Map (Phase A — Unified Brain Data Contract)
// ============================================================================

/**
 * Structured output from weather intelligence, mapped to prompt builder categories.
 *
 * The weather generator computes WHAT the scene looks like (physics, lighting,
 * camera, venue, wind, etc.) and outputs this structured map. The assembler
 * then formats it for any platform tier.
 *
 * Categories can have BOTH a dropdown selection AND a customValue:
 *   - selections: closest vocabulary match (e.g., "moonlight")
 *   - customValues: rich physics-computed phrase (e.g., "Cool white moonlight
 *     competing with focused accent lighting")
 *
 * The assembler uses customValue when present, dropdown term as fallback.
 */
export interface WeatherCategoryMap {
  /** Dropdown selections — terms that exist in vocabulary JSONs */
  selections: Partial<Record<PromptCategory, string[]>>;

  /** Custom values — rich physics-computed phrases per category */
  customValues: Partial<Record<PromptCategory, string>>;

  /** Negative terms */
  negative: string[];

  /** Optional per-category weight overrides for CLIP-tier platforms */
  weightOverrides?: Partial<Record<PromptCategory, number>>;

  /**
   * Per-category confidence score (0–1).
   *
   * Indicates how confident the mapper is about each category mapping.
   * Higher confidence = data came directly from physics computation.
   * Lower confidence  = heuristic fallback or generic default was used.
   *
   * UI can use this for:
   *   - Chip opacity (dim = low confidence → invite editing)
   *   - Tooltip hints ("AI-suggested — click to refine")
   *   - Assembler can prefer customValue (high) vs selection (low)
   *
   * Example: subject (city) = 1.0 always; lighting = 0.95 with visual truth,
   * 0.6 without; atmosphere = 0.5 with generic conditions fallback.
   */
  confidence?: Partial<Record<PromptCategory, number>>;

  /** Metadata for "Inspired by" badge + diagnostics */
  meta: WeatherCategoryMeta;
}

/**
 * Metadata attached to a WeatherCategoryMap for UI display and diagnostics.
 */
export interface WeatherCategoryMeta {
  city: string;
  venue: string;
  venueSetting: string;
  mood: string;
  conditions: string;
  emoji: string;
  tempC: number | null;
  localTime: string;
  source: 'weather-intelligence';
}

// ============================================================================
// Prompt DNA Fingerprinting (Extra 2 — Category Combination Tracking)
// ============================================================================

/**
 * A fingerprint representing a unique combination of category selections.
 * Used by the learning engine to track which COMBINATIONS produce
 * the best user engagement (likes, copies, "Try in" clicks).
 *
 * Example: "Subject=cityscape + Lighting=moonlight + Atmosphere=contemplative"
 * produces a stable hash that feeds back into vocabulary ranking.
 */
export interface PromptDNAFingerprint {
  /** Stable hash of the category combination (FNV-1a, 32-bit hex) */
  hash: string;
  /** Human-readable category breakdown */
  categories: Partial<Record<PromptCategory, string>>;
  /** Where the prompt originated */
  source: PromptSource;
  /** Platform the prompt was assembled for */
  platformId: string;
  /** Timestamp of creation (ISO 8601) */
  createdAt: string;
}

/**
 * Engagement metrics tracked per DNA fingerprint.
 * Accumulates across all users who see/interact with this combination.
 */
export interface PromptDNAScore {
  /** The fingerprint hash (FK to PromptDNAFingerprint) */
  hash: string;
  /** Total times this combination was displayed */
  impressions: number;
  /** Total likes received */
  likes: number;
  /** Total copies (clipboard) */
  copies: number;
  /** Total "Try in" clicks to prompt builder */
  tryInClicks: number;
  /** Computed quality score (0–1) = weighted(likes + copies + tryIn) / impressions */
  qualityScore: number;
  /** Last updated timestamp */
  updatedAt: string;
}
