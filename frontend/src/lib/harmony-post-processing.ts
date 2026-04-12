// src/lib/harmony-post-processing.ts
// ============================================================================
// HARMONY POST-PROCESSING PIPELINE — Deterministic prompt fixes
// ============================================================================
// Pure functions that fix GPT mechanical errors AFTER generation.
// Extracted from generate-tier-prompts/route.ts for testability.
//
// Design principle: Every fix that can be expressed as code MUST be code,
// not another system prompt rule. Code catches it 100% of the time.
//
// Pipeline per tier:
//   T1: P13 (weight cap 8) → P2 (strip punctuation) → P14 (weight wrap ≤4 words)
//   T2: P1 (dedup MJ params)
//   T3: P15 (over-length truncation 280–420)
//   T4: P3 (self-correction) → P8 (meta-openers) → P10 (short sentence merge) → P16 (over-length truncation ≤325)
//
// v4.5.1 additions (10 Apr 2026):
//   P14 — T1 weight-wrap enforcement (4-word limit, 2-word-tail heuristic)
//   P15 — T3 over-length truncation (280–420 char range)
//   P16 — T4 over-length truncation (≤325 chars)
//
// Removed (prompt now handles these — tested and confirmed no regression):
//   P11 (T3 meta-commentary opener fixer) — removed 28 Mar 2026
//   P12 (T1 CLIP qualitative adjective stripper) — removed 28 Mar 2026
//
// Authority: harmonizing-claude-openai.md §6, §10
//            call-2-quality-architecture-v0_3_1_1.md §3 (Stage B)
// Test file: src/lib/__tests__/call-2-post-processing-fixes.test.ts
// ============================================================================

import { enforceWeightCap } from '@/lib/harmony-compliance';

// ============================================================================
// P1+P7: T2 Midjourney Parameter Deduplication
// ============================================================================

/**
 * P1+P7: Deduplicate T2 Midjourney parameter block.
 *
 * Handles TWO duplication patterns:
 * 1. Entire parameter block duplicated: ...prose --ar 16:9 --v 7 --no X --ar 16:9 --v 7 --no Y
 * 2. Single --no block with internally duplicated terms: --no X, Y, X, Y
 *
 * Also detects fusion artifacts where GPT omits separator between duplicate blocks.
 */
export function deduplicateMjParams(prompt: string): string {
  const paramStart = prompt.search(/\s--(?:ar|v|s|no)\s/);
  if (paramStart === -1) return prompt;

  const prose = prompt.slice(0, paramStart).trimEnd();
  const paramSection = prompt.slice(paramStart);

  // Extract all --ar values (keep last)
  let ar = '';
  const arMatches = [...paramSection.matchAll(/--ar\s+(\d+:\d+)/g)];
  if (arMatches.length > 0) ar = arMatches[arMatches.length - 1]?.[1] ?? '';

  // Extract all --v values (keep last)
  let v = '';
  const vMatches = [...paramSection.matchAll(/--v\s+(\d+)/g)];
  if (vMatches.length > 0) v = vMatches[vMatches.length - 1]?.[1] ?? '';

  // Extract all --s values (keep last)
  let s = '';
  const sMatches = [...paramSection.matchAll(/--s\s+(\d+)/g)];
  if (sMatches.length > 0) s = sMatches[sMatches.length - 1]?.[1] ?? '';

  // Extract ALL --no terms across all --no blocks, deduplicate
  const noBlocks = [...paramSection.matchAll(/--no\s+([^-]+?)(?=\s+--|$)/g)];
  const allNoTerms: string[] = [];
  const seen = new Set<string>();
  for (const block of noBlocks) {
    const terms = (block[1] ?? '').split(',').map(t => t.trim()).filter(Boolean);
    for (const term of terms) {
      const lower = term.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        allNoTerms.push(term);
      }
    }
  }

  // Detect and remove run-on fusion artifacts
  const termSetLower = new Set(allNoTerms.map(t => t.toLowerCase()));
  const fusionIndices: number[] = [];
  for (let i = 0; i < allNoTerms.length; i++) {
    const words = allNoTerms[i]!.toLowerCase().split(/\s+/);
    if (words.length <= 2) continue;
    for (let splitAt = 1; splitAt < words.length; splitAt++) {
      const firstPart = words.slice(0, splitAt).join(' ');
      const secondPart = words.slice(splitAt).join(' ');
      if (termSetLower.has(firstPart) && termSetLower.has(secondPart)) {
        fusionIndices.push(i);
        break;
      }
    }
  }
  for (let i = fusionIndices.length - 1; i >= 0; i--) {
    allNoTerms.splice(fusionIndices[i]!, 1);
  }

  // Strip trailing punctuation from last negative term
  if (allNoTerms.length > 0) {
    const last = allNoTerms[allNoTerms.length - 1];
    if (last) {
      allNoTerms[allNoTerms.length - 1] = last.replace(/[.!?]+$/, '').trim();
    }
  }

  const parts = [prose];
  if (ar) parts.push(`--ar ${ar}`);
  if (v) parts.push(`--v ${v}`);
  if (s) parts.push(`--s ${s}`);
  if (allNoTerms.length > 0) parts.push(`--no ${allNoTerms.join(', ')}`);

  return parts.join(' ');
}

