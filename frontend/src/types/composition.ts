// src/types/composition.ts
// ============================================================================
// COMPOSITION ENGINE TYPES
// ============================================================================
// Type definitions for the composition engine, aspect ratios, and mode toggle.
// All types are strictly defined with whitelist validation.
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

// ============================================================================
// COMPOSITION MODE
// ============================================================================

/**
 * Composition mode determines how AR composition packs are assembled.
 * - 'static': Fixed pack per AR (predictable, beginner-friendly)
 * - 'dynamic': Context-aware pack from all selections (intelligent, power-user)
 */
export type CompositionMode = 'static' | 'dynamic';

/** Valid composition modes (whitelist for validation) */
export const VALID_COMPOSITION_MODES: readonly CompositionMode[] = ['static', 'dynamic'] as const;

/** Default composition mode for new users */
export const DEFAULT_COMPOSITION_MODE: CompositionMode = 'dynamic';

/**
 * Type guard for composition mode validation
 */
export function isValidCompositionMode(value: unknown): value is CompositionMode {
  return typeof value === 'string' && VALID_COMPOSITION_MODES.includes(value as CompositionMode);
}

// ============================================================================
// ASPECT RATIOS
// ============================================================================

/**
 * Aspect ratio identifiers - strictly typed whitelist
 */
export type AspectRatioId =
  | '1:1'
  | '4:5'
  | '3:4'
  | '2:3'
  | '3:2'
  | '4:3'
  | '16:9'
  | '9:16'
  | '21:9';

/** Valid aspect ratio IDs (whitelist for validation) */
export const VALID_ASPECT_RATIOS: readonly AspectRatioId[] = [
  '1:1',
  '4:5',
  '3:4',
  '2:3',
  '3:2',
  '4:3',
  '16:9',
  '9:16',
  '21:9',
] as const;

/**
 * Type guard for aspect ratio validation
 */
export function isValidAspectRatio(value: unknown): value is AspectRatioId {
  return typeof value === 'string' && VALID_ASPECT_RATIOS.includes(value as AspectRatioId);
}

/** AR orientation type */
export type AROrientation = 'square' | 'portrait' | 'landscape';

/**
 * Aspect ratio definition with all metadata
 */
export interface AspectRatioDefinition {
  /** Unique identifier (e.g., '16:9') */
  id: AspectRatioId;
  /** Human-readable label */
  label: string;
  /** Width component of ratio */
  width: number;
  /** Height component of ratio */
  height: number;
  /** Orientation category */
  orientation: AROrientation;
  /** Use case description */
  useCase: string;
  /** Platform examples */
  useCasePlatforms: string[];
  /** Static composition pack text */
  staticPack: string;
  /** Dynamic composition hints by category */
  dynamicHints: {
    placement: string[];
    framing: string[];
    depth: string[];
    emphasis: string[];
  };
}

/**
 * Platform AR support configuration
 */
export interface PlatformARSupport {
  /** Whether platform accepts --ar parameter */
  nativeSupport: boolean;
  /** Which ratios are natively supported */
  supportedRatios: AspectRatioId[];
  /** Syntax template (e.g., '--ar {width}:{height}') */
  syntax: string | null;
  /** Default ratio for platform */
  defaultRatio: AspectRatioId | null;
  /** Notes about platform support */
  notes: string;
}

// ============================================================================
// COMPOSITION PACK OUTPUT
// ============================================================================

/**
 * Assembled composition pack ready for prompt injection
 */
export interface CompositionPack {
  /** The composition text to inject into prompt */
  text: string;
  /** Whether to append native AR parameter */
  useNativeAR: boolean;
  /** The AR parameter string (e.g., '--ar 16:9') */
  arParameter: string | null;
  /** Mode used to generate this pack */
  mode: CompositionMode;
  /** Whether the selected AR is natively supported by platform */
  isNativelySupported: boolean;
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

/**
 * Composition-related user preferences
 * Stored in Clerk publicMetadata for authenticated users
 * Stored in localStorage for anonymous users
 */
export interface CompositionPreferences {
  /** Selected composition mode */
  compositionMode: CompositionMode;
  /** Last selected aspect ratio (optional) */
  lastAspectRatio?: AspectRatioId | null;
}

/** Default composition preferences */
export const DEFAULT_COMPOSITION_PREFERENCES: CompositionPreferences = {
  compositionMode: DEFAULT_COMPOSITION_MODE,
  lastAspectRatio: null,
};

// ============================================================================
// PROMPT BUILDER INTEGRATION
// ============================================================================

/**
 * Extended prompt selections including aspect ratio
 */
export interface ExtendedPromptSelections {
  subject?: string[];
  action?: string[];
  style?: string[];
  environment?: string[];
  composition?: string[];
  camera?: string[];
  lighting?: string[];
  colour?: string[];
  atmosphere?: string[];
  materials?: string[];
  fidelity?: string[];
  negative?: string[];
  /** Aspect ratio selection */
  aspectRatio?: AspectRatioId | null;
}

// ============================================================================
// SECURITY CONSTANTS
// ============================================================================

/** Maximum length for composition text (prevents injection) */
export const MAX_COMPOSITION_TEXT_LENGTH = 500;

/** Maximum number of dynamic hints to include */
export const MAX_DYNAMIC_HINTS = 12;

/** Storage key for localStorage (namespaced to prevent collisions) */
export const COMPOSITION_STORAGE_KEY = 'promagen_composition_mode' as const;

/** Storage key for last AR selection */
export const ASPECT_RATIO_STORAGE_KEY = 'promagen_aspect_ratio' as const;
