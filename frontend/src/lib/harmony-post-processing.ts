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
//
// Problem: GPT weight-wraps phrases longer than 4 words despite being told not to.
//   WRONG: (small girl in a yellow raincoat:1.3)
//   RIGHT: (small girl:1.3), yellow raincoat
//
// v2.0: Smarter noun-anchor tail selection with stop-word guard.
//   Old 2-word-tail heuristic produced orphan tokens and nonsense tails like
//   "(of light:1.3)" or "(to shoulder:1.2)". New algorithm:
//   1. Scan from end for a tail whose first word is NOT a stop word
//   2. Filter pure stop words from ejected prefix (don't emit "in", "of", "to" alone)
//   3. Fallback: unwrap phrase entirely rather than producing garbage
// ============================================================================

/** Regex matching parenthetical weights: (phrase:1.3) */
const PAREN_WEIGHT_RE_GLOBAL = /\(([^):]+):([\d.]+)\)/g;

/**
 * Count words in a phrase. Hyphenated compounds count as ONE word.
 * "frost-encrusted orange survival suit" → 4 words
 */
function countWeightWords(phrase: string): number {
  return phrase.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Stop words that should never begin a weighted tail.
 * These produce nonsense CLIP tokens like "(of light:1.3)" or "(to shoulder:1.2)".
 * Also filtered from ejected prefix to prevent orphan tokens like "in", "and", "the".
 */
const WEIGHT_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at',
  'by', 'with', 'from', 'through', 'across', 'under', 'over',
  'into', 'onto', 'upon', 'between', 'among', 'for', 'as',
]);

function isWeightStopWord(word: string): boolean {
  return WEIGHT_STOP_WORDS.has(word.toLowerCase());
}

export interface WeightWrapResult {
  text: string;
  fixes: string[];
  skipped: string[];
}

/**
 * Find the best noun-anchor tail for a weighted phrase.
 *
 * Scans from the end trying tail lengths 2, 3, then 4. The first tail
 * whose leading word is NOT a stop word wins. Returns null if every
 * possible tail starts with a stop word — caller should use fallback.
 */
function findNounAnchorTail(
  words: string[],
): { tail: string; prefixWords: string[] } | null {
  const maxTail = Math.min(4, words.length - 1);

  for (let tailLen = 2; tailLen <= maxTail; tailLen++) {
    const tailStart = words.length - tailLen;
    const firstTailWord = words[tailStart];

    if (firstTailWord && !isWeightStopWord(firstTailWord)) {
      return {
        tail: words.slice(tailStart).join(' '),
        prefixWords: words.slice(0, tailStart),
      };
    }
  }

  return null;
}

