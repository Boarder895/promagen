// src/lib/call-3-transforms/token-merge.ts
// ============================================================================
// T_TOKEN_MERGE — Fragment merging for CLIP token efficiency
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §4.2
// Build plan:   call-3-quality-build-plan-v1.md §9.2
//
// Merges fragmented comma-separated terms that describe the same visual
// concept. CLIP tokenises "purple, sky, copper" as 5+ tokens across
// three segments; "purple-copper sky" is 3 tokens in one segment with
// stronger conditioning.
//
// Rules (conservative):
//   - Only merge adjacent segments
//   - Only merge colour+noun, modifier+noun, or colour+colour pairs
//   - Never merge across visual categories (lighting + environment = no)
//   - Never invent words — only hyphenate or concatenate existing terms
//   - Maximum 2 segments merged at once (no triple merges)
//
// Pure function. No GPT cost. No content invented.
// ============================================================================

import type { AnchorManifest } from '@/lib/optimise-prompts/preflight';
import type { PlatformDNA } from '@/data/platform-dna/types';
import type { TransformOutput } from './transform-types';
import { estimateTokens } from './attention-sequence';

// ============================================================================
// MERGE PATTERN DETECTION
// ============================================================================

/**
 * Terms recognised as colour words for merge candidacy.
 */
const COLOUR_WORDS = new Set([
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'violet',
  'pink', 'cyan', 'magenta', 'crimson', 'scarlet', 'gold', 'golden',
  'silver', 'copper', 'bronze', 'amber', 'teal', 'turquoise',
  'emerald', 'cobalt', 'indigo', 'maroon', 'ivory', 'charcoal',
  'slate', 'white', 'black', 'grey', 'gray', 'brown', 'cream',
  'rust', 'coral', 'lavender', 'burgundy', 'aqua', 'navy',
]);

/**
 * Terms recognised as simple visual nouns that can accept colour modifiers.
 */
const VISUAL_NOUNS = new Set([
  'sky', 'light', 'glow', 'haze', 'mist', 'fog', 'smoke', 'fire',
  'flame', 'water', 'ocean', 'sea', 'clouds', 'shadow', 'shadows',
  'sunset', 'sunrise', 'dusk', 'dawn', 'twilight', 'rain', 'snow',
  'dust', 'sand', 'stone', 'metal', 'glass', 'silk', 'velvet',
  'leather', 'wood', 'marble', 'concrete', 'steel', 'iron',
  'tones', 'hues', 'palette', 'accents', 'highlights',
]);

/**
 * Modifiers that can be merged with adjacent nouns.
 */
const MODIFIER_WORDS = new Set([
  'dramatic', 'cinematic', 'ethereal', 'moody', 'atmospheric',
  'volumetric', 'soft', 'harsh', 'warm', 'cool', 'bright', 'dim',
  'faint', 'vivid', 'muted', 'rich', 'deep', 'pale', 'dark',
  'dense', 'thin', 'thick', 'subtle', 'bold', 'gentle', 'fierce',
  'ancient', 'weathered', 'rusted', 'polished', 'cracked',
  'shattered', 'towering', 'sprawling',
]);

type SegmentType = 'colour' | 'noun' | 'modifier' | 'other';

/**
 * Classify a single-word or short-phrase segment for merge candidacy.
 */
function classifyForMerge(segment: string): SegmentType {
  const lower = segment.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // Single colour word
  if (words.length === 1 && COLOUR_WORDS.has(words[0]!)) return 'colour';

  // Single visual noun
  if (words.length === 1 && VISUAL_NOUNS.has(words[0]!)) return 'noun';

  // Single modifier
  if (words.length === 1 && MODIFIER_WORDS.has(words[0]!)) return 'modifier';

  // "deep blue" or "vivid crimson" — modifier + colour
  if (words.length === 2) {
    if (MODIFIER_WORDS.has(words[0]!) && COLOUR_WORDS.has(words[1]!)) return 'colour';
    if (COLOUR_WORDS.has(words[0]!) && VISUAL_NOUNS.has(words[1]!)) return 'noun';
  }

  return 'other';
}

/**
 * Check whether two adjacent segments can be merged.
 * Returns the merged form, or null if merge is not safe.
 */
function tryMerge(a: string, b: string): string | null {
  const typeA = classifyForMerge(a);
  const typeB = classifyForMerge(b);

  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  // colour + colour → "colour-colour" (hyphenated compound)
  if (typeA === 'colour' && typeB === 'colour') {
    return `${aLower}-${bLower}`;
  }

  // colour + noun → "colour noun" (natural phrasing)
  if (typeA === 'colour' && typeB === 'noun') {
    return `${aLower} ${bLower}`;
  }

  // modifier + noun → "modifier noun"
  if (typeA === 'modifier' && typeB === 'noun') {
    return `${aLower} ${bLower}`;
  }

  // modifier + colour → "modifier-colour" (hyphenated)
  if (typeA === 'modifier' && typeB === 'colour') {
    return `${aLower}-${bLower}`;
  }

  return null;
}

// ============================================================================
// TRANSFORM
// ============================================================================

/**
 * T_TOKEN_MERGE — Merge fragmented adjacent segments to save CLIP tokens.
 *
 * Algorithm:
 *   1. Split prompt into comma-separated segments
 *   2. Walk adjacent pairs, try merge
 *   3. If merge saves tokens and is semantically safe, apply it
 *   4. Skip the merged segment (no triple merges)
 *   5. Reassemble
 *
 * Returns unchanged text if:
 * - No mergeable adjacent pairs found
 * - Prompt has 2 or fewer segments
 */
export function tokenMerge(
  text: string,
  _anchors: AnchorManifest,
  _dna: PlatformDNA,
): TransformOutput {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { text: trimmed, changes: [] };
  }

  const segments = trimmed.split(',').map((s) => s.trim()).filter((s) => s.length > 0);

  if (segments.length <= 2) {
    return { text: trimmed, changes: [] };
  }

  // ── Walk adjacent pairs ────────────────────────────────────────────
  const merged: string[] = [];
  const changes: string[] = [];
  let i = 0;

  while (i < segments.length) {
    if (i < segments.length - 1) {
      const mergeResult = tryMerge(segments[i]!, segments[i + 1]!);

      if (mergeResult !== null) {
        const tokensBefore = estimateTokens(segments[i]!) + estimateTokens(segments[i + 1]!);
        const tokensAfter = estimateTokens(mergeResult);

        // Only merge if it actually saves tokens
        if (tokensAfter < tokensBefore) {
          merged.push(mergeResult);
          changes.push(
            `Token merge: "${segments[i]}, ${segments[i + 1]}" → "${mergeResult}" (saved ~${tokensBefore - tokensAfter} token${tokensBefore - tokensAfter !== 1 ? 's' : ''})`,
          );
          i += 2; // Skip the merged pair
          continue;
        }
      }
    }

    merged.push(segments[i]!);
    i++;
  }

  if (changes.length === 0) {
    return { text: trimmed, changes: [] };
  }

  return {
    text: merged.join(', '),
    changes,
  };
}
