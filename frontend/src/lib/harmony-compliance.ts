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
 * Validates that --ar, --v, --s, --no are all present in T2 output.
 * If missing, appends sensible defaults.
 *
 * This is the PERMANENT fix for B4 — GPT can forget parameters,
 * this function ensures they're always present.
 */
export function enforceMjParameters(
  prompt: string,
): MjComplianceResult {
  const fixes: string[] = [];
  const missingParams: string[] = [];
  let text = prompt;

  // Check each required parameter
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
    // Find insertion point — before --no if it exists, or at end
    const noIndex = text.indexOf('--no ');

    // Build defaults for missing params
    const defaults: string[] = [];
    if (missingParams.includes('--ar')) defaults.push('--ar 16:9');
    if (missingParams.includes('--v')) defaults.push('--v 7');
    if (missingParams.includes('--s')) defaults.push('--s 500');

    const paramBlock = defaults.join(' ');

    if (noIndex !== -1 && paramBlock) {
      // Insert before --no
      const beforeNo = text.slice(0, noIndex).trimEnd();
      const noBlock = text.slice(noIndex);
      text = `${beforeNo} ${paramBlock} ${noBlock}`;
    } else if (paramBlock) {
      // Append at end
      text = `${text.trimEnd()} ${paramBlock}`;
    }

    if (missingParams.includes('--no')) {
      // Append generic --no if missing entirely
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
 * by P3 in the post-processing pipeline.
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
  tier4: T4ComplianceResult;
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

  // T4: meta-language detection (flag only; P3 handles self-correction)
  const tier4 = detectT4MetaLanguage(tiers.tier4);

  const totalFixes = tier1.fixes.length + tier2.fixes.length;
  const allPassing =
    !tier1.wasFixed &&
    !tier2.wasFixed &&
    tier3.bannedPhrases.length === 0 &&
    !tier4.hasMetaLanguage &&
    !tier4.hasSelfCorrection;

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
 * RULE CEILING: 22 rules maximum (current count).
 * To add a new rule, you MUST either:
 * 1. Replace an existing rule, OR
 * 2. Build the fix as post-processing code instead, OR
 * 3. Get explicit approval to raise the ceiling (with justification)
 *
 * Rationale: GPT's attention budget is finite. After ~18 rules, each new
 * rule competes with existing rules for attention. The harmony doc's own
 * data shows diminishing returns past this point.
 */
export const RULE_CEILING = 27;
export const CURRENT_RULE_COUNT = 27;

export const RULE_INVENTORY = {
  // Tier-specific rules (embedded in tier sections)
  tier1: ['T1-1 syntax', 'T1-2 subject weight', 'T1-3 colour pairing', 'T1-4 literal language', 'T1-5 composition', 'T1-6 ordering', 'T1-7 no punctuation'],
  tier2: ['T2-1 subject weight', 'T2-2 clause placement', 'T2-3 no flag', 'T2-4 scene negatives', 'T2-5 abstract-to-visual', 'T2-6 mandatory params'],
  tier3: ['T3-1 no paraphrase', 'T3-2 banned phrases', 'T3-3 composition cue', 'T3-4 mood preservation'],
  tier4: ['T4-1 explicit setting', 'T4-2 no self-correction', 'T4-3 meta-language ban', 'T4-4 sentence minimum'],
  // Global rules (in Rules section)
  global: ['G1 preserve intent', 'G2 expert value-add', 'G3 native per tier', 'G4 weight hierarchy', 'G5 provider syntax', 'G6 abstract-to-visual'],
} as const;
