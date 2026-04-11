// src/lib/call-3-transforms/char-enforce.ts
// ============================================================================
// T_CHAR_ENFORCE — Character ceiling enforcement
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9.2
//
// Enforces the platform's hard character ceiling from the DNA profile.
// This is the LAST deterministic transform in the pipeline — it
// guarantees the output fits the platform regardless of what upstream
// transforms did.
//
// Truncation strategy (conservative, preserving visual anchors):
//   1. If under ceiling → pass through unchanged
//   2. If over → trim from the END of the prompt
//   3. Trim at the nearest segment boundary (comma, period, semicolon)
//      rather than mid-word
//   4. Never trim below 50% of the ceiling (safety floor)
//
// Active on ALL 40 platforms. Pure function. No GPT cost.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { TransformOutput } from './transform-types';

// ============================================================================
// TRANSFORM
// ============================================================================

/**
 * T_CHAR_ENFORCE — Enforce hard character ceiling.
 *
 * The ceiling comes from dna.charCeiling (sourced from platform-config.json
 * maxChars). If the prompt exceeds this limit, it is trimmed from the end
 * at the nearest clean boundary.
 *
 * Returns unchanged text if already within ceiling.
 */
export function charEnforce(
  text: string,
  _anchors: AnchorManifest,
  dna: PlatformDNA,
): TransformOutput {
  const trimmed = text.trim();

  if (trimmed.length <= dna.charCeiling) {
    return { text: trimmed, changes: [] };
  }

  // ── Find the nearest clean boundary before the ceiling ─────────────
  const ceiling = dna.charCeiling;
  const safetyFloor = Math.floor(ceiling * 0.5);

  // Look for the last segment boundary (comma, period, semicolon) before ceiling
  let cutPoint = ceiling;

  // Search backwards from ceiling for a clean break
  const searchRegion = trimmed.slice(0, ceiling);

  // Try comma first (most common in CLIP prompts)
  const lastComma = searchRegion.lastIndexOf(',');
  if (lastComma > safetyFloor) {
    cutPoint = lastComma;
  } else {
    // Try period
    const lastPeriod = searchRegion.lastIndexOf('.');
    if (lastPeriod > safetyFloor) {
      cutPoint = lastPeriod;
    } else {
      // Try semicolon
      const lastSemicolon = searchRegion.lastIndexOf(';');
      if (lastSemicolon > safetyFloor) {
        cutPoint = lastSemicolon;
      } else {
        // Try space (word boundary)
        const lastSpace = searchRegion.lastIndexOf(' ');
        if (lastSpace > safetyFloor) {
          cutPoint = lastSpace;
        }
        // If nothing found above safety floor, hard-cut at ceiling
      }
    }
  }

  const truncated = trimmed.slice(0, cutPoint).replace(/[,;:\s]+$/, '').trim();
  const charsRemoved = trimmed.length - truncated.length;

  return {
    text: truncated,
    changes: [
      `Character enforce: trimmed ${charsRemoved} chars to fit ${ceiling}-char ceiling (cut at nearest boundary)`,
    ],
  };
}
