// src/types/prompt-limits.ts
// ============================================================================
// PROMPT LIMITS TYPES
// ============================================================================
// TypeScript types for the Text Length Optimizer feature.
// Provides type-safe access to platform-specific prompt length limits.
//
// Security:
// - All types are readonly to prevent runtime mutation
// - Strict typing prevents injection via unexpected fields
// - Validated at build time against JSON schema
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

/**
 * Impact severity category for optimization prioritization.
 * - 'high': SD/CLIP-based platforms where token limits cause quality loss (15-25%)
 * - 'moderate': Platforms with noticeable improvement (8-15%)
 * - 'low': Platforms with minimal impact (1-8%)
 */
export type ImpactCategory = 'high' | 'moderate' | 'low';

/**
 * Model architecture type for understanding prompt processing.
 * - 'clip-based': Uses CLIP encoder with ~77 token limit (SD, Leonardo, etc.)
 * - 'transformer': GPT-style processing (DALL-E 3, Imagen, Flux)
 * - 'proprietary': Unknown/custom architecture (Midjourney)
 * - 'unknown': Insufficient data to classify
 */
export type ModelArchitecture = 'clip-based' | 'transformer' | 'proprietary' | 'unknown';

/**
 * Current prompt length status relative to platform ideal.
 * Used for visual indicator color coding.
 */
export type LengthStatus = 'under' | 'optimal' | 'over' | 'critical';

/**
 * Prompt optimization limits for a single platform.
 * All fields validated against JSON schema at build time.
 */
export interface PromptLimit {
  /** Maximum character limit (null if unlimited) */
  readonly maxChars: number | null;
  
  /** Lower bound of optimal range (characters) */
  readonly idealMin: number;
  
  /** Upper bound of optimal range (characters) */
  readonly idealMax: number;
  
  /** Approximate optimal word count for tooltip display */
  readonly idealWords: number;
  
  /** CLIP/encoder token limit if applicable (null if not token-limited) */
  readonly tokenLimit: number | null;
  
  /** Platform-specific behavior insight for tooltip */
  readonly platformNote: string;
  
  /** What optimization achieves - shown in tooltip */
  readonly optimizationBenefit: string;
  
  /** Expected improvement range (e.g., "5-10%") */
  readonly qualityImpact: string;
  
  /** Impact severity for internal prioritization */
  readonly impactCategory: ImpactCategory;
  
  /** Model architecture type */
  readonly architecture: ModelArchitecture;
  
  /** Research provenance for auditability */
  readonly sources: readonly string[];
}

/**
 * Full prompt limits configuration from JSON.
 * Loaded once at module initialization, never mutated.
 */
export interface PromptLimitsConfig {
  readonly $schema: string;
  readonly version: string;
  readonly lastUpdated: string;
  readonly meta?: {
    readonly description?: string;
    readonly authorityDoc?: string;
    readonly researchNotes?: string;
  };
  readonly providers: Readonly<Record<string, PromptLimit>>;
}

/**
 * Result of prompt length analysis.
 * Returned by the optimization hook.
 */
export interface PromptLengthAnalysis {
  /** Current prompt character count */
  readonly currentLength: number;
  
  /** Current word count (approximate) */
  readonly currentWords: number;
  
  /** Platform's ideal maximum */
  readonly idealMax: number;
  
  /** Platform's ideal minimum */
  readonly idealMin: number;
  
  /** Platform's hard maximum (null if unlimited) */
  readonly hardMax: number | null;
  
  /** Current status for color coding */
  readonly status: LengthStatus;
  
  /** Whether optimization would trim the prompt */
  readonly needsTrimming: boolean;
  
  /** How many characters need trimming (0 if within range) */
  readonly excessChars: number;
  
  /** How many more characters recommended (0 if sufficient) */
  readonly shortfall: number;
  
  /** Categories suggested to add if under minimum */
  readonly suggestedCategories: readonly string[];
}

/**
 * Result of prompt optimization (trimming).
 * Returned when optimizer processes a prompt.
 */
export interface OptimizedPrompt {
  /** Original prompt text */
  readonly original: string;
  
  /** Optimized prompt text (may be same as original) */
  readonly optimized: string;
  
  /** Original character count */
  readonly originalLength: number;
  
  /** Optimized character count */
  readonly optimizedLength: number;
  
  /** Whether any trimming occurred */
  readonly wasTrimmed: boolean;
  
  /** Categories that were removed during trimming */
  readonly removedCategories: readonly string[];
  
  /** Final status after optimization */
  readonly status: LengthStatus;
}

/**
 * Props for the TextLengthOptimizer toggle component.
 */