/**
 * P14: Enforce T1 weight-wrap 4-word limit.
 *
 * v2.0 algorithm (per ChatGPT analysis, 12 Apr 2026):
 * 1. For each (phrase:weight) where phrase exceeds 4 words:
 *    a. Find noun-anchor tail (2–4 words, must not start with stop word)
 *    b. Eject prefix words, filtering out pure stop words
 *    c. If no valid tail exists, unwrap the phrase entirely (no weight)
 *       rather than producing semantic garbage
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

    // Sanity guard
    if (words.length < 3) {
      skipped.push(`Unexpected word split for "${trimmedPhrase}" — skipping`);
      return fullMatch;
    }

    // Try to find a noun-anchor tail
    const anchor = findNounAnchorTail(words);

    if (!anchor) {
      // FALLBACK: no valid tail found — every tail starts with a stop word.
      // Unwrap the phrase entirely rather than producing garbage like "(of light:1.3)".
      // A semantically intact unweighted phrase is better than shredded nonsense.
      const unwrapped = trimmedPhrase;
      fixes.push(`"(${trimmedPhrase}:${weight})" → "${unwrapped}" [unwrapped — no valid noun tail]`);
      return unwrapped;
    }

    // Build the fix: filter stop words from prefix, keep the weighted tail
    const meaningfulPrefix = anchor.prefixWords
      .filter((w) => !isWeightStopWord(w));

    let fixed: string;
    if (meaningfulPrefix.length > 0) {
      fixed = `${meaningfulPrefix.join(', ')}, (${anchor.tail}:${weight})`;
    } else {
      // All prefix words were stop words — just the weighted tail
      fixed = `(${anchor.tail}:${weight})`;
    }

    fixes.push(`"(${trimmedPhrase}:${weight})" → "${fixed}"`);
    return fixed;
  });

  return { text: result, fixes, skipped };
}



// ============================================================================
// P17/P18: T3/T4 deterministic language cleanups
// ============================================================================

export interface TextCleanupResult {
  text: string;
  fixes: string[];
}

const T3_PHOTOGRAPHY_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  // ── Camera brand patterns ────────────────────────────────────────────────
  // Convert to the visual CHARACTER the photographer intended, not a quality
  // label. "Leica" means the photographer wants: clinical sharpness with rich
  // natural rendering. Express that as what it LOOKS LIKE in the image.
  //
  // NO compound catch-all patterns. "35mm f/1.4" should fire TWO conversions:
  // "35mm" → wide view, "f/1.4" → soft separation. The old compound pattern
  // flattened both into one generic phrase, losing visual information.
  [/\b\d{1,3}\s*mm\s+Leica\b/gi, 'through a wide natural frame with clinical sharpness and rich tonal depth'],
  [/\bLeica\s+(?:M\d{1,2}|SL\d?-?\w*|Q\d?)\b/gi, 'rendered with clinical sharpness, natural colour and fine micro-contrast'],
  [/\bCanon\s+(?:EOS\s*)?(?:R\d|[567]D)\b/gi, 'captured with warm natural colour and smooth skin-like rendering'],
  [/\bNikon\s+(?:Z\d|D\d{3,4})\b/gi, 'rendered with neutral precision and strong tonal range'],
  [/\bSony\s+A\d{4}\b/gi, 'with saturated vivid colour and razor-fine detail'],
  [/\bHasselblad\b/gi, 'with medium-format depth, vast tonal range and quiet naturalistic colour'],
  // ── Focal length patterns ────────────────────────────────────────────────
  [/\b24\s*mm\s*(?:lens)?\b/gi, 'an expansive wide-angle view pulling the whole scene in'],
  [/\b35\s*mm\s*(?:lens)?\b/gi, 'a natural wide view with honest spatial proportions'],
  [/\b50\s*mm\s*(?:lens)?\b/gi, 'a natural human-eye perspective'],
  [/\b85\s*mm\s*(?:lens)?\b/gi, 'a tighter compressed view that isolates the subject'],
  [/\b(?:70\s*-?\s*200|100\s*-?\s*400)\s*mm\b/gi, 'telephoto compression pulling distant detail close and flattening depth'],
  [/\b\d{3}\s*mm\b/gi, 'heavily compressed distant detail stacked in narrow depth'],
  // ── Aperture/f-stop patterns ─────────────────────────────────────────────
  [/\bf\/?\s*1\.2\b/gi, 'extremely shallow focus with dreamlike separation from the background'],
  [/\bf\/?\s*1\.4\b/gi, 'soft background separation melting detail behind the subject'],
  [/\bf\/?\s*1\.8\b/gi, 'gentle background softening'],
  [/\bf\/?\s*2\.8\b/gi, 'moderate background softening with a sense of depth'],
  [/\bf\/?\s*(?:4|5\.6)\b/gi, 'balanced sharpness across the frame'],
  [/\bf\/?\s*(?:8|11|16)\b/gi, 'deep sharpness from foreground to distance'],
  // ── ISO/exposure ─────────────────────────────────────────────────────────
  [/\bISO\s*\d{2,3}\b/gi, 'clean grain-free detail with smooth shadow transitions'],
  [/\bISO\s*\d{4,6}\b/gi, 'visible grain lending a raw documentary texture'],
  // ── Depth of field terms ─────────────────────────────────────────────────
  [/\bdeep focus\b/gi, 'sharp from foreground to distance'],
  [/\bshallow depth of field\b/gi, 'the subject stays crisp while the background falls softly away'],
  [/\bmoderate depth of field\b/gi, 'the focal point is clear with gentle softening beyond it'],
  [/\bkeeping the background crisp\b/gi, 'distant detail remains clearly legible'],
  [/\bbackground (?:stays|remaining|remains) crisp\b/gi, 'distant detail remains clearly legible'],
  [/\bsharp focus\b/gi, 'edges and textures resolve clearly'],
];

const T4_PHOTOGRAPHY_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  // ── Camera brands (T4 = every word a casual user understands) ────────────
  // No compound catch-alls. Individual patterns fire separately.
  [/\b\d{1,3}\s*mm\s+Leica\b/gi, 'a wide natural view that looks very sharp and lifelike'],
  [/\bLeica\s+(?:M\d{1,2}|SL\d?-?\w*|Q\d?)\b/gi, 'very sharp with natural lifelike colours'],
  [/\bCanon\s+(?:EOS\s*)?(?:R\d|[567]D)\b/gi, 'sharp with warm natural colours'],
  [/\bNikon\s+(?:Z\d|D\d{3,4})\b/gi, 'sharp with smooth even tones'],
  [/\bSony\s+A\d{4}\b/gi, 'bright vivid colours with very fine detail'],
  [/\bHasselblad\b/gi, 'extraordinarily detailed with rich subtle tones'],
  // ── Focal lengths ────────────────────────────────────────────────────────
  [/\b24\s*mm\s*(?:lens)?\b/gi, 'wide-angle view taking in the whole scene'],
  [/\b35\s*mm\s*(?:lens)?\b/gi, 'natural wide view'],
  [/\b50\s*mm\s*(?:lens)?\b/gi, 'natural perspective like your own eyes see it'],
  [/\b85\s*mm\s*(?:lens)?\b/gi, 'zoomed-in portrait view that isolates the subject'],
  [/\b(?:70\s*-?\s*200|100\s*-?\s*400)\s*mm\b/gi, 'far-away detail brought up close'],
  [/\b\d{3}\s*mm\b/gi, 'tight zoom on distant detail'],
  // ── Aperture ─────────────────────────────────────────────────────────────
  [/\bf\/?\s*1\.[24]\b/gi, 'very blurry background with the subject standing out sharply'],
  [/\bf\/?\s*1\.8\b/gi, 'softly blurred background'],
  [/\bf\/?\s*2\.8\b/gi, 'slightly blurred background'],
  [/\bf\/?\s*(?:4|5\.6)\b/gi, 'mostly sharp from front to back'],
  [/\bf\/?\s*(?:8|11|16)\b/gi, 'everything sharp from near to far'],
  // ── ISO ──────────────────────────────────────────────────────────────────
  [/\bISO\s*\d{2,3}\b/gi, 'clean smooth image with no grain'],
  [/\bISO\s*\d{4,6}\b/gi, 'slightly grainy with a film-like feel'],
  // ── Depth of field ───────────────────────────────────────────────────────
  [/\bdeep focus\b/gi, 'sharp front to back'],
  [/\bshallow depth of field\b/gi, 'soft background'],
  [/\bmoderate depth of field\b/gi, 'gentle background softening'],
  [/\bkeeping the background crisp\b/gi, 'clear distance detail'],
  [/\bbackground (?:stays|remaining|remains) crisp\b/gi, 'clear distance detail'],
  [/\bsharp focus\b/gi, 'clear detail'],
];

export function convertPhotographyJargonTierAware(
  tier: 'tier3' | 'tier4',
  text: string,
): TextCleanupResult {
  const conversions = tier === 'tier3' ? T3_PHOTOGRAPHY_CONVERSIONS : T4_PHOTOGRAPHY_CONVERSIONS;
  let next = text;
  const fixes: string[] = [];

  for (const [pattern, replacement] of conversions) {
    if (pattern.test(next)) {
      next = next.replace(pattern, replacement);
      fixes.push(`${pattern} → ${replacement}`);
    }
  }

  return { text: next, fixes };
}

const T3_BANNED_PHRASE_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bthe mood is\s+/gi, ''],
  [/\bthe scene feels\s+/gi, ''],
  [/\bthe scene is\s+/gi, ''],
  [/\bthat feels\s+/gi, ''],
  [/\bin the style of\s+/gi, ''],
  [/\brendered as\s+/gi, ''],
];

export function stripOrRewriteT3BannedPhrases(text: string): TextCleanupResult {
  let next = text;
  const fixes: string[] = [];
  for (const [pattern, replacement] of T3_BANNED_PHRASE_REWRITES) {
    if (pattern.test(next)) {
      next = next.replace(pattern, replacement);
      fixes.push(pattern.toString());
    }
  }
  next = next.replace(/\s{2,}/g, ' ').trim();
  return { text: next, fixes };
}

const T3_BANNED_TAIL_PATTERNS: ReadonlyArray<RegExp> = [
  /,?\s*captured in [^.]+\.?$/i,
  /,?\s*captured like [^.]+\.?$/i,
  /,?\s*shot with [^.]+\.?$/i,
  /,?\s*all framed in [^.]+\.?$/i,
  /,?\s*in cinematic [^.]+\.?$/i,
];

export function stripT3BannedTailConstructions(text: string): TextCleanupResult {
  let next = text;
  const fixes: string[] = [];
  for (const pattern of T3_BANNED_TAIL_PATTERNS) {
    if (pattern.test(next)) {
      next = next.replace(pattern, '.');
      fixes.push(pattern.toString());
    }
  }
  next = next.replace(/\s+\./g, '.').replace(/\.{2,}/g, '.').replace(/\s{2,}/g, ' ').trim();
  return { text: next, fixes };
}

// ============================================================================
// P15: T3 Over-Length Truncation (280–420 chars)
// ============================================================================
// Harness rule: T3.char_count_in_range
// Harness data: stage_d_fail_rate 0.1728 (REAL_FAILURE)
//
// Problem: GPT produces T3 positive text exceeding 420 chars ~17% of the time.
// Hard-under T3 (below 220) is rescued mechanically with a minimal
// deterministic padding clause so sparse / hostile inputs do not collapse the
// structural band.
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
  method?: 'sentence' | 'clause' | 'whitespace' | 'comma-fallback' | 'underlength-rescue';
  originalLength?: number;
}

const T3_HARD_MIN = 220;

const T3_UNDERLENGTH_CLAUSES: ReadonlyArray<string> = [
  'The scene remains visually grounded and easy to read.',
  'The image stays coherent, direct, and visually clear.',
  'The overall view remains natural, legible, and visually grounded.',
];

function appendSentence(base: string, sentence: string): string {
  const trimmedBase = base.trim();
  const trimmedSentence = sentence.trim();
  if (!trimmedSentence) return trimmedBase;

  const normalisedBase = /[.!?]$/.test(trimmedBase)
    ? trimmedBase
    : `${trimmedBase}.`;

  return `${normalisedBase} ${trimmedSentence}`.replace(/\s{2,}/g, ' ').trim();
}

function rescueUnderlengthT3(text: string): TruncationResult {
  if (text.length >= T3_HARD_MIN) {
    return { text, truncated: false };
  }

  const originalLength = text.length;
  let next = text.trim();

  for (const clause of T3_UNDERLENGTH_CLAUSES) {
    if (next.length >= T3_HARD_MIN) break;
    if (next.toLowerCase().includes(clause.toLowerCase())) continue;
    next = appendSentence(next, clause);
  }

  if (next.length < T3_HARD_MIN) {
    next = appendSentence(next, 'The framing stays simple and visually consistent.');
  }

  if (next.length > T3_MAX) {
    const trimmed = truncateAtWhitespace(next, T3_MAX) ?? next.slice(0, T3_MAX);
    return {
      text: trimmed.trimEnd() + '.',
      truncated: true,
      method: 'underlength-rescue',
      originalLength,
    };
  }

  return {
    text: next,
    truncated: true,
    method: 'underlength-rescue',
    originalLength,
  };
}

/**
 * P15: Keep T3 positive inside the accepted length band.
 *
 * Over-length text is truncated deterministically.
 * Hard-under text is padded with a minimal deterministic rescue clause so the
 * product stays inside the band on sparse / trap inputs without asking GPT to
 * count characters correctly.
 */
