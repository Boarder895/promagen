// src/lib/harmony-compliance.ts
// ============================================================================
// HARMONY COMPLIANCE GATE — Deterministic prompt validation & correction
// ============================================================================
// Pure functions that validate and fix prompt syntax AFTER GPT responds.
// These are permanent safety nets — they don't depend on GPT following rules.
//
// Design principle: Every fix that can be expressed as code MUST be code,
// not another system prompt rule. Code catches it 100% of the time.
// System prompt rules catch it ~70-90% of the time.
//
// Authority: harmonizing-claude-openai.md §10 (Decision Framework)
// Used by: generate-tier-prompts/route.ts, optimise-prompt/route.ts
// Test file: src/lib/__tests__/harmony-compliance.test.ts
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

export interface ComplianceResult {
  /** The (possibly corrected) prompt text */
  text: string;
  /** Whether any correction was applied */
  wasFixed: boolean;
  /** Human-readable description of what was fixed (for logging/transparency) */
  fixes: string[];
}

export interface ComplianceContext {
  /** Provider's weight syntax template, e.g., "{term}::{weight}" or "({term}:{weight})" */
  weightingSyntax: string | null | undefined;
  /** Whether the platform supports weighting */
  supportsWeighting: boolean;
  /** Provider display name (for fix descriptions) */
  providerName: string;
  /** Platform tier 1-4 */
  tier: number;
}

export interface MjComplianceResult extends ComplianceResult {
  /** Which MJ parameters were missing */
  missingParams: string[];
}

// ============================================================================
// T1 SYNTAX COMPLIANCE (B2 permanent fix)
// ============================================================================

/**
 * Detect whether prompt contains parenthetical weights: (term:1.3)
 * Matches: (word:1.4), (multi word phrase:1.2), (term:0.8)
 */
const PARENTHETICAL_WEIGHT_RE = /\([^()]+:\d+\.?\d*\)/;

/**
 * Detect whether prompt contains double-colon weights: term::1.3
 * Matches: word::1.4, multi word::1.2
 */
const DOUBLE_COLON_WEIGHT_RE = /\w+::\d+\.?\d*/;

/**
 * Convert parenthetical weights to double-colon weights.
 * (elderly samurai:1.4) → elderly samurai::1.4
 */
export function parentheticalToDoubleColon(prompt: string): string {
  return prompt.replace(
    /\(([^()]+):(\d+\.?\d*)\)/g,
    (_match, term: string, weight: string) => `${term.trim()}::${weight}`,
  );
}

/**
 * Convert double-colon weights to parenthetical weights.
 * elderly samurai::1.4 → (elderly samurai:1.4)
 *
 * Handles: "term::weight" where term can be multi-word.
 * Looks backwards from :: to find the term start (comma, start of string, or previous weight end).
 */
export function doubleColonToParenthetical(prompt: string): string {
  // Split on commas, process each segment
  return prompt
    .split(',')
    .map((segment) => {
      const trimmed = segment.trim();
      // Match "anything::number" pattern
      const match = trimmed.match(/^(.+?)::(\d+\.?\d*)(.*)$/);
      if (match) {
        const [, term, weight, rest] = match;
        return ` (${term?.trim()}:${weight})${rest ?? ''}`;
      }
      return segment;
    })
    .join(',')
    .trim();
}

/**
 * Strip ALL weight syntax from prompt (for providers that don't support weighting).
 * Removes both (term:1.3) → term and term::1.3 → term
 */
export function stripAllWeights(prompt: string): string {
  let result = prompt;
  // Remove parenthetical: (term:1.3) → term
  result = result.replace(/\(([^()]+):\d+\.?\d*\)/g, '$1');
  // Remove double-colon: term::1.3 → term
  result = result.replace(/::\d+\.?\d*/g, '');
  // Clean up any double spaces
  result = result.replace(/\s{2,}/g, ' ').trim();
  return result;
}

/**
 * P4: T1 Syntax Compliance Gate.
 *
 * Validates that T1 output uses the correct weight syntax for the selected provider.
 * If wrong syntax detected, converts it automatically.
 *
 * This is the PERMANENT fix for B2 — it doesn't matter if GPT ignores the
 * provider context, this function catches and corrects it 100% of the time.
 */
