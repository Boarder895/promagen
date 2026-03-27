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
//   T1: P12 (strip CLIP adjectives) → P13 (weight cap 8) → P2 (strip punctuation)
//   T2: P1 (dedup MJ params)
//   T3: P11 (strip abstract meta-openers)
//   T4: P3 (self-correction) → P8 (meta-openers) → P10 (short sentence merge)
//
// Authority: harmonizing-claude-openai.md §6, §10
// Test file: src/lib/__tests__/harmony-post-processing.test.ts
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
// P11: T3 Meta-Commentary Opener Fixer (broadened)
// ============================================================================

/** Abstract nouns GPT uses as meta-language sentence subjects in T3 */
export const T3_ABSTRACT_NOUNS = new Set([
  'scene', 'stillness', 'silence', 'atmosphere', 'mood', 'feeling',
  'sense', 'quality', 'tone', 'air', 'ambience', 'serenity', 'tension',
  'calm', 'energy', 'quiet', 'peace', 'weight', 'presence', 'void',
]);

/** Perception verbs GPT pairs with abstract nouns in T3 */
export const T3_PERCEPTION_VERBS = new Set([
  'feels', 'carries', 'holds', 'evokes', 'suggests', 'conveys',
  'captures', 'reveals', 'radiates', 'exudes', 'breathes', 'embodies',
  'projects', 'creates', 'gives', 'lends', 'imparts', 'has',
]);

/**
 * P11: Strip meta-commentary sentence openers from T3.
 * "The stillness feels immense and grounded." → "Immense and grounded."
 * "The atmosphere carries a quiet weight." → "A quiet weight."
 */
export function fixT3MetaOpeners(prompt: string): string {
  const sentences = prompt.split(/(?<=[.!?])\s+/).filter(Boolean);
  const fixed: string[] = [];

  for (const sentence of sentences) {
    const match = sentence.match(/^The\s+(\w+)\s+(\w+)\s+/i);
    if (match) {
      const noun = (match[1] ?? '').toLowerCase();
      const verb = (match[2] ?? '').toLowerCase();

      if (T3_ABSTRACT_NOUNS.has(noun) && T3_PERCEPTION_VERBS.has(verb)) {
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
// P12: T1 CLIP Qualitative Adjective Stripper
// ============================================================================

/** Adjectives that have no visual meaning to CLIP encoders */
export const CLIP_UNFRIENDLY_ADJECTIVES = [
  'subtle', 'gentle', 'soft', 'faint', 'delicate', 'quiet',
  'slight', 'mild', 'tender', 'hushed',
] as const;

/**
 * P12: Strip CLIP-unfriendly qualitative adjectives from T1 prompts.
 * Only strips from UNWEIGHTED segments — weight-wrapped terms are never modified.
 * "subtle footprints" → "footprints"
 * "(soft glow:1.2)" → "(soft glow:1.2)" (preserved)
 */
export function stripClipQualitativeAdjectives(prompt: string): string {
  const segments = prompt.split(',');
  const processed = segments.map((segment) => {
    const trimmed = segment.trim();
    if (trimmed.includes('(') || trimmed.includes(')')) return segment;

    let result = trimmed;
    for (const adj of CLIP_UNFRIENDLY_ADJECTIVES) {
      const pattern = new RegExp(`\\b${adj}\\s+(?=[a-z])`, 'gi');
      result = result.replace(pattern, '');
    }
    const leadingSpace = segment.match(/^(\s*)/)?.[0] ?? '';
    return leadingSpace + result.trim();
  });

  return processed.join(',').replace(/,\s*,/g, ',').trim();
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
 * Mutates nothing — returns a new object.
 */
export function postProcessTiers(tiers: TierPrompts): TierPrompts {
  return {
    tier1: {
      positive: (() => {
        let text = stripClipQualitativeAdjectives(tiers.tier1.positive);
        const capResult = enforceWeightCap(text, 8);
        if (capResult.wasFixed) text = capResult.text;
        return stripTrailingPunctuation(text);
      })(),
      negative: stripTrailingPunctuation(tiers.tier1.negative),
    },
    tier2: {
      positive: deduplicateMjParams(tiers.tier2.positive),
      negative: tiers.tier2.negative,
    },
    tier3: {
      positive: fixT3MetaOpeners(tiers.tier3.positive),
      negative: tiers.tier3.negative,
    },
    tier4: {
      positive: mergeT4ShortSentences(fixT4MetaOpeners(fixT4SelfCorrection(tiers.tier4.positive))),
      negative: tiers.tier4.negative,
    },
  };
}
