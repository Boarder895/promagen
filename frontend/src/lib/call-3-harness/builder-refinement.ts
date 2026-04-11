// src/lib/call-3-harness/builder-refinement.ts
// ============================================================================
// PHASE 7 — Builder Refinement Tooling
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §9.2 Phase 3
// Build plan:   call-3-quality-build-plan-v1.md §11
//
// Two utilities for Phase 7 builder refinement:
//
//   1. generateSurgicalTemplate() — Creates a system prompt scaffold from
//      a platform's DNA profile. The template lists exactly which transforms
//      GPT is allowed to perform and bans everything else.
//
//   2. validateBuilderPrompt() — Checks whether a builder system prompt
//      follows the surgical transform rules. Catches common violations:
//      unlisted transforms, missing bans, composition scaffolding, etc.
//
// These are dev-time utilities, not production code. Used during the
// harmony pass to ensure builder consistency.
// ============================================================================

import type { PlatformDNA, TransformId } from '@/data/platform-dna/types';

// ============================================================================
// TYPES
// ============================================================================

/** Result of validating a builder system prompt. */
export interface BuilderValidationResult {
  /** Whether the prompt passes all checks */
  readonly passed: boolean;
  /** Overall quality score (0–100) */
  readonly score: number;
  /** Individual check results */
  readonly checks: readonly BuilderCheck[];
  /** Suggestions for improvement */
  readonly suggestions: readonly string[];
}

/** A single validation check. */
export interface BuilderCheck {
  /** Check name */
  readonly name: string;
  /** Whether this check passed */
  readonly passed: boolean;
  /** Human-readable explanation */
  readonly detail: string;
  /** How much this check affects the score (0–20) */
  readonly weight: number;
}

// ============================================================================
// TRANSFORM DESCRIPTIONS — Human-readable names for template generation
// ============================================================================

const TRANSFORM_DESCRIPTIONS: Record<TransformId, string> = {
  T_SUBJECT_FRONT: 'Move the primary subject to the first 15 tokens of the prompt',
  T_ATTENTION_SEQUENCE: 'Reorder anchor phrases by visual importance (AVIS score)',
  T_WEIGHT_REBALANCE: 'Rebalance weight values: subject highest, atmosphere/style lowest',
  T_TOKEN_MERGE: 'Merge fragmented single-word segments into compound phrases',
  T_SEMANTIC_COMPRESS: 'Compress redundant modifier pairs to save tokens',
  T_REDUNDANCY_STRIP: 'Remove duplicate or near-duplicate segments',
  T_QUALITY_POSITION: 'Move quality tags (masterpiece, 8k) to optimal positions',
  T_PARAM_VALIDATE: 'Validate and normalise platform parameters',
  T_WEIGHT_VALIDATE: 'Validate weight syntax values and distribution',
  T_CLAUSE_FRONT: 'Move the subject clause to position 0 in multi-clause structure',
  T_SCENE_PREMISE: 'Ensure first sentence establishes the scene (who + where + action)',
  T_PROSE_RESTRUCTURE: 'Restructure prose for platform-optimal sentence flow',
  T_NARRATIVE_ARMOUR: 'Protect narrative structure from GPT flattening',
  T_NEGATIVE_GENERATE: 'Generate platform-appropriate negative prompt',
  T_CHAR_ENFORCE: 'Enforce character ceiling — trim from end if over limit',
  T_SYNTAX_CLEANUP: 'Clean up platform-specific syntax issues',
};

/** Transforms that GPT performs (not deterministic code). */
const GPT_TRANSFORM_IDS: ReadonlySet<TransformId> = new Set([
  'T_PROSE_RESTRUCTURE',
  'T_NARRATIVE_ARMOUR',
  'T_NEGATIVE_GENERATE',
]);

// ============================================================================
// SURGICAL PROMPT TEMPLATE GENERATOR
// ============================================================================

/**
 * Generate a surgical system prompt template from a DNA profile.
 *
 * The template follows the Phase 7 approach (build plan §11.2):
 *   - Lists exactly which transforms GPT should perform
 *   - Bans composition scaffolding, invented content, synonym churn
 *   - Includes WRONG/RIGHT example placeholders
 *   - Front-loads RULE ZERO (anchor preservation)
 *
 * The generated template is a STARTING POINT — it needs:
 *   - Platform-specific WRONG/RIGHT examples filled in
 *   - Playground testing (gpt-5.4-mini, json_object, reasoning effort medium)
 *   - Martin's approval
 *
 * @param dna      Platform DNA profile
 * @param platform Human-readable platform name
 * @returns        System prompt template string
 */