export function enforceT3MaxLength(text: string): TruncationResult {
  if (text.length < T3_HARD_MIN) {
    return rescueUnderlengthT3(text);
  }

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
// P18: NUMERIC MEASUREMENT → VISUAL CONVERSION (Aim 6.2, 6.3 — Phase 3)
// ============================================================================
// Raw numeric measurements (15 km/h, south-westerly, 30 degrees) waste
// T3/T4 budget and confuse casual users. Convert to visual equivalents.
//
// Authority: api-call-2-v2_1_0.md §10 Aim 6, §12.2
// ============================================================================

/** Wind speed conversions (km/h and mph to visual descriptions) */
const WIND_SPEED_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:0|[1-5])\s*km\/h\b/gi, 'still air'],
  [/(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:[6-9]|1[0-9])\s*km\/h\b/gi, 'a light breeze'],
  [/(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:2[0-9]|3[0-9])\s*km\/h\b/gi, 'a steady wind'],
  [/(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:4[0-9]|5[0-9])\s*km\/h\b/gi, 'a strong wind'],
  [/(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:6[0-9]|[7-9][0-9])\s*km\/h\b/gi, 'fierce gusting wind'],
  [/(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b\d{3,}\s*km\/h\b/gi, 'extreme gale-force wind'],
  [/(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:[1-9]|1[0-2])\s*mph\b/gi, 'a light breeze'],
  [/(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:1[3-9]|2[0-4])\s*mph\b/gi, 'a steady wind'],
  [/(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:2[5-9]|3[0-9])\s*mph\b/gi, 'a strong wind'],
  [/(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:4[0-9]|[5-9][0-9])\s*mph\b/gi, 'fierce wind'],
];

