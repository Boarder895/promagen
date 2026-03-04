// src/lib/prompt-post-process.ts
// ============================================================================
// PROMPT POST-PROCESSING — Shared Polish Pass
// ============================================================================
//
// v1.0.0 (Mar 2026) — Extracted from weather-prompt-generator.ts
// Provides 4 text-polishing functions + a convenience wrapper that applies
// them in the correct order for any tier.
//
// Consumers:
//   - weather-prompt-generator.ts (homepage path)
//   - prompt-builder.tsx          (builder / "Try in" path)
//
// Signatures accept `atmosphereModifier: string` instead of LightingState
// so both consumers can call them (the builder doesn't have LightingState).
//
// Existing features preserved: Yes — logic identical to pre-extraction.
// ============================================================================

import type { AssembledPrompt } from '@/types/prompt-builder';

// ============================================================================
// 1. LEAK PHRASE NEUTRALISATION
// ============================================================================

/**
 * Replace culturally-specific or overly-assumptive nouns that can misfire
 * across many cities/venues.
 *
 * Example: "prayer flags" → "entrance flags"
 */
export function neutraliseLeakPhrases(text: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/prayer flags/gi, 'entrance flags'],
    [/temple steps/gi, 'stone steps'],
    [/faint moisture on temple steps/gi, 'faint moisture on stone steps'],
    [/offering items/gi, 'loose items'],
  ];

  let out = text;
  for (const [re, rep] of replacements) {
    out = out.replace(re, rep);
  }
  return out;
}

// ============================================================================
// 2. COMMON GRAMMAR FIXES
// ============================================================================

/**
 * Clean "with in" → "in", double commas, and excess whitespace.
 * Safe to run on any tier's output.
 */
export function fixCommonGrammar(text: string): string {
  let out = text;

  // Flux variant can produce "with in atmospheric haze" when an atmosphere
  // modifier begins with "in ...".
  out = out.replace(/\bwith in\b/gi, 'in');

  // Clean double commas / spacing.
  out = out.replace(/\s+,/g, ',');
  out = out.replace(/,\s*,/g, ', ');
  out = out.replace(/\s{2,}/g, ' ');
  return out.trim();
}

// ============================================================================
// 3. TIER 1 CLIP POSITIVE DEDUP
// ============================================================================

/**
 * Strip duplicate CLIP weight tokens like `(haze:1.1)` when the atmosphere
 * modifier already encodes the same phenomenon.
 *
 * @param positive     — The assembled positive prompt (CLIP syntax)
 * @param atmosphereModifier — Atmosphere string to check for phenomenon keywords.
 *   In the generator this is `lighting.atmosphereModifier ?? ''`.
 *   In the builder this is derived from `categoryState.atmosphere`.
 */
export function postProcessTier1Positive(
  positive: string,
  atmosphereModifier: string,
): string {
  const atm = atmosphereModifier.toLowerCase();
  const fenómenos = ['haze', 'mist', 'fog', 'smoke', 'dust'];

  let out = positive;
  for (const k of fenómenos) {
    if (atm.includes(k)) {
      // Remove both "(haze:1.1)" and plain "haze" tokens that sit as comma fragments.
      const weighted = new RegExp(`\\(\\s*${k}\\s*:\\s*1\\.1\\s*\\)\\s*,?\\s*`, 'ig');
      const plainMid = new RegExp(`,\\s*${k}\\s*,`, 'ig');
      const plainEnd = new RegExp(`,\\s*${k}\\s*$`, 'ig');
      out = out.replace(weighted, '');
      out = out.replace(plainMid, ', ');
      out = out.replace(plainEnd, '');
    }
  }

  out = out.replace(/,\s*,/g, ', ');
  out = out.replace(/\s{2,}/g, ' ');
  out = out.replace(/,\s*$/g, '');
  return out.trim();
}

// ============================================================================
// 4. REDUNDANT PHENOMENON REMOVAL
// ============================================================================