// ============================================================================
// P2: T1 Trailing Punctuation Stripper
// ============================================================================

/**
 * P2: Strip trailing sentence punctuation from CLIP prompts.
 * CLIP prompts are comma-separated keyword lists — no periods.
 */
export function stripTrailingPunctuation(prompt: string): string {
  return prompt.replace(/[.!?]+\s*$/, '').trimEnd();
}

// ============================================================================
// P3: T4 Self-Correction Fixer
// ============================================================================

/**
 * P3: Catch T4 self-correction patterns.
 * "...sentence? No, it is <corrected>." → remove the question + correction,
 * keep the corrected content.
 *
 * Operates on the full string (not sentence-split) because the "?" and "No"
 * often span a sentence boundary that the splitter would separate.
 */
export function fixT4SelfCorrection(prompt: string): string {
  // Match: "[anything]? No, it is [corrected content]" or "? No — it is [corrected]"
  // Replace the entire question-correction block with nothing.
  const cleaned = prompt.replace(
    /[^.!?]*\?\s*No[,—–\s]+it\s+is\s+/gi,
    '',
  );

  if (cleaned === prompt) return prompt; // No match — no-op

  return cleaned
    // Fix "period.lowercase" → "period. Uppercase" (from removal joining sentences)
    .replace(/([.!?])([a-z])/g, (_m, p: string, c: string) => `${p} ${c.toUpperCase()}`)
    // Capitalize start of string if it begins lowercase
    .replace(/^\s*([a-z])/, (_m, c: string) => c.toUpperCase())
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ============================================================================
// P8: T4 Meta-Language Opener Fixer (broadened)
// ============================================================================

/** Abstract nouns GPT uses as meta-language sentence subjects in T4 */
export const T4_ABSTRACT_NOUNS = new Set([
  'scene', 'room', 'space', 'place', 'setting', 'environment',
  'stillness', 'silence', 'atmosphere', 'mood', 'feeling',
  'sense', 'quality', 'tone', 'air', 'ambience', 'light',
  'darkness', 'void', 'depth', 'world', 'landscape', 'view',
]);

/** Meta-verbs GPT pairs with abstract nouns in T4 */
export const T4_META_VERBS = new Set([
  'is', 'was', 'has', 'feels', 'carries', 'holds', 'evokes',
  'suggests', 'conveys', 'captures', 'reveals', 'radiates',
  'exudes', 'breathes', 'embodies', 'projects', 'creates',
  'gives', 'lends', 'shows', 'presents',
]);

/**
 * P8: Auto-fix T4 meta-language openers.
 * "The room feels quiet and wistful." → "Quiet and wistful."
 * "The atmosphere carries a sense of awe." → "A sense of awe."
 */
export function fixT4MetaOpeners(prompt: string): string {
  const sentences = prompt.split(/(?<=[.!?])\s+/).filter(Boolean);
  const fixed: string[] = [];

  for (const sentence of sentences) {
    const match = sentence.match(/^The\s+(\w+)\s+(\w+)\s+/i);
    if (match) {
      const noun = (match[1] ?? '').toLowerCase();
      const verb = (match[2] ?? '').toLowerCase();

      if (T4_ABSTRACT_NOUNS.has(noun) && T4_META_VERBS.has(verb)) {
        const remainder = sentence.slice(match[0].length).trim();
        if (remainder.length > 0) {
          fixed.push(remainder.charAt(0).toUpperCase() + remainder.slice(1));
          continue;
        }
      }
    }
    fixed.push(sentence);
  }

  return fixed.join(' ').trim();
}

// ============================================================================
// P10: T4 Short Sentence Merger
// ============================================================================

/**
 * P10: Merge T4 short sentences into the previous sentence via em-dash.
 * "...footprints lead away. Crisp, cinematic, and realistic."
 * → "...footprints lead away — crisp, cinematic, and realistic."
 */
export function mergeT4ShortSentences(prompt: string): string {
  const sentences = prompt.split(/(?<=[.!?])\s+/).filter(Boolean);

  if (sentences.length < 2) return prompt;

  const lastSentence = sentences[sentences.length - 1]!;
  const wordCount = lastSentence.split(/\s+/).length;

  if (wordCount >= 10) return prompt;

  const prev = sentences[sentences.length - 2]!.replace(/[.!?]+$/, '').trimEnd();
  const shortContent = lastSentence.replace(/[.!?]+$/, '').trim();
  const lowered = shortContent.charAt(0).toLowerCase() + shortContent.slice(1);
  const merged = `${prev} — ${lowered}.`;

  const result = [...sentences.slice(0, -2), merged];
  return result.join(' ').trim();
}

// ============================================================================
// P14: T1 Weight-Wrap Enforcement (≤4 words)
// ============================================================================
// Harness rule: T1.weight_wrap_4_words_max
// Harness data: stage_d_fail_rate 0.2408 (REAL_FAILURE)
//
// Problem: GPT weight-wraps phrases longer than 4 words despite being told not to.
//   WRONG: (small girl in a yellow raincoat:1.3)
//   RIGHT: (small girl:1.3), yellow raincoat
//
// Fix: Regex-scan T1 positive for (phrase:weight) where phrase exceeds 4 words
// (hyphenated compounds count as 1 word). Auto-split using conservative 2-word-tail
// heuristic: keep last 2 words inside the wrapper (noun head), eject prefix words
// as unweighted comma-separated terms. Skip malformed/nested parens — just log.
// ============================================================================

/** Regex matching parenthetical weights: (phrase:1.3) */
const PAREN_WEIGHT_RE_GLOBAL = /\(([^):]+):([\d.]+)\)/g;