export interface TextLengthOptimizerProps {
  /** Current optimizer enabled state */
  readonly isEnabled: boolean;
  
  /** Callback when toggle is clicked */
  readonly onToggle: (enabled: boolean) => void;
  
  /** Platform ID for tooltip content */
  readonly platformId: string;
  
  /** Platform display name for tooltip header */
  readonly platformName: string;
  
  /** Whether toggle is disabled (Static mode active) */
  readonly disabled?: boolean;
  
  /** Current prompt length analysis for tooltip display */
  readonly analysis: PromptLengthAnalysis | null;
}

/**
 * Props for the LengthIndicator component.
 */
export interface LengthIndicatorProps {
  /** Current analysis data */
  readonly analysis: PromptLengthAnalysis;
  
  /** Original prompt length (before optimization) */
  readonly originalLength: number;
  
  /** Whether optimizer will trim on copy */
  readonly willTrim: boolean;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to validate a PromptLimit object.
 * Used for runtime validation when loading JSON.
 */
export function isValidPromptLimit(obj: unknown): obj is PromptLimit {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const candidate = obj as Record<string, unknown>;
  
  // Required fields
  if (typeof candidate.idealMin !== 'number' || candidate.idealMin < 1) return false;
  if (typeof candidate.idealMax !== 'number' || candidate.idealMax < 1) return false;
  if (typeof candidate.idealWords !== 'number' || candidate.idealWords < 1) return false;
  if (typeof candidate.platformNote !== 'string' || candidate.platformNote.length === 0) return false;
  if (typeof candidate.optimizationBenefit !== 'string') return false;
  if (typeof candidate.qualityImpact !== 'string') return false;
  
  // Nullable fields
  if (candidate.maxChars !== null && typeof candidate.maxChars !== 'number') return false;
  if (candidate.tokenLimit !== null && typeof candidate.tokenLimit !== 'number') return false;
  
  // Enum fields
  const validImpactCategories = ['high', 'moderate', 'low'];
  if (!validImpactCategories.includes(candidate.impactCategory as string)) return false;
  
  const validArchitectures = ['clip-based', 'transformer', 'proprietary', 'unknown'];
  if (!validArchitectures.includes(candidate.architecture as string)) return false;
  
  // Array field
  if (!Array.isArray(candidate.sources) || candidate.sources.length === 0) return false;
  
  return true;
}

/**
 * Type guard for LengthStatus enum.
 */
export function isValidLengthStatus(status: unknown): status is LengthStatus {
  return status === 'under' || status === 'optimal' || status === 'over' || status === 'critical';
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default prompt limit for unknown platforms.
 * Conservative settings that work safely across most platforms.
 */
export const DEFAULT_PROMPT_LIMIT: Readonly<PromptLimit> = {
  maxChars: 1000,
  idealMin: 150,
  idealMax: 350,
  idealWords: 45,
  tokenLimit: null,
  platformNote: 'Default settings for optimal cross-platform compatibility.',
  optimizationBenefit: 'Balanced prompt length for general use.',
  qualityImpact: '5-10%',
  impactCategory: 'moderate',
  architecture: 'unknown',
  sources: ['default-fallback'],
} as const;

/**
 * Category priority for trimming (lowest priority first).
 * Protected categories (subject, style) are never auto-trimmed.
 */
export const TRIM_PRIORITY = [
  'fidelity',      // Quality boosters - nice to have
  'materials',     // Textures - enhancement
  'atmosphere',    // Mood - enhancement
  'colour',        // Grade - enhancement
  'composition',   // Framing - can be implied
  'camera',        // Lens - can be implied
  'lighting',      // Important but trimmable
  'environment',   // Setting - semi-core
  'action',        // Pose - core but trimmable
  // 'style',      // NEVER TRIM - defines look
  // 'subject',    // NEVER TRIM - core identity
] as const;

/**
 * Categories that are never auto-trimmed.
 */
export const PROTECTED_CATEGORIES = ['subject', 'style'] as const;

/**
 * Category suggestions when prompt is under minimum.
 * Ordered by impact on image quality.
 */
export const CATEGORY_SUGGESTIONS = [
  { category: 'lighting', label: 'Lighting', impact: 'high' },
  { category: 'environment', label: 'Environment', impact: 'high' },
  { category: 'camera', label: 'Camera angle', impact: 'moderate' },
  { category: 'colour', label: 'Colour grade', impact: 'moderate' },
  { category: 'atmosphere', label: 'Atmosphere', impact: 'moderate' },
  { category: 'fidelity', label: 'Quality terms', impact: 'low' },
] as const;
