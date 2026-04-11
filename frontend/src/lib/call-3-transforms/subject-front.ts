// src/lib/call-3-transforms/subject-front.ts
// ============================================================================
// T_SUBJECT_FRONT — Deterministic subject front-loading
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9.2
//
// Wraps preflight.ts reorderSubjectFirst() into the transform catalogue
// interface. Moves the primary subject phrase to token position 0–15.
//
// High value on CLIP (front-loaded attention), moderate on T5/prose.
// Pure function. No GPT cost. All original words preserved.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import { reorderSubjectFirst } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { TransformOutput } from './transform-types';

/**
 * T_SUBJECT_FRONT — Move the primary subject to the front of the prompt.
 *
 * Delegates to preflight.ts reorderSubjectFirst() which handles:
 * - Pattern A only (opener clause swap, no internal restructuring)
 * - Article-led subjects (a/an/the/one)
 * - Syntax-sensitive prompt rejection (weights, MJ params)
 * - Multi-subject ambiguity rejection
 * - Smart clause-break insertion (participial, possessive, prepositional)
 *
 * Returns unchanged text if:
 * - Subject is already front-loaded
 * - Reorder confidence is too low
 * - Prompt contains weight syntax
 *
 * @param text     The prompt text
 * @param _anchors Anchor manifest (used by reorderSubjectFirst indirectly)
 * @param _dna     Platform DNA profile (checked by coordinator, not used here)
 */
export function subjectFront(
  text: string,
  _anchors: AnchorManifest,
  _dna: PlatformDNA,
): TransformOutput {
  const result = reorderSubjectFirst(text);

  if (!result) {
    return {
      text,
      changes: [],
    };
  }

  return {
    text: result.reordered,
    changes: result.changes,
  };
}
