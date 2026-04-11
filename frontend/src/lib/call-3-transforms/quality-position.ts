// src/lib/call-3-transforms/quality-position.ts
// ============================================================================
// T_QUALITY_POSITION — Quality prefix/suffix positional placement
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9.2
//
// Moves quality prefix terms (masterpiece, best quality, etc.) to token
// position 0 and quality suffix terms (8K, ultra detailed, etc.) to the
// end of the prompt. CLIP's front-loaded attention makes position 0 the
// highest-impact slot. Quality tags occupy it because they act as
// training data signals, not visual anchors — the subject then gets
// position 1 (the first visual slot).
//
// Only active on platforms where processingProfile.qualityTagsEffective
// is true (CLIP, Kling). T5 platforms ignore quality tags entirely.
//
// Pure function. No content invented. Only ORDER changes.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { TransformOutput } from './transform-types';

// ============================================================================
// QUALITY TAG PATTERNS
// ============================================================================

/**
 * Quality prefix terms — belong at position 0 (CLIP training signals).
 * Matched case-insensitively. Order: highest impact first.
 */
const QUALITY_PREFIXES: readonly string[] = [
  'masterpiece',
  'best quality',
  'highest quality',
  'ultra quality',
  'professional',
  'award-winning',
  'award winning',
  'studio quality',
  'cinematic quality',
];

/**
 * Quality suffix terms — belong at the end (resolution/detail signals).
 * These have less positional sensitivity than prefixes.
 */
const QUALITY_SUFFIXES: readonly string[] = [
  '8k',
  '4k',
  'ultra detailed',
  'ultra-detailed',
  'highly detailed',
  'extremely detailed',
  'sharp focus',
  'intricate detail',
  'intricate details',
  'fine detail',
  'fine details',
  'hdr',
  'uhd',
];

/**
 * T_QUALITY_POSITION — Move quality prefixes to position 0, suffixes to end.
 *
 * Algorithm:
 *   1. Skip if platform's qualityTagsEffective is false
 *   2. Split prompt into comma-separated segments
 *   3. Identify prefix segments and suffix segments
 *   4. Remove them from their current positions
 *   5. Prepend prefixes, append suffixes
 *   6. Reassemble
 *
 * Returns unchanged text if:
 * - Quality tags are not effective for this platform
 * - No quality tags found
 * - Tags are already correctly positioned
 */
export function qualityPosition(
  text: string,
  _anchors: AnchorManifest,
  dna: PlatformDNA,
): TransformOutput {
  // Guard: only active when quality tags have measurable impact
  if (!dna.processingProfile.qualityTagsEffective) {
    return { text, changes: [] };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { text: trimmed, changes: [] };
  }

  // ── Split into segments ────────────────────────────────────────────
  const segments = trimmed.split(',').map((s) => s.trim()).filter((s) => s.length > 0);

  if (segments.length <= 1) {
    return { text: trimmed, changes: [] };
  }

  // ── Classify segments ──────────────────────────────────────────────
  const prefixSegments: string[] = [];
  const suffixSegments: string[] = [];
  const coreSegments: string[] = [];

  const prefixSet = new Set(QUALITY_PREFIXES.map((p) => p.toLowerCase()));
  const suffixSet = new Set(QUALITY_SUFFIXES.map((s) => s.toLowerCase()));

  for (const seg of segments) {
    const lower = seg.toLowerCase();
    if (prefixSet.has(lower)) {
      prefixSegments.push(seg);
    } else if (suffixSet.has(lower)) {
      suffixSegments.push(seg);
    } else {
      coreSegments.push(seg);
    }
  }

  // Guard: nothing to move
  if (prefixSegments.length === 0 && suffixSegments.length === 0) {
    return { text: trimmed, changes: [] };
  }

  // ── Check if already correctly positioned ──────────────────────────
  const idealOrder = [...prefixSegments, ...coreSegments, ...suffixSegments];
  const currentOrder = segments;

  if (idealOrder.length === currentOrder.length &&
      idealOrder.every((seg, i) => seg === currentOrder[i])) {
    return { text: trimmed, changes: [] };
  }

  // ── Reassemble in optimal order ────────────────────────────────────
  const reordered = idealOrder.join(', ');

  const changes: string[] = [];
  if (prefixSegments.length > 0) {
    changes.push(
      `Quality position: moved ${prefixSegments.map((p) => `"${p}"`).join(', ')} to position 0`,
    );
  }
  if (suffixSegments.length > 0) {
    changes.push(
      `Quality position: moved ${suffixSegments.map((s) => `"${s}"`).join(', ')} to end`,
    );
  }

  return {
    text: reordered,
    changes,
  };
}