const COMPASS_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\s+(?:wind|breeze|gust)s?\b/gi, 'wind'],
  [/\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b/gi, ''],
];

const NUMERIC_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b-?\d+\s*°?\s*C\b/gi, 'cold air'],
  [/\b\d+\s*°?\s*F\b/gi, 'warm air'],
  [/\b\d+(?:\.\d+)?\s*(?:metres?|meters?|m)\s+(?:tall|high)\b/gi, 'towering'],
  [/\b\d+(?:\.\d+)?\s*(?:feet|ft)\s+(?:tall|high)\b/gi, 'towering'],
  [/\b\d+(?:\.\d+)?\s*(?:metres?|meters?|m|feet|ft)\s+(?:wide|long)\b/gi, 'broad'],
  [/\b\d+(?:\.\d+)?\s*(?:km|kilometres?|kilometers?|miles?)\s+(?:away|distant)\b/gi, 'in the distance'],
  [/\b\d+(?:\.\d+)?\s*(?:cm|mm|inches?|in)\b/gi, ''],
];

const CLOCK_TIME_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:0?[5-6])\s*AM\b/gi, 'at first light'],
  [/\b(?:0?[7-9]|10|11)\s*AM\b/gi, 'in the morning'],
  [/\b12\s*PM\b/gi, 'at midday'],
  [/\b(?:0?1|0?2|0?3|0?4)\s*PM\b/gi, 'in the afternoon'],
  [/\b(?:0?5|0?6|0?7)\s*PM\b/gi, 'towards evening'],
  [/\b(?:0?8|0?9|10|11)\s*PM\b/gi, 'late at night'],
];

