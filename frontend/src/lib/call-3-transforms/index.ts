// src/lib/call-3-transforms/index.ts
// ============================================================================
// DETERMINISTIC TRANSFORM CATALOGUE — Phase 5 coordinator
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9
//
// The central coordinator that runs platform-specific deterministic
// transforms in the order declared by the DNA profile. Each platform's
// allowedTransforms list is the authority — transforms not on the list
// are banned for that platform.
//
// GPT transforms (T_PROSE_RESTRUCTURE, T_NARRATIVE_ARMOUR, T_NEGATIVE_GENERATE)
// are skipped by this coordinator — they are handled by the GPT path in
// the route. The coordinator only runs deterministic (code-only) transforms.
//
// Design: each transform is a pure function with the same signature:
//   (text: string, anchors: AnchorManifest, dna: PlatformDNA) => TransformOutput
//
// The coordinator calls them in declared order, threading the text through
// each transform and accumulating changes. If a transform returns unchanged
// text, it was a no-op (the transform decided nothing needed doing).
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA, TransformId } from '@/data/platform-dna/types';
import type { TransformOutput } from './transform-types';

// Re-export so consumers can import from index
export type { TransformOutput } from './transform-types';

// ── Transform imports ────────────────────────────────────────────────────────
import { subjectFront } from './subject-front';
import { qualityPosition } from './quality-position';
import { sequenceByAVIS, configFromDNA } from './attention-sequence';
import { weightRebalance } from './weight-rebalance';
import { tokenMerge } from './token-merge';
import { semanticCompress } from './semantic-compress';
import { redundancyStrip } from './redundancy-strip';
import { scenePremise } from './scene-premise';
import { charEnforce } from './char-enforce';
import { paramValidate } from './param-validate';
import { weightValidate } from './weight-validate';
import { clauseFront } from './clause-front';

// ============================================================================
// TYPES
// ============================================================================

// TransformOutput is defined in ./transform-types.ts and re-exported above.

/**
 * The result of running the full deterministic transform pipeline.
 * Extends TransformOutput with pipeline metadata.
 *
 * ChatGPT 91/100 review: "make no-op vs applied reporting stricter"
 * — transformsExecuted: all transforms that ran (including no-ops)
 * — transformsModified: only transforms that actually changed the text
 * — transformsSkipped: GPT-only, unregistered, or errored transforms
 */
export interface TransformPipelineResult {
  /** The final transformed text */
  readonly text: string;
  /** All change descriptions from all transforms */
  readonly changes: readonly string[];
  /** All transforms that ran successfully (including no-ops) */
  readonly transformsExecuted: readonly TransformId[];
  /** Only transforms that actually modified the text */
  readonly transformsModified: readonly TransformId[];
  /** Which transforms were skipped (GPT-only, unregistered, or errored) */
  readonly transformsSkipped: readonly TransformId[];
  /** Whether any transform modified the text */
  readonly wasModified: boolean;
  /**
   * @deprecated Use transformsExecuted. Kept for backward compatibility.
   * Alias for transformsExecuted.
   */
  readonly transformsApplied: readonly TransformId[];
}

// ============================================================================
// GPT TRANSFORMS — Skipped by deterministic coordinator
// ============================================================================

/**
 * Transforms that require GPT. These are NOT run by this coordinator.
 * The route handles them via the GPT path.
 */
const GPT_TRANSFORMS: ReadonlySet<TransformId> = new Set([
  'T_PROSE_RESTRUCTURE',
  'T_NARRATIVE_ARMOUR',
  'T_NEGATIVE_GENERATE',
]);

// ============================================================================
// TRANSFORM REGISTRY
// ============================================================================

/**
 * Type for a deterministic transform function.
 * Every transform takes the same three arguments and returns TransformOutput.
 */
type TransformFn = (
  text: string,
  anchors: AnchorManifest,
  dna: PlatformDNA,
) => TransformOutput;

/**
 * Registry mapping TransformId to its implementation.
 * Only deterministic transforms are registered here.
 */
const TRANSFORM_REGISTRY: ReadonlyMap<TransformId, TransformFn> = new Map<TransformId, TransformFn>([
  ['T_SUBJECT_FRONT', subjectFront],
  ['T_QUALITY_POSITION', qualityPosition],
  ['T_ATTENTION_SEQUENCE', wrapAttentionSequence],
  ['T_WEIGHT_REBALANCE', weightRebalance],
  ['T_TOKEN_MERGE', tokenMerge],
  ['T_SEMANTIC_COMPRESS', wrapSemanticCompress],
  ['T_REDUNDANCY_STRIP', redundancyStrip],
  ['T_SCENE_PREMISE', scenePremise],
  ['T_CHAR_ENFORCE', charEnforce],
  ['T_PARAM_VALIDATE', paramValidate],
  ['T_WEIGHT_VALIDATE', weightValidate],
  ['T_CLAUSE_FRONT', clauseFront],
  // T_SYNTAX_CLEANUP not in any DNA profile — reserved for future use
]);