export function enforceT1Syntax(
  prompt: string,
  ctx: ComplianceContext,
): ComplianceResult {
  const fixes: string[] = [];
  let text = prompt;

  const isDoubleColonProvider = ctx.weightingSyntax?.includes('::') ?? false;
  const isParentheticalProvider = ctx.weightingSyntax?.includes('(') ?? false;

  if (!ctx.supportsWeighting) {
    // Provider doesn't support weighting — strip all weights
    const hasParenthetical = PARENTHETICAL_WEIGHT_RE.test(text);
    const hasDoubleColon = DOUBLE_COLON_WEIGHT_RE.test(text);
    if (hasParenthetical || hasDoubleColon) {
      text = stripAllWeights(text);
      fixes.push(`Stripped weight syntax — ${ctx.providerName} does not support weighting`);
    }
  } else if (isDoubleColonProvider) {
    // Provider expects double-colon (e.g., Leonardo)
    if (PARENTHETICAL_WEIGHT_RE.test(text)) {
      text = parentheticalToDoubleColon(text);
      fixes.push(`Converted parenthetical weights to double-colon for ${ctx.providerName}`);
    }
  } else if (isParentheticalProvider) {
    // Provider expects parenthetical (e.g., Stability AI)
    if (DOUBLE_COLON_WEIGHT_RE.test(text) && !PARENTHETICAL_WEIGHT_RE.test(text)) {
      text = doubleColonToParenthetical(text);
      fixes.push(`Converted double-colon weights to parenthetical for ${ctx.providerName}`);
    }
  }

  return { text, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// T2 MIDJOURNEY PARAMETER COMPLIANCE (B4 permanent fix)
// ============================================================================

const MJ_PARAM_PATTERNS = {
  ar: /--ar\s+\d+:\d+/,
  v: /--v\s+\d+/,
  s: /--s\s+\d+/,
  no: /--no\s+\S/,
} as const;

/**
 * P5: T2 Midjourney Parameter Compliance Gate.
 *
 * Handles BOTH problems in one function:
 * 1. DEDUP — GPT sometimes produces duplicate --ar/--v/--s/--no blocks
 * 2. ADD — GPT sometimes forgets --ar/--v/--s/--no entirely
 *
 * Execution order: dedup first → then check for missing → add if needed.
 * This means it catches duplicates even if P7 in the route didn't run.
 */
export function enforceMjParameters(
  prompt: string,
): MjComplianceResult {
  const fixes: string[] = [];
  const missingParams: string[] = [];
  let text = prompt;

  // ── STEP 1: DEDUP — collapse duplicate param blocks ────────────
  const paramStart = text.search(/\s--(?:ar|v|s|no)\s/);
  if (paramStart !== -1) {
    const prose = text.slice(0, paramStart).trimEnd();
    const paramSection = text.slice(paramStart);

    // Count occurrences of each param
    const arMatches = [...paramSection.matchAll(/--ar\s+(\d+:\d+)/g)];
    const vMatches = [...paramSection.matchAll(/--v\s+(\d+)/g)];
    const sMatches = [...paramSection.matchAll(/--s\s+(\d+)/g)];
    const noBlocks = [...paramSection.matchAll(/--no\s+([^-]+?)(?=\s+--|$)/g)];

    const hasDuplicates =
      arMatches.length > 1 || vMatches.length > 1 ||
      sMatches.length > 1 || noBlocks.length > 1;

    if (hasDuplicates) {
      // Keep last occurrence of --ar, --v, --s (usually more complete)
      const ar = arMatches.length > 0 ? arMatches[arMatches.length - 1]?.[1] ?? '' : '';
      const v = vMatches.length > 0 ? vMatches[vMatches.length - 1]?.[1] ?? '' : '';
      const s = sMatches.length > 0 ? sMatches[sMatches.length - 1]?.[1] ?? '' : '';

      // Merge ALL --no terms, deduplicate
      const allNoTerms: string[] = [];
      const seen = new Set<string>();
      for (const block of noBlocks) {
        const terms = (block[1] ?? '').split(',').map(t => t.trim()).filter(Boolean);
        for (const term of terms) {
          // Strip consecutive duplicate words within a term: "blurry blurry" → "blurry"
          const dedupedWords = term.split(/\s+/).reduce<string[]>((acc, word) => {
            if (acc.length === 0 || acc[acc.length - 1]!.toLowerCase() !== word.toLowerCase()) {
              acc.push(word);
            }
            return acc;
          }, []).join(' ');
          const lower = dedupedWords.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            allNoTerms.push(dedupedWords);
          }
        }
      }

      // Strip trailing punctuation from last --no term
      if (allNoTerms.length > 0) {
        const last = allNoTerms[allNoTerms.length - 1];
        if (last) {
          allNoTerms[allNoTerms.length - 1] = last.replace(/[.!?]+$/, '').trim();
        }
      }

      // Rebuild clean single block
      const parts = [prose];
      if (ar) parts.push(`--ar ${ar}`);
      if (v) parts.push(`--v ${v}`);
      if (s) parts.push(`--s ${s}`);
      if (allNoTerms.length > 0) parts.push(`--no ${allNoTerms.join(', ')}`);

      text = parts.join(' ');
      fixes.push(`Deduplicated MJ parameters (${arMatches.length} --ar, ${vMatches.length} --v, ${sMatches.length} --s, ${noBlocks.length} --no blocks → 1 each)`);
    }
  }

  // ── STEP 1b: DEDUP WITHIN --no — always runs ──────────────────────
  // GPT sometimes produces one --no block with every term listed twice:
  // --no blurry, text, watermark, blurry, text, watermark
  // Step 1 only catches multiple --no BLOCKS. This catches duplicate
  // TERMS within a single block.
  const noMatch = text.match(/--no\s+(.+)$/);
  if (noMatch && noMatch[1]) {
    const beforeNo = text.slice(0, text.indexOf('--no')).trimEnd();
    const rawTerms = noMatch[1].split(',').map(t => t.trim()).filter(Boolean);
    const seen = new Set<string>();
    const uniqueTerms: string[] = [];
    for (const term of rawTerms) {
      // Strip consecutive duplicate words: "blurry blurry" → "blurry"
      const dedupedWords = term.split(/\s+/).reduce<string[]>((acc, word) => {
        if (acc.length === 0 || acc[acc.length - 1]!.toLowerCase() !== word.toLowerCase()) {
          acc.push(word);
        }
        return acc;
      }, []).join(' ');
      const lower = dedupedWords.toLowerCase();
      if (lower && !seen.has(lower)) {
        seen.add(lower);
        uniqueTerms.push(dedupedWords);
      }
    }
    // Strip trailing punctuation from last term
    if (uniqueTerms.length > 0) {
      const last = uniqueTerms[uniqueTerms.length - 1];
      if (last) {
        uniqueTerms[uniqueTerms.length - 1] = last.replace(/[.!?]+$/, '').trim();
      }
    }

    // Detect fused terms: GPT sometimes concatenates list copies without commas,
    // creating "warped railing blurry" from "warped railing" + "blurry".
    // If a multi-word term ends with words that match a standalone term already
    // in the list, strip the suffix. If what remains is also already in the list,
    // the fused term is entirely redundant — remove it.
    const lowerSet = new Set(uniqueTerms.map(t => t.toLowerCase()));
    const fusionFixed: string[] = [];
    for (const term of uniqueTerms) {
      const words = term.split(/\s+/);
      if (words.length < 2) {
        fusionFixed.push(term);
        continue;
      }
      // Check if trailing 1 or 2 words match a standalone term in the list
      let wasFused = false;
      for (let suffixLen = 1; suffixLen <= Math.min(2, words.length - 1); suffixLen++) {
        const suffix = words.slice(-suffixLen).join(' ').toLowerCase();
        const prefix = words.slice(0, -suffixLen).join(' ').toLowerCase();
        if (lowerSet.has(suffix) && suffix !== term.toLowerCase()) {
          // The suffix is already a standalone term — this is a fusion
          if (lowerSet.has(prefix)) {
            // Both halves exist as standalone terms — entire term is redundant
            wasFused = true;
            break;
          } else {
            // Prefix is unique — keep it without the suffix
            fusionFixed.push(words.slice(0, -suffixLen).join(' '));
            wasFused = true;
            break;
          }
        }
      }
      if (!wasFused) {
        fusionFixed.push(term);
      }
    }

    // Final dedup after fusion cleanup (prefix might now match an existing term)
    const finalSeen = new Set<string>();
    const finalTerms: string[] = [];
    for (const term of fusionFixed) {
      const lower = term.toLowerCase();
      if (lower && !finalSeen.has(lower)) {
        finalSeen.add(lower);
        finalTerms.push(term);
      }
    }

    if (finalTerms.length < rawTerms.length) {
      text = `${beforeNo} --no ${finalTerms.join(', ')}`;
      fixes.push(`Deduplicated --no terms: ${rawTerms.length} → ${finalTerms.length}`);
    }
  }

  // ── STEP 2: ADD — check for missing params and append ──────────
  if (!MJ_PARAM_PATTERNS.ar.test(text)) {
    missingParams.push('--ar');
  }
  if (!MJ_PARAM_PATTERNS.v.test(text)) {
    missingParams.push('--v');
  }
  if (!MJ_PARAM_PATTERNS.s.test(text)) {
    missingParams.push('--s');
  }
  if (!MJ_PARAM_PATTERNS.no.test(text)) {
    missingParams.push('--no');
  }

  if (missingParams.length > 0) {
    const noIndex = text.indexOf('--no ');
    const defaults: string[] = [];
    if (missingParams.includes('--ar')) defaults.push('--ar 16:9');
    if (missingParams.includes('--v')) defaults.push('--v 7');
    if (missingParams.includes('--s')) defaults.push('--s 500');

    const paramBlock = defaults.join(' ');

    if (noIndex !== -1 && paramBlock) {
      const beforeNo = text.slice(0, noIndex).trimEnd();
      const noBlock = text.slice(noIndex);
      text = `${beforeNo} ${paramBlock} ${noBlock}`;
    } else if (paramBlock) {
      text = `${text.trimEnd()} ${paramBlock}`;
    }

    if (missingParams.includes('--no')) {
      text = `${text.trimEnd()} --no text, watermark, logo, blurry`;
      fixes.push('Added default --no block (scene-specific negatives recommended)');
    }

    if (defaults.length > 0) {
      fixes.push(`Added missing MJ parameters: ${defaults.join(', ')}`);
    }
  }

  return { text, wasFixed: fixes.length > 0, fixes, missingParams };
}

// ============================================================================
// CLIP WEIGHT CAP COMPLIANCE (Call 3 — SD CLIP group)
// ============================================================================
// CLIP encoders have a finite attention budget per 77-token chunk. When too
// many terms are weighted, the attention distribution flattens — nothing
// stands out. This gate enforces a maximum of `maxWeights` weighted terms.
//
// Strategy: parse all (term:weight) pairs, sort by weight ascending, strip
// parentheses+weight from the lowest-value terms until count ≤ max. The term
// text is KEPT (unweighted) so no visual content is lost — it just stops
// competing for the CLIP attention boost.
//
// Example: 13 weighted terms → cap at 8 → 5 lowest-weight terms become
// unweighted keywords. Subject and high-priority terms always survive.
// ============================================================================

/**
 * Enforce a maximum number of parenthetical-weighted terms.
 * Terms beyond the cap are unwrapped: (term:1.1) → term
 *
 * @param prompt - The CLIP prompt text
 * @param maxWeights - Maximum allowed weighted terms (default 8)
 * @returns ComplianceResult with fixes applied
 */
export function enforceWeightCap(
  prompt: string,
  maxWeights: number = 8,
): ComplianceResult {
  // Find all (term:weight) matches with their positions
  const weightPattern = /\(([^()]+):(\d+\.?\d*)\)/g;
  const matches: Array<{ full: string; term: string; weight: number; index: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = weightPattern.exec(prompt)) !== null) {
    matches.push({
      full: match[0],
      term: match[1]!.trim(),
      weight: parseFloat(match[2]!),
      index: match.index,
    });
  }

  if (matches.length <= maxWeights) {
    return { text: prompt, wasFixed: false, fixes: [] };
  }

  // Sort by weight ascending — lowest weights get stripped first
  const sorted = [...matches].sort((a, b) => a.weight - b.weight);
  const toStrip = sorted.slice(0, matches.length - maxWeights);
  const strippedTerms: string[] = [];

  let result = prompt;
  // Process in reverse order of string position to preserve indices
  const toStripByPosition = [...toStrip].sort((a, b) => b.index - a.index);
  for (const item of toStripByPosition) {
    result = result.slice(0, item.index) + item.term + result.slice(item.index + item.full.length);
    strippedTerms.push(`${item.term} (was :${item.weight})`);
  }

  return {
    text: result,
    wasFixed: true,
    fixes: [`Capped weighted terms: ${matches.length} → ${maxWeights}. Unweighted: ${strippedTerms.join(', ')}`],
  };
}