/**
 * Count words in a phrase. Hyphenated compounds count as ONE word.
 * "frost-encrusted orange survival suit" → 4 words (frost-encrusted=1, orange=1, survival=1, suit=1)
 * "small girl in a yellow raincoat" → 6 words
 */
function countWeightWords(phrase: string): number {
  return phrase.trim().split(/\s+/).filter(Boolean).length;
}

export interface WeightWrapResult {
  text: string;
  fixes: string[];
  skipped: string[];
}

/**
 * P14: Enforce T1 weight-wrap 4-word limit.
 *
 * For each (phrase:weight) where phrase exceeds 4 words:
 * - Keep the last 2 words inside the wrapper (noun head)
 * - Eject prefix words as unweighted comma-separated terms before the wrapper
 *
 * Skips malformed or nested parentheses — logs them but doesn't try to fix.
 */
export function enforceT1WeightWrap(text: string): WeightWrapResult {
  const fixes: string[] = [];
  const skipped: string[] = [];

  // Check for nested parens — we skip these entirely
  const hasNestedParens = /\([^)]*\([^)]*\)/.test(text);
  if (hasNestedParens) {
    skipped.push('Nested parentheses detected — skipping weight-wrap enforcement');
    return { text, fixes, skipped };
  }

  const result = text.replace(PAREN_WEIGHT_RE_GLOBAL, (fullMatch, phrase: string, weight: string) => {
    const trimmedPhrase = phrase.trim();
    const wordCount = countWeightWords(trimmedPhrase);

    // 4 words or fewer — no fix needed
    if (wordCount <= 4) return fullMatch;

    const words = trimmedPhrase.split(/\s+/);

    // Sanity guard: if we somehow have fewer than 3 words after split, skip
    if (words.length < 3) {
      skipped.push(`Unexpected word split for "${trimmedPhrase}" — skipping`);
      return fullMatch;
    }

    // 2-word-tail heuristic: keep last 2 words as the noun head inside wrapper
    const tail = words.slice(-2).join(' ');
    const prefix = words.slice(0, -2).join(', ');

    const fixed = `${prefix}, (${tail}:${weight})`;
    fixes.push(`"(${trimmedPhrase}:${weight})" → "${fixed}"`);
    return fixed;
  });

  return { text: result, fixes, skipped };
}

// ============================================================================
// P15: T3 Over-Length Truncation (280–420 chars)
// ============================================================================
// Harness rule: T3.char_count_in_range
// Harness data: stage_d_fail_rate 0.1728 (REAL_FAILURE)
//
// Problem: GPT produces T3 positive text exceeding 420 chars ~17% of the time.
// Under-length (below 280) is NOT addressed mechanically — that's a prompt
// quality issue, not a post-processing fix.
//
// Truncation cascade:
//   1. Last sentence boundary (". " or "." at end) under 420
//   2. Clause boundary ("; " or " — " or ", ") under 420
//   3. Nearest whitespace under 420
//   After truncation: verify ≥280 chars. If not, fall back to comma truncation.
// ============================================================================

