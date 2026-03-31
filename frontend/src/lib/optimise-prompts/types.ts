// src/lib/optimise-prompts/types.ts
// ============================================================================
// OPTIMISE-PROMPTS SHARED TYPES
// ============================================================================
// Types shared across all group-specific system prompt builders.
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md
// Used by: All group builders + resolve-group-prompt.ts
// Existing features preserved: Yes (new file).
// ============================================================================

import type { ComplianceResult } from '@/lib/harmony-compliance';

/**
 * Provider context passed from the client.
 * Same shape as the Zod ProviderContextSchema in the route.
 */
export interface OptimiseProviderContext {
  name: string;
  tier: number;
  promptStyle: string;
  sweetSpot: number;
  tokenLimit: number;
  maxChars: number | null;
  idealMin: number;
  idealMax: number;
  qualityPrefix?: string[];
  weightingSyntax?: string;
  supportsWeighting?: boolean;
  negativeSupport: 'separate' | 'inline' | 'none' | 'converted';
  categoryOrder?: string[];
  /** Platform-specific trait from platform-formats.json — injected into system prompt */
  groupKnowledge?: string;
}

/**
 * What a group builder returns.
 * The system prompt string + an optional group-specific compliance function.
 */
export interface GroupPromptResult {
  /** The system prompt to send to GPT */
  systemPrompt: string;
  /** Optional: group-specific post-processing compliance gate.
   *  Called AFTER GPT responds, BEFORE the generic enforceT1Syntax.
   *  Returning null means "use only the existing compliance gates". */
  groupCompliance?: (optimised: string) => ComplianceResult;
  /** Optional: builder-specific temperature override.
   *  If set, the route uses this instead of the default prose/CLIP temperature.
   *  Allows individual platforms to tune creativity vs precision. */
  temperature?: number;
}

/**
 * Signature for a group builder function.
 * Every group builder has the same shape — takes provider context,
 * returns a system prompt + optional compliance gate.
 */
export type GroupBuilder = (
  providerId: string,
  ctx: OptimiseProviderContext,
) => GroupPromptResult;