export function generateSurgicalTemplate(
  dna: PlatformDNA,
  platform: string,
): string {
  const gptTransforms = dna.allowedTransforms.filter((t) => GPT_TRANSFORM_IDS.has(t));
  const detTransforms = dna.allowedTransforms.filter((t) => !GPT_TRANSFORM_IDS.has(t));

  const lines: string[] = [];

  // ── Header ─────────────────────────────────────────────────────────
  lines.push(`You optimise image prompts for ${platform}.`);
  lines.push('');

  // ── RULE ZERO ──────────────────────────────────────────────────────
  lines.push('RULE ZERO — ANCHOR PRESERVATION');
  lines.push('Every visual anchor from the input MUST appear in your output.');
  lines.push('If a subject, colour, light source, or texture is in the input, it MUST be in the output.');
  lines.push('Do NOT invent new subjects, light sources, actions, or locations.');
  lines.push('Do NOT use composition scaffolding (foreground/midground/background).');
  lines.push('Do NOT substitute synonyms for specific visual terms.');
  lines.push('');

  // ── YOUR TASKS ─────────────────────────────────────────────────────
  lines.push('YOUR TASKS (do ONLY these, nothing else):');

  for (const t of gptTransforms) {
    const desc = TRANSFORM_DESCRIPTIONS[t] ?? t;
    lines.push(`  ${t}: ${desc}`);
  }

  lines.push('');

  // ── ALREADY HANDLED BY CODE ────────────────────────────────────────
  if (detTransforms.length > 0) {
    lines.push('ALREADY HANDLED BY CODE (do NOT attempt these):');
    for (const t of detTransforms) {
      const desc = TRANSFORM_DESCRIPTIONS[t] ?? t;
      lines.push(`  ${t}: ${desc}`);
    }
    lines.push('');
  }

  // ── BANNED BEHAVIOURS ──────────────────────────────────────────────
  lines.push('BANNED:');
  lines.push('- Adding subjects, objects, or scene elements not in the input');
  lines.push('- Composition scaffolding (foreground/midground/background/layers)');
  lines.push('- Thesaurus-style synonym substitution');
  lines.push('- Meta-language ("captures the essence", "evokes a sense of")');
  lines.push('- Shortening the prompt unless it exceeds the character limit');
  lines.push('- Changing the meaning, mood, or visual intent');
  lines.push('');

  // ── PLATFORM CONSTRAINTS ───────────────────────────────────────────
  lines.push('PLATFORM CONSTRAINTS:');
  lines.push(`  Encoder: ${dna.encoderFamily}`);
  lines.push(`  Style: ${dna.promptStylePreference}`);
  lines.push(`  Character ceiling: ${dna.charCeiling}`);
  if (dna.tokenLimit) lines.push(`  Token limit: ${dna.tokenLimit}`);
  lines.push(`  Negative support: ${dna.negativeMode}`);
  if (dna.syntaxMode !== 'none') lines.push(`  Weight syntax: ${dna.syntaxMode}`);
  lines.push('');

  // ── KNOWN FAILURE MODES ────────────────────────────────────────────
  if (dna.knownFailureModes.length > 0) {
    lines.push('WATCH FOR THESE KNOWN FAILURE MODES:');
    for (const fm of dna.knownFailureModes) {
      lines.push(`  - ${fm}`);
    }
    lines.push('');
  }

  // ── WRONG/RIGHT EXAMPLES ───────────────────────────────────────────
  lines.push('WRONG/RIGHT EXAMPLES:');
  lines.push('  [TODO: Add 2-3 platform-specific examples from Playground testing]');
  lines.push('  WRONG: "A dramatic scene featuring a majestic lighthouse keeper..."');
  lines.push('  RIGHT: "A weathered lighthouse keeper stands on a rain-soaked cliff..."');
  lines.push('');

  // ── OUTPUT FORMAT ──────────────────────────────────────────────────
  lines.push('OUTPUT: JSON object with fields: optimised (string), negative (string or null), changes (string[]), charCount (number).');
  lines.push('PRE-FLIGHT CHECK: Before returning, verify every anchor from the input appears in your output.');

  return lines.join('\n');
}

// ============================================================================
// BUILDER PROMPT VALIDATION
// ============================================================================

/**
 * Validate a builder system prompt against the surgical transform rules.
 *
 * Checks:
 *   1. RULE ZERO — mentions anchor preservation
 *   2. BANNED — explicitly bans composition scaffolding + invented content
 *   3. TRANSFORMS — lists only the allowed transforms from DNA
 *   4. PRE-FLIGHT — includes a pre-return verification step
 *   5. OUTPUT FORMAT — mentions JSON output shape
 *   6. NO META-LANGUAGE — doesn't itself use banned patterns
 *   7. PLATFORM CONSTRAINTS — mentions encoder/syntax/ceiling
 *
 * @param prompt   The builder system prompt to validate
 * @param dna      The platform's DNA profile
 * @returns        Validation result with score and checks
 */