const T3_MAX = 420;
const T3_MIN = 280;

export interface TruncationResult {
  text: string;
  truncated: boolean;
  method?: 'sentence' | 'clause' | 'whitespace' | 'comma-fallback';
  originalLength?: number;
}

/**
 * P15: Truncate T3 positive to ≤420 characters while preserving ≥280 minimum.
 */
export function enforceT3MaxLength(text: string): TruncationResult {
  if (text.length <= T3_MAX) {
    return { text, truncated: false };
  }

  const originalLength = text.length;

  // Strategy 1: Last sentence boundary under limit
  // Look for ". " or "." at end of a sentence within the allowed window
  const sentenceResult = truncateAtBoundary(text, T3_MAX, /\.\s/g, 1);
  if (sentenceResult && sentenceResult.length >= T3_MIN) {
    return {
      text: sentenceResult.trimEnd(),
      truncated: true,
      method: 'sentence',
      originalLength,
    };
  }

  // Strategy 2: Clause boundary (; or — or ,)
  const clauseResult = truncateAtBoundary(text, T3_MAX, /[;]\s|(?:\s—\s)/g, 0);
  if (clauseResult && clauseResult.length >= T3_MIN) {
    return {
      text: clauseResult.trimEnd() + '.',
      truncated: true,
      method: 'clause',
      originalLength,
    };
  }

  // Strategy 3: Comma — tried as a separate step because commas are very common
  // and may produce a result when semicolons/dashes don't exist
  const commaResult = truncateAtBoundary(text, T3_MAX, /,\s/g, 0);
  if (commaResult && commaResult.length >= T3_MIN) {
    return {
      text: commaResult.trimEnd() + '.',
      truncated: true,
      method: 'comma-fallback',
      originalLength,
    };
  }

  // Strategy 4: Nearest whitespace under limit
  const whitespaceResult = truncateAtWhitespace(text, T3_MAX);
  if (whitespaceResult && whitespaceResult.length >= T3_MIN) {
    return {
      text: whitespaceResult.trimEnd() + '.',
      truncated: true,
      method: 'whitespace',
      originalLength,
    };
  }

  // Last resort: if all strategies produce sub-280 results, try comma truncation
  // without the minimum floor check — better to be slightly short than way over
  if (commaResult) {
    return {
      text: commaResult.trimEnd() + '.',
      truncated: true,
      method: 'comma-fallback',
      originalLength,
    };
  }

  // Hard fallback: just slice at whitespace under limit
  if (whitespaceResult) {
    return {
      text: whitespaceResult.trimEnd() + '.',
      truncated: true,
      method: 'whitespace',
      originalLength,
    };
  }

  // Nuclear fallback: hard slice (should never happen with real text)
  return {
    text: text.slice(0, T3_MAX).trimEnd() + '.',
    truncated: true,
    method: 'whitespace',
    originalLength,
  };
}

// ============================================================================
// P16: T4 Over-Length Truncation (≤325 chars)
// ============================================================================
// Harness rule: T4.char_count_under_325
// Harness data: stage_d_fail_rate 0.0524 (BORDERLINE)
//
// Problem: GPT produces T4 positive text exceeding 325 chars ~5% of the time.
// No minimum floor needed for T4.
//
// Truncation cascade:
//   1. Last sentence boundary under 325
//   2. Comma boundary under 325
//   3. Nearest whitespace under 325
// ============================================================================

const T4_MAX = 325;

/**
 * P16: Truncate T4 positive to ≤325 characters.
 */
export function enforceT4MaxLength(text: string): TruncationResult {
  if (text.length <= T4_MAX) {
    return { text, truncated: false };
  }

  const originalLength = text.length;

  // Strategy 1: Last sentence boundary
  const sentenceResult = truncateAtBoundary(text, T4_MAX, /\.\s/g, 1);
  if (sentenceResult) {
    return {
      text: sentenceResult.trimEnd(),
      truncated: true,
      method: 'sentence',
      originalLength,
    };
  }

  // Strategy 2: Comma
  const commaResult = truncateAtBoundary(text, T4_MAX, /,\s/g, 0);
  if (commaResult) {
    return {
      text: commaResult.trimEnd() + '.',
      truncated: true,
      method: 'comma-fallback',
      originalLength,
    };
  }

  // Strategy 3: Nearest whitespace
  const whitespaceResult = truncateAtWhitespace(text, T4_MAX);
  if (whitespaceResult) {
    return {
      text: whitespaceResult.trimEnd() + '.',
      truncated: true,
      method: 'whitespace',
      originalLength,
    };
  }

  // Nuclear fallback
  return {
    text: text.slice(0, T4_MAX).trimEnd() + '.',
    truncated: true,
    method: 'whitespace',
    originalLength,
  };
}