// ============================================================================
// TRANSFORM WRAPPERS
// ============================================================================
// Some transforms have different signatures than the standard
// (text, anchors, dna) → TransformOutput shape. These wrappers adapt them.

/**
 * Wrap sequenceByAVIS into the standard transform interface.
 * Converts AVISConfig from DNA and maps SequencedResult → TransformOutput.
 */
function wrapAttentionSequence(
  text: string,
  anchors: AnchorManifest,
  dna: PlatformDNA,
): TransformOutput {
  const config = configFromDNA(dna);
  const result = sequenceByAVIS(text, anchors, config, dna);
  return {
    text: result.text,
    changes: result.changes,
  };
}

/**
 * Wrap semanticCompress into the standard transform interface.
 * Passes the encoder token limit from DNA.
 */
function wrapSemanticCompress(
  text: string,
  anchors: AnchorManifest,
  dna: PlatformDNA,
): TransformOutput {
  const tokenLimit = dna.tokenLimit ?? 512;
  const result = semanticCompress(text, anchors, tokenLimit);
  return {
    text: result.text,
    changes: [...result.changes],
  };
}

// ============================================================================
// COORDINATOR
// ============================================================================

/**
 * Run the deterministic transform pipeline for a platform.
 *
 * Reads dna.allowedTransforms and executes each deterministic transform
 * in the declared order. GPT transforms are skipped. Unregistered
 * transforms are logged and skipped.
 *
 * The text is threaded through each transform sequentially:
 *   input → T1(input) → T2(T1_output) → T3(T2_output) → ... → final
 *
 * @param text      The assembled prompt text (from Call 2)
 * @param dna       The platform's DNA profile
 * @param anchors   Anchor manifest extracted from the prompt
 * @returns         Pipeline result with transformed text and metadata
 */
export function runDeterministicTransforms(
  text: string,
  dna: PlatformDNA,
  anchors: AnchorManifest,
): TransformPipelineResult {
  const allChanges: string[] = [];
  const executed: TransformId[] = [];
  const modified: TransformId[] = [];
  const skipped: TransformId[] = [];
  let currentText = text.trim();
  const originalText = currentText;

  for (const transformId of dna.allowedTransforms) {
    // ── Skip GPT transforms ──────────────────────────────────────────
    if (GPT_TRANSFORMS.has(transformId)) {
      skipped.push(transformId);
      continue;
    }

    // ── Look up transform implementation ─────────────────────────────
    const fn = TRANSFORM_REGISTRY.get(transformId);

    if (!fn) {
      // Transform declared in DNA but no implementation registered.
      // This is not an error — it means the transform hasn't been built yet.
      // Log and skip rather than crash.
      console.debug(
        `[call-3-transforms] Transform ${transformId} declared for ${dna.id} but not registered — skipping`,
      );
      skipped.push(transformId);
      continue;
    }

    // ── Execute transform ────────────────────────────────────────────
    try {
      const textBefore = currentText;
      const result = fn(currentText, anchors, dna);
      executed.push(transformId);

      if (result.changes.length > 0) {
        allChanges.push(...result.changes);
        currentText = result.text;
      }

      // Track whether text actually changed (not just diagnostics)
      if (result.text !== textBefore) {
        modified.push(transformId);
      }
    } catch (err) {
      // Transform threw — log error, skip, continue pipeline.
      // A single broken transform must not crash the whole pipeline.
      console.error(
        `[call-3-transforms] Transform ${transformId} threw for ${dna.id}:`,
        err,
      );
      skipped.push(transformId);
    }
  }

  return {
    text: currentText,
    changes: allChanges,
    transformsExecuted: executed,
    transformsModified: modified,
    transformsSkipped: skipped,
    wasModified: currentText !== originalText,
    // Backward compat
    transformsApplied: executed,
  };
}

// ============================================================================
// EXPORTS FOR CROSS-TRANSFORM USE
// ============================================================================

// Re-export classifyVisualCategory so weight-rebalance etc. can use it
// without importing attention-sequence directly
export { classifyVisualCategory } from './attention-sequence';
export type { VisualCategory } from './attention-sequence';
