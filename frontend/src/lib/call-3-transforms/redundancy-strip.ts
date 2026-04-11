// src/lib/call-3-transforms/redundancy-strip.ts
// ============================================================================
// T_REDUNDANCY_STRIP — Strip redundant and duplicate terms
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9.2
//
// Detects and removes within-prompt redundancy:
//   1. Exact duplicate segments (case-insensitive)
//   2. Near-duplicate segments (one is a substring of another)
//   3. Repeated modifiers across segments (same adjective used 3+ times)
//
// Active on ALL 40 platforms — redundancy wastes tokens everywhere.
//
// Conservative: keeps the FIRST occurrence and removes later duplicates.
// Never removes a segment that contains the subject phrase.
//
// Pure function. No GPT cost. Content only removed, never added.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { TransformOutput } from './transform-types';

// ============================================================================
// REDUNDANCY DETECTION
// ============================================================================

/**
 * Normalise a segment for comparison: lowercase, collapse whitespace,
 * strip trailing punctuation.
 */
function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?]+$/, '').trim();
}

/**
 * Check if segment A is a meaningful substring of segment B.
 * "dramatic lighting" is a substring of "dramatic cinematic lighting"
 * but "a" is not a meaningful substring of anything.
 */
function isNearDuplicate(shorter: string, longer: string): boolean {
  // Minimum 3 words to count as near-duplicate
  const shortWords = shorter.split(/\s+/);
  if (shortWords.length < 2) return false;

  return longer.includes(shorter);
}

/**
 * Detect modifiers that appear in 3+ segments.
 * Returns a map of modifier → count.
 */
function findOverusedModifiers(segments: string[]): Map<string, number> {
  const modifierCounts = new Map<string, number>();

  // Common visual modifiers worth tracking
  const TRACKED_MODIFIERS = new Set([
    'dramatic', 'cinematic', 'ethereal', 'moody', 'atmospheric',
    'volumetric', 'soft', 'harsh', 'warm', 'cool', 'bright', 'vivid',
    'muted', 'rich', 'deep', 'pale', 'dark', 'dense', 'subtle', 'bold',
    'gentle', 'detailed', 'intricate', 'delicate', 'elegant', 'ornate',
    'weathered', 'ancient', 'beautiful', 'stunning', 'majestic',
    'mysterious', 'enchanting', 'serene', 'tranquil', 'epic',
  ]);

  for (const seg of segments) {
    const words = seg.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (TRACKED_MODIFIERS.has(word)) {
        modifierCounts.set(word, (modifierCounts.get(word) ?? 0) + 1);
      }
    }
  }

  // Only flag modifiers used 3+ times
  const overused = new Map<string, number>();
  for (const [mod, count] of modifierCounts) {
    if (count >= 3) {
      overused.set(mod, count);
    }
  }

  return overused;
}

// ============================================================================
// TRANSFORM
// ============================================================================

/**
 * T_REDUNDANCY_STRIP — Remove duplicate and redundant segments.
 *
 * Algorithm:
 *   1. Split into segments
 *   2. Mark exact duplicates for removal (keep first)
 *   3. Mark near-duplicates for removal (keep longer version)
 *   4. Protect subject-containing segments from removal
 *   5. Strip overused modifiers from later occurrences (3rd+ only)
 *   6. Reassemble
 *
 * Returns unchanged text if:
 * - No redundancy detected
 * - Prompt has fewer than 3 segments
 */
export function redundancyStrip(
  text: string,
  anchors: AnchorManifest,
  _dna: PlatformDNA,
): TransformOutput {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { text: trimmed, changes: [] };
  }

  // Use comma for CLIP-style, but also handle semicolons/periods for prose
  const delimiter = trimmed.includes(',') ? ',' : /[.;]/;
  const segments = trimmed.split(delimiter).map((s) => s.trim()).filter((s) => s.length > 0);

  if (segments.length < 3) {
    return { text: trimmed, changes: [] };
  }

  const changes: string[] = [];
  const subjectLower = anchors.subjectPhrase?.toLowerCase() ?? '';

  // ── Pass 1: Exact duplicate removal ────────────────────────────────
  const seen = new Set<string>();
  const afterDedup: string[] = [];

  for (const seg of segments) {
    const norm = normalise(seg);

    // Protect subject segments from removal
    if (subjectLower && norm.includes(subjectLower)) {
      afterDedup.push(seg);
      seen.add(norm);
      continue;
    }

    if (seen.has(norm)) {
      changes.push(`Redundancy strip: removed duplicate "${seg}"`);
      continue;
    }

    seen.add(norm);
    afterDedup.push(seg);
  }

  // ── Pass 2: Near-duplicate removal ─────────────────────────────────
  const afterNearDedup: string[] = [];
  const removedIndices = new Set<number>();

  for (let i = 0; i < afterDedup.length; i++) {
    if (removedIndices.has(i)) continue;

    const normI = normalise(afterDedup[i]!);

    for (let j = i + 1; j < afterDedup.length; j++) {
      if (removedIndices.has(j)) continue;

      const normJ = normalise(afterDedup[j]!);

      // Check if one is a near-duplicate of the other
      if (isNearDuplicate(normI, normJ)) {
        // Keep the longer one (j), remove the shorter one (i)
        removedIndices.add(i);
        changes.push(`Redundancy strip: removed near-duplicate "${afterDedup[i]}" (subsumed by "${afterDedup[j]}")`);
        break;
      } else if (isNearDuplicate(normJ, normI)) {
        // Keep the longer one (i), remove the shorter one (j)
        // But protect subject
        if (subjectLower && normJ.includes(subjectLower)) continue;
        removedIndices.add(j);
        changes.push(`Redundancy strip: removed near-duplicate "${afterDedup[j]}" (subsumed by "${afterDedup[i]}")`);
      }
    }
  }

  for (let i = 0; i < afterDedup.length; i++) {
    if (!removedIndices.has(i)) {
      afterNearDedup.push(afterDedup[i]!);
    }
  }

  // ── Pass 3: Overused modifier thinning ─────────────────────────────
  const overused = findOverusedModifiers(afterNearDedup);
  const finalSegments: string[] = [];

  if (overused.size > 0) {
    const modifierOccurrences = new Map<string, number>();

    for (const seg of afterNearDedup) {
      let modified = seg;
      const words = seg.toLowerCase().split(/\s+/);

      for (const word of words) {
        if (overused.has(word)) {
          const count = (modifierOccurrences.get(word) ?? 0) + 1;
          modifierOccurrences.set(word, count);

          // Remove the modifier on 3rd+ occurrence (keep first two)
          if (count >= 3) {
            // Protect subject segments
            if (subjectLower && normalise(seg).includes(subjectLower)) continue;

            const wordRe = new RegExp(`\\b${word}\\b\\s*`, 'gi');
            const stripped = modified.replace(wordRe, '').trim();

            if (stripped.length > 0 && stripped !== modified) {
              changes.push(`Redundancy strip: thinned overused "${word}" (occurrence ${count})`);
              modified = stripped;
            }
          }
        }
      }

      // Only add segment if it still has content after thinning
      if (modified.trim().length > 0) {
        finalSegments.push(modified.trim());
      }
    }
  } else {
    finalSegments.push(...afterNearDedup);
  }

  if (changes.length === 0) {
    return { text: trimmed, changes: [] };
  }

  const joiner = trimmed.includes(',') ? ', ' : '. ';
  return {
    text: finalSegments.join(joiner),
    changes,
  };
}