export function validateBuilderPrompt(
  prompt: string,
  dna: PlatformDNA,
): BuilderValidationResult {
  const lower = prompt.toLowerCase();
  const checks: BuilderCheck[] = [];
  const suggestions: string[] = [];

  // ── Check 1: Anchor preservation ───────────────────────────────────
  const hasAnchorRule = lower.includes('anchor') && (
    lower.includes('preserv') || lower.includes('must appear') || lower.includes('every')
  );
  checks.push({
    name: 'anchor_preservation',
    passed: hasAnchorRule,
    detail: hasAnchorRule
      ? 'Anchor preservation rule found'
      : 'Missing explicit anchor preservation rule (RULE ZERO)',
    weight: 20,
  });
  if (!hasAnchorRule) suggestions.push('Add RULE ZERO: "Every visual anchor from the input MUST appear in your output"');

  // ── Check 2: Banned behaviours ─────────────────────────────────────
  const bansScaffolding = lower.includes('foreground') || lower.includes('scaffolding') || lower.includes('composition scaffolding');
  const bansInvention = lower.includes('do not invent') || lower.includes('do not add') || lower.includes('banned');
  const hasBans = bansScaffolding || bansInvention;
  checks.push({
    name: 'banned_behaviours',
    passed: hasBans,
    detail: hasBans
      ? 'Banned behaviour rules found'
      : 'Missing explicit bans on composition scaffolding and invented content',
    weight: 15,
  });
  if (!hasBans) suggestions.push('Add BANNED section: no scaffolding, no invented content, no synonym churn');

  // ── Check 3: Transform listing ─────────────────────────────────────
  const gptTransforms = dna.allowedTransforms.filter((t) => GPT_TRANSFORM_IDS.has(t));
  const mentionsTransforms = gptTransforms.some((t) => lower.includes(t.toLowerCase()));
  checks.push({
    name: 'transform_listing',
    passed: mentionsTransforms || gptTransforms.length === 0,
    detail: mentionsTransforms
      ? 'GPT transforms are listed'
      : gptTransforms.length === 0
        ? 'No GPT transforms for this platform (deterministic only)'
        : `Missing transform listing — expected: ${gptTransforms.join(', ')}`,
    weight: 15,
  });
  if (!mentionsTransforms && gptTransforms.length > 0) {
    suggestions.push(`List exactly which transforms GPT should perform: ${gptTransforms.join(', ')}`);
  }

  // ── Check 4: Pre-flight verification ───────────────────────────────
  const hasPreFlight = lower.includes('pre-flight') || lower.includes('preflight') || lower.includes('before returning') || lower.includes('verify');
  checks.push({
    name: 'preflight_check',
    passed: hasPreFlight,
    detail: hasPreFlight
      ? 'Pre-flight verification step found'
      : 'Missing pre-return anchor verification step',
    weight: 10,
  });
  if (!hasPreFlight) suggestions.push('Add: "PRE-FLIGHT CHECK: Before returning, verify every anchor from the input appears in your output"');

  // ── Check 5: JSON output format ────────────────────────────────────
  const hasOutputFormat = lower.includes('json') && (lower.includes('optimised') || lower.includes('output'));
  checks.push({
    name: 'output_format',
    passed: hasOutputFormat,
    detail: hasOutputFormat
      ? 'JSON output format specified'
      : 'Missing JSON output format specification',
    weight: 10,
  });
  if (!hasOutputFormat) suggestions.push('Specify output format: JSON with optimised, negative, changes, charCount');

  // ── Check 6: No meta-language in the prompt itself ─────────────────
  const metaPatterns = [
    'captures the essence',
    'evokes a sense',
    'breathes life into',
    'paints a picture',
    'brings to mind',
  ];
  const usesMetaLanguage = metaPatterns.some((p) => lower.includes(p));
  checks.push({
    name: 'no_meta_language',
    passed: !usesMetaLanguage,
    detail: usesMetaLanguage
      ? 'System prompt itself uses banned meta-language patterns'
      : 'No meta-language detected in system prompt',
    weight: 10,
  });
  if (usesMetaLanguage) suggestions.push('Remove meta-language from the system prompt itself');

  // ── Check 7: Platform constraints ──────────────────────────────────
  const hasPlatformConstraints =
    lower.includes(dna.encoderFamily) ||
    lower.includes(String(dna.charCeiling)) ||
    lower.includes('character') ||
    lower.includes('limit');
  checks.push({
    name: 'platform_constraints',
    passed: hasPlatformConstraints,
    detail: hasPlatformConstraints
      ? 'Platform constraints referenced'
      : 'Missing platform-specific constraints (encoder, ceiling, syntax)',
    weight: 10,
  });
  if (!hasPlatformConstraints) suggestions.push(`Add platform constraints: encoder=${dna.encoderFamily}, ceiling=${dna.charCeiling}`);

  // ── Check 8: WRONG/RIGHT examples ──────────────────────────────────
  const hasExamples = lower.includes('wrong') && lower.includes('right');
  checks.push({
    name: 'wrong_right_examples',
    passed: hasExamples,
    detail: hasExamples
      ? 'WRONG/RIGHT examples included'
      : 'Missing WRONG/RIGHT examples — add 2-3 per-platform examples',
    weight: 10,
  });
  if (!hasExamples) suggestions.push('Add 2-3 WRONG/RIGHT examples from Playground testing');

  // ── Compute score ──────────────────────────────────────────────────
  const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedScore = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = Math.round((earnedScore / maxScore) * 100);

  return {
    passed: score >= 80,
    score,
    checks,
    suggestions,
  };
}
