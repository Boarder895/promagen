// src/lib/call-3-transforms/param-validate.ts
// ============================================================================
// T_PARAM_VALIDATE — Midjourney parameter validation
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9.2
//
// Validates and normalises Midjourney --param flags:
//   --ar (aspect ratio), --v (version), --s / --stylize,
//   --no (negative terms), --style, --chaos, --q (quality)
//
// Wraps midjourney-deterministic.ts parseMjPrompt() + validateMjStructure()
// into the transform catalogue interface.
//
// Only active on Midjourney. Pure function. No GPT cost.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { TransformOutput } from './transform-types';
import { parseMjPrompt, validateMjStructure, normaliseMjPrompt } from '@/lib/optimise-prompts/midjourney-deterministic';

/**
 * T_PARAM_VALIDATE — Validate and normalise Midjourney parameters.
 *
 * Algorithm:
 *   1. Parse the prompt into MJ structure (clauses + params)
 *   2. Validate parameter values (--ar range, --v version, etc.)
 *   3. Deduplicate parameters (keep last occurrence)
 *   4. Normalise parameter formatting
 *
 * Returns unchanged text if:
 * - Prompt has no MJ parameters
 * - All parameters are already valid and normalised
 */
export function paramValidate(
  text: string,
  _anchors: AnchorManifest,
  _dna: PlatformDNA,
): TransformOutput {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { text: trimmed, changes: [] };
  }

  // Guard: must contain MJ-style params
  if (!trimmed.includes('--')) {
    return { text: trimmed, changes: [] };
  }

  const parsed = parseMjPrompt(trimmed);
  if (!parsed.isValid) {
    return { text: trimmed, changes: [] };
  }

  const validation = validateMjStructure(parsed);
  const normalised = normaliseMjPrompt(parsed);

  const changes: string[] = [];

  // Collect validation warnings
  if (validation.warnings.length > 0) {
    for (const warning of validation.warnings) {
      changes.push(`Param validate: ${warning}`);
    }
  }

  // Collect normalisation changes
  if (normalised.changes.length > 0) {
    for (const change of normalised.changes) {
      changes.push(`Param validate: ${change}`);
    }
  }

  if (changes.length === 0) {
    return { text: trimmed, changes: [] };
  }

  return {
    text: normalised.text,
    changes,
  };
}