// ============================================================================
// CLIP KEYWORD CLEANUP COMPLIANCE (Call 3 — SD CLIP groups)
// ============================================================================
// CLIP encoders tokenise every word. Orphaned verbs ("stands", "reflecting",
// "leaving") and articles ("a", "the", "an") waste token budget because CLIP
// doesn't meaningfully process them — they push real visual terms into weaker
// chunks. GPT strips them ~80% of the time when told to, but code catches 100%.
//
// Only runs on keyword-style prompts (CLIP groups), NOT on natural language
// prompts where articles and verbs are grammatically required.
// ============================================================================

/** Orphaned verbs that commonly survive in CLIP keyword prompts.
 *  Only matches standalone comma-separated terms — not words inside phrases. */
const ORPHAN_VERB_TERMS = new Set([
  'stands', 'standing', 'sits', 'sitting', 'walks', 'walking',
  'reflects', 'reflecting', 'flows', 'flowing', 'glows', 'glowing',
  'falls', 'falling', 'rises', 'rising', 'leaves', 'leaving',
  'crashes', 'crashing', 'sends', 'sending', 'cuts', 'cutting',
  'grips', 'gripping', 'hangs', 'hanging', 'drifts', 'drifting',
  'hovers', 'hovering', 'shines', 'shining', 'burns', 'burning',
  'melts', 'melting', 'fades', 'fading', 'stretches', 'stretching',
]);