/**
 * Strip ultra-simple "X overhead." sentences when the atmosphere modifier
 * already encodes the phenomenon. Avoids deleting richer sky clauses.
 *
 * @param text               — The assembled prompt text
 * @param atmosphereModifier — Atmosphere string to check for phenomenon keywords.
 */
export function removeRedundantPhenomenon(
  text: string,
  atmosphereModifier: string,
): string {
  const atm = atmosphereModifier.toLowerCase();

  const pairs: Array<{ k: string; re: RegExp }> = [
    { k: 'haze', re: /\s+Haze overhead\.\s*/i },
    { k: 'mist', re: /\s+Mist overhead\.\s*/i },
    { k: 'fog', re: /\s+Fog overhead\.\s*/i },
    { k: 'smoke', re: /\s+Smoke overhead\.\s*/i },
    { k: 'dust', re: /\s+Dust overhead\.\s*/i },
  ];

  let out = text;
  for (const p of pairs) {
    if (atm.includes(p.k)) {
      out = out.replace(p.re, ' ');
    }
  }
  return out;
}

// ============================================================================
// 5. TIER 2 MJ PHENOMENON TRIM
// ============================================================================

/**
 * Extra dedup for Midjourney prompts: remove ", haze," etc. when the
 * atmosphere modifier already encodes the phenomenon.
 */
export function trimMjPhenomenonDuplicates(
  text: string,
  atmosphereModifier: string,
): string {
  const atm = atmosphereModifier.toLowerCase();
  let out = text;

  if (atm.includes('haze')) out = out.replace(/,\s*haze\s*,/i, ', ');
  if (atm.includes('mist')) out = out.replace(/,\s*mist\s*,/i, ', ');
  if (atm.includes('fog')) out = out.replace(/,\s*fog\s*,/i, ', ');
  if (atm.includes('smoke')) out = out.replace(/,\s*smoke\s*,/i, ', ');
  if (atm.includes('dust')) out = out.replace(/,\s*dust\s*,/i, ', ');

  return out;
}

// ============================================================================
// 6. CONVENIENCE WRAPPER — Apply all post-processing in the correct order
// ============================================================================

/**
 * Apply the full post-processing pipeline to an assembled prompt, matching
 * the exact same sequence used in the homepage generator.
 *
 * @param assembled           — Raw output from `assemblePrompt()`
 * @param tier                — Platform tier (1–4)
 * @param atmosphereModifier  — Atmosphere hint string for phenomenon dedup.
 *   Generator passes `lighting.atmosphereModifier ?? ''`.
 *   Builder passes concatenated atmosphere selections + customValue.
 * @returns A new AssembledPrompt with polished `.positive` and `.negative`.
 */
export function postProcessAssembled(
  assembled: AssembledPrompt,
  tier: 1 | 2 | 3 | 4,
  atmosphereModifier: string,
): AssembledPrompt {
  let positive = assembled.positive;
  let negative = assembled.negative;

  if (tier === 1 && positive) {
    // Tier 1 (CLIP): leak phrases → CLIP dedup → grammar
    positive = neutraliseLeakPhrases(positive);
    positive = postProcessTier1Positive(positive, atmosphereModifier);
    positive = fixCommonGrammar(positive);

    if (negative) {
      negative = fixCommonGrammar(neutraliseLeakPhrases(negative));
    }
  } else {
    // Tiers 2–4: leak phrases → redundant phenomenon → grammar
    positive = neutraliseLeakPhrases(positive);
    positive = removeRedundantPhenomenon(positive, atmosphereModifier);
    positive = fixCommonGrammar(positive);

    // Tier 2 (MJ): extra phenomenon trim
    if (tier === 2) {
      positive = trimMjPhenomenonDuplicates(positive, atmosphereModifier);
      positive = fixCommonGrammar(positive);
    }

    if (negative) {
      negative = fixCommonGrammar(neutraliseLeakPhrases(negative));
    }
  }

  return { ...assembled, positive, negative };
}