// ============================================================================
// SHARED TRUNCATION HELPERS
// ============================================================================

/**
 * Find the last match of `pattern` that ends at or before `maxLen` in `text`.
 * Returns the text up to and including the match (+ offset chars after match start).
 * Returns null if no match found within the limit.
 */
function truncateAtBoundary(
  text: string,
  maxLen: number,
  pattern: RegExp,
  offset: number,
): string | null {
  let lastGoodPos = -1;

  for (const m of text.matchAll(pattern)) {
    const cutPos = (m.index ?? 0) + (m[0]?.length ?? 0) - offset;
    if (cutPos > 0 && cutPos <= maxLen) {
      lastGoodPos = cutPos;
    }
  }

  if (lastGoodPos <= 0) return null;
  return text.slice(0, lastGoodPos);
}

/**
 * Find the last whitespace position at or before `maxLen`.
 * Returns text up to that position, or null if no whitespace found.
 */
function truncateAtWhitespace(text: string, maxLen: number): string | null {
  const window = text.slice(0, maxLen);
  const lastSpace = window.lastIndexOf(' ');
  if (lastSpace <= 0) return null;
  return text.slice(0, lastSpace);
}

// ============================================================================
// FULL PIPELINE ORCHESTRATOR
// ============================================================================

export interface TierPrompts {
  tier1: { positive: string; negative: string };
  tier2: { positive: string; negative: string };
  tier3: { positive: string; negative: string };
  tier4: { positive: string; negative: string };
}

/**
 * Run the full post-processing pipeline on all 4 tiers.
 * Phase B: tier2 will be empty strings (MJ removed from Call 2).
 * Processing still runs — deduplicateMjParams on empty string is a no-op.
 * Mutates nothing — returns a new object.
 */
export function postProcessTiers(tiers: TierPrompts): TierPrompts {
  return {
    tier1: {
      positive: (() => {
        let text = tiers.tier1.positive;
        // P13: weight cap
        const capResult = enforceWeightCap(text, 8);
        if (capResult.wasFixed) text = capResult.text;
        // P2: strip trailing punctuation
        text = stripTrailingPunctuation(text);
        // P14: weight-wrap 4-word enforcement
        const wrapResult = enforceT1WeightWrap(text);
        if (wrapResult.fixes.length > 0) {
          text = wrapResult.text;
          // Log fixes for observability (dev endpoint captures Stage B vs A diff)
          if (typeof console !== 'undefined') {
            console.debug(
              '[harmony-post-processing] P14 T1 weight-wrap fixes:',
              wrapResult.fixes.join('; '),
            );
          }
        }
        if (wrapResult.skipped.length > 0 && typeof console !== 'undefined') {
          console.debug(
            '[harmony-post-processing] P14 T1 weight-wrap skipped:',
            wrapResult.skipped.join('; '),
          );
        }
        return text;
      })(),
      negative: stripTrailingPunctuation(tiers.tier1.negative),
    },
    tier2: {
      positive: deduplicateMjParams(tiers.tier2.positive),
      negative: tiers.tier2.negative,
    },
    tier3: {
      positive: (() => {
        // P15: over-length truncation
        const result = enforceT3MaxLength(tiers.tier3.positive);
        if (result.truncated && typeof console !== 'undefined') {
          console.debug(
            `[harmony-post-processing] P15 T3 truncated: ${result.originalLength} → ${result.text.length} (${result.method})`,
          );
        }
        return result.text;
      })(),
      negative: tiers.tier3.negative,
    },
    tier4: {
      positive: (() => {
        // Existing: P3 → P8 → P10
        let text = mergeT4ShortSentences(fixT4MetaOpeners(fixT4SelfCorrection(tiers.tier4.positive)));
        // P16: over-length truncation (runs AFTER existing fixes which may change length)
        const result = enforceT4MaxLength(text);
        if (result.truncated) {
          text = result.text;
          if (typeof console !== 'undefined') {
            console.debug(
              `[harmony-post-processing] P16 T4 truncated: ${result.originalLength} → ${text.length} (${result.method})`,
            );
          }
        }
        return text;
      })(),
      negative: tiers.tier4.negative,
    },
  };
}