/**
 * Strip orphaned verbs and leading articles from CLIP keyword prompts.
 * Preserves verbs inside weighted phrases: (woman standing:1.3) → kept.
 * Only strips standalone comma-separated verb terms.
 *
 * @param prompt - CLIP-style keyword prompt
 * @returns ComplianceResult with stripped terms listed
 */
export function enforceClipKeywordCleanup(prompt: string): ComplianceResult {
  const fixes: string[] = [];

  // Split by commas, process each term
  const terms = prompt.split(',').map(t => t.trim()).filter(Boolean);
  const cleaned: string[] = [];
  const strippedVerbs: string[] = [];
  const strippedArticles: string[] = [];

  for (const term of terms) {
    // Skip weighted terms — don't touch (term:weight) or term::weight
    if (/\([^()]+:\d+\.?\d*\)/.test(term) || /\w+::\d+\.?\d*/.test(term)) {
      cleaned.push(term);
      continue;
    }

    const trimmed = term.trim();

    // Check if the entire term is a standalone orphan verb
    if (ORPHAN_VERB_TERMS.has(trimmed.toLowerCase())) {
      strippedVerbs.push(trimmed);
      continue;
    }

    // Strip leading articles from unweighted terms: "a lighthouse" → "lighthouse"
    const withoutArticle = trimmed.replace(/^(?:a|an|the)\s+/i, '');
    if (withoutArticle !== trimmed) {
      strippedArticles.push(`"${trimmed}" → "${withoutArticle}"`);
      cleaned.push(withoutArticle);
      continue;
    }

    cleaned.push(term);
  }

  if (strippedVerbs.length > 0) {
    fixes.push(`Stripped orphan verbs: ${strippedVerbs.join(', ')}`);
  }
  if (strippedArticles.length > 0) {
    fixes.push(`Stripped leading articles: ${strippedArticles.join(', ')}`);
  }

  const text = cleaned.join(', ');
  return { text, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// T4 META-LANGUAGE COMPLIANCE (T4 ban list permanent fix)
// ============================================================================

/** Banned T4 meta-language openers — GPT finds synonyms, so this list grows */
const T4_META_PATTERNS = [
  /\bthe scene has\b/i,
  /\bthe scene shows\b/i,
  /\bthe scene captures\b/i,
  /\bthe scene is\b/i,
  /\bfill the scene\b/i,
  /\bin this image\b/i,
  /\bthe composition shows\b/i,
] as const;

/** T4 self-correction pattern (belt-and-braces for P3) */
const T4_SELF_CORRECTION_RE = /\?\s*No[,—–\s]+it\s+(is|was)\b/i;

export interface T4ComplianceResult {
  /** Whether any meta-language was detected */
  hasMetaLanguage: boolean;
  /** Whether self-correction pattern was detected */
  hasSelfCorrection: boolean;
  /** Which patterns were found */
  patterns: string[];
}

/**
 * P6: T4 Meta-Language Detection.
 *
 * Does NOT auto-fix (meta-language replacement requires semantic understanding).
 * Instead, flags the issue for logging/transparency. Self-correction IS auto-fixed
 * by P3 in the post-processing pipeline. Meta-language openers are auto-fixed
 * by P8 in the post-processing pipeline.
 *
 * Used for: compliance reporting, regression testing, UI warnings.
 */
export function detectT4MetaLanguage(prompt: string): T4ComplianceResult {
  const patterns: string[] = [];

  for (const pattern of T4_META_PATTERNS) {
    if (pattern.test(prompt)) {
      const match = prompt.match(pattern);
      if (match) patterns.push(match[0]);
    }
  }

  const hasSelfCorrection = T4_SELF_CORRECTION_RE.test(prompt);
  if (hasSelfCorrection) {
    patterns.push('self-correction ("? No, it is...")');
  }

  return {
    hasMetaLanguage: patterns.length > 0,
    hasSelfCorrection,
    patterns,
  };
}

// ============================================================================
// T4 SENTENCE LENGTH COMPLIANCE (T4-4 detection)
// ============================================================================

/**
 * P9: Detect T4 sentences that fall below the 10-word minimum.
 *
 * Does NOT auto-fix (padding a sentence requires semantic understanding —
 * you can't just add filler words). Instead, flags for logging/transparency.
 * The primary fix is the system prompt rule (T4-4) strengthened by the
 * MANDATORY SCENE DEPTH rule (T4-5) which gives GPT enough content to
 * naturally exceed 10 words.
 *
 * @returns Array of sentences that have fewer than 10 words (empty = compliant)
 */
export function detectT4ShortSentences(prompt: string): string[] {
  const sentences = prompt
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .map((s) => s.trim());
  return sentences.filter((s) => s.split(/\s+/).length < 10);
}

// ============================================================================
// T3 BANNED PHRASE DETECTION
// ============================================================================

const T3_BANNED_PHRASES = [
  'rendered as',
  'in the style of',
  'should feel like',
  'meant to look like',
  'designed to resemble',
  'intended to appear as',
  'the image should',
  'the scene feels',
  'the scene is',
  'the mood is',
  'that feels',
] as const;

/**
 * Detect banned T3 directive phrases.
 * Returns the list of found phrases (empty = compliant).
 */
export function detectT3BannedPhrases(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  return T3_BANNED_PHRASES.filter((phrase) => lower.includes(phrase));
}

// ============================================================================
// FULL COMPLIANCE CHECK (all tiers)
// ============================================================================

export interface FullComplianceReport {
  tier1: ComplianceResult;
  tier2: MjComplianceResult;
  tier3: { bannedPhrases: string[] };
  tier4: T4ComplianceResult & { shortSentences: string[] };
  /** Overall pass/fail */
  allPassing: boolean;
  /** Total fixes applied */
  totalFixes: number;
}

/**
 * Run full compliance check across all 4 tiers.
 * Applies automatic fixes where possible, flags issues where not.
 *
 * @param tiers - The 4 tier positive prompts
 * @param ctx - Provider context (null = generic, skip provider-specific checks)
 */
export function runFullCompliance(
  tiers: { tier1: string; tier2: string; tier3: string; tier4: string },
  ctx: ComplianceContext | null,
): FullComplianceReport {
  // T1: syntax compliance (only when provider is known)
  const tier1 = ctx
    ? enforceT1Syntax(tiers.tier1, ctx)
    : { text: tiers.tier1, wasFixed: false, fixes: [] };

  // T2: MJ parameter compliance (always)
  const tier2 = enforceMjParameters(tiers.tier2);

  // T3: banned phrase detection (flag only)
  const tier3 = { bannedPhrases: detectT3BannedPhrases(tiers.tier3) };

  // T4: meta-language detection (flag only; P3 handles self-correction, P8 handles openers)
  const tier4Meta = detectT4MetaLanguage(tiers.tier4);
  // T4: sentence length detection (P9 — flag only)
  const shortSentences = detectT4ShortSentences(tiers.tier4);
  const tier4 = { ...tier4Meta, shortSentences };

  const totalFixes = tier1.fixes.length + tier2.fixes.length;
  const allPassing =
    !tier1.wasFixed &&
    !tier2.wasFixed &&
    tier3.bannedPhrases.length === 0 &&
    !tier4.hasMetaLanguage &&
    !tier4.hasSelfCorrection &&
    shortSentences.length === 0;

  return { tier1, tier2, tier3, tier4, allPassing, totalFixes };
}

// ============================================================================
// RULE CEILING TRACKING
// ============================================================================

/**
 * Current system prompt rule inventory.
 * Updated manually when rules are added/removed.
 * Used by regression tests to enforce the rule ceiling.
 *
 * RULE CEILING: 30 rules maximum (current count).
 * To add a new rule, you MUST either:
 * 1. Replace an existing rule, OR
 * 2. Build the fix as post-processing code instead, OR
 * 3. Get explicit approval to raise the ceiling (with justification)
 *
 * Rationale: GPT's attention budget is finite. After ~18 rules, each new
 * rule competes with existing rules for attention. The harmony doc's own
 * data shows diminishing returns past this point.
 *
 * v2: Ceiling raised from 27 → 30 (Martin-approved, 25 Mar 2026).
 * +T1-8 (cluster merge), +T3-5 (opening diversity), +T4-5 (scene depth).
 * Fix 2 (T1-4 sensory terms) strengthens existing rule, not a new rule.
 * Fix 5 (P8 meta-opener auto-fix) and Fix 6 (P9 short sentence detection)
 * are post-processing code, not system prompt rules.
 */
export const RULE_CEILING = 30;
export const CURRENT_RULE_COUNT = 30;

export const RULE_INVENTORY = {
  // Tier-specific rules (embedded in tier sections)
  tier1: ['T1-1 syntax', 'T1-2 subject weight', 'T1-3 colour pairing', 'T1-4 literal language + sensory', 'T1-5 composition', 'T1-6 ordering', 'T1-7 no punctuation', 'T1-8 semantic clustering'],
  tier2: ['T2-1 subject weight', 'T2-2 clause placement', 'T2-3 no flag', 'T2-4 scene negatives', 'T2-5 abstract-to-visual', 'T2-6 mandatory params'],
  tier3: ['T3-1 no paraphrase', 'T3-2 banned phrases', 'T3-3 composition cue', 'T3-4 mood preservation', 'T3-5 opening diversity'],
  tier4: ['T4-1 explicit setting', 'T4-2 no self-correction', 'T4-3 meta-language ban', 'T4-4 sentence minimum', 'T4-5 scene depth'],
  // Global rules (in Rules section)
  global: ['G1 preserve intent', 'G2 expert value-add', 'G3 native per tier', 'G4 weight hierarchy', 'G5 provider syntax', 'G6 abstract-to-visual'],
} as const;