function cleanupMeasurementResiduals(text: string): string {
  return text
    .replace(/,\s*,/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\b(?:a|the)\s+,/gi, ',')
    .replace(/,\s*\./g, '.')
    .replace(/^\s*,\s*/g, '')
    .replace(/\s+,/g, ',')
    .trim();
}

/**
 * P18: Convert raw numeric measurements to visual equivalents in T3/T4.
 *
 * Goal: remove raw numeric/compass clutter while preserving the visible effect.
 * This keeps T3/T4 readable and avoids leaking technical measurements to users.
 */
export function convertMeasurementsToVisual(text: string): TextCleanupResult {
  let next = text;
  const fixes: string[] = [];

  for (const table of [WIND_SPEED_CONVERSIONS, CLOCK_TIME_CONVERSIONS, COMPASS_CONVERSIONS, NUMERIC_CONVERSIONS]) {
    for (const [pattern, replacement] of table) {
      if (pattern.test(next)) {
        const before = next;
        next = next.replace(pattern, replacement);
        if (next !== before) {
          fixes.push(`${pattern} → "${replacement || '(removed)'}"`);
        }
      }
    }
  }

  next = cleanupMeasurementResiduals(next);
  return { text: next, fixes };
}

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
        let text = tiers.tier3.positive;
        const jargon = convertPhotographyJargonTierAware('tier3', text);
        if (jargon.fixes.length > 0) text = jargon.text;
        // P18: numeric measurement → visual conversion
        const measurements = convertMeasurementsToVisual(text);
        if (measurements.fixes.length > 0) text = measurements.text;
        const banned = stripOrRewriteT3BannedPhrases(text);
        if (banned.fixes.length > 0) text = banned.text;
        const tails = stripT3BannedTailConstructions(text);
        if (tails.fixes.length > 0) text = tails.text;
        const result = enforceT3MaxLength(text);
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
        let text = mergeT4ShortSentences(fixT4MetaOpeners(fixT4SelfCorrection(tiers.tier4.positive)));
        const jargon = convertPhotographyJargonTierAware('tier4', text);
        if (jargon.fixes.length > 0) text = jargon.text;
        // P18: numeric measurement → visual conversion
        const measurements = convertMeasurementsToVisual(text);
        if (measurements.fixes.length > 0) text = measurements.text;
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
