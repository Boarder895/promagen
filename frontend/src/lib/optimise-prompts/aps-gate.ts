// src/lib/optimise-prompts/aps-gate.ts
// ============================================================================
// ANCHOR PRESERVATION SCORE (APS) — Primary quality gate + 3 vetoes
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §6
// Build plan:   call-3-quality-build-plan-v1.md §6 (Phase 2)
//
// The APS is the primary quantitative gate for accepting or rejecting Call 3
// output. It replaces anchor-diff-gate.ts as the first-line rejection
// mechanism. The existing 8-check regression guard stays as the secondary
// safety net.
//
// Three components:
//   1. APS score — weighted anchor preservation ratio (0.0–1.0)
//   2. Threshold verdict — ACCEPT / ACCEPT_WITH_WARNING / RETRY / REJECT
//   3. Three vetoes — can override any APS-based verdict to REJECT
//
// Order of execution (architecture §6.4):
//   GPT output → APS score → Vetoes → [if pass] → Regression guard → Ship
//                                     [if fail] → Retry or fallback
//
// The APS gate is a strict superset of anchor-diff-gate. Every failure that
// anchor-diff-gate caught, the APS gate catches — plus prose quality
// degradation and invented content injection.
// ============================================================================

import type { AnchorManifest } from './preflight';
import { extractAnchors } from './preflight';
import {
  detectInventedLabels,
  detectMechanicalCompositionLanguage,
  detectTextbookPromptLanguage,
  detectRedundantPhraseReuse,
} from './regression-guard';

// ============================================================================
// TYPES
// ============================================================================

/** Severity classification for anchor preservation weighting. */
export type AnchorSeverity = 'critical' | 'important' | 'optional';

/** Severity weight mapping — architecture §6.1. */
const SEVERITY_WEIGHTS: Record<AnchorSeverity, number> = {
  critical: 3,
  important: 2,
  optional: 1,
} as const;

/** APS verdict — maps to threshold bands in architecture §6.2. */
export type APSVerdict = 'ACCEPT' | 'ACCEPT_WITH_WARNING' | 'RETRY' | 'REJECT';

/** Tracking record for a single anchor's survival status. */
export interface AnchorSurvival {
  /** The anchor text (colour name, environment noun, verb, subject phrase, etc.) */
  readonly anchor: string;
  /** Which category this anchor belongs to */
  readonly category: 'subject' | 'colour' | 'light_source' | 'environment' | 'action_verb';
  /** Severity classification — determines weight in APS formula */
  readonly severity: AnchorSeverity;
  /** Severity weight (3 = critical, 2 = important, 1 = optional) */
  readonly weight: number;
  /** Whether this anchor was found in the output text */
  readonly survived: boolean;
}

/** Complete result from the APS gate evaluation. */
export interface APSResult {
  /**
   * Weighted preservation score (0.0–1.0).
   * Formula: Σ(surviving_anchors × weight) / Σ(all_anchors × weight)
   */
  readonly score: number;

  /** Threshold-based verdict, potentially overridden by vetoes. */
  readonly verdict: APSVerdict;

  /**
   * The verdict before any veto overrides.
   * Useful for diagnostics: shows what APS score alone would have decided.
   */
  readonly scoreVerdict: APSVerdict;

  /** Veto 1: any critical anchor (weight 3) missing from output. */
  readonly criticalAnchorVeto: boolean;

  /** Veto 2: visual elements in output not present in input. */
  readonly inventedContentVeto: boolean;

  /** Veto 3: composition scaffold, textbook language, or redundant phrases. */
  readonly proseQualityVeto: boolean;

  /** Whether any veto fired (convenience flag). */
  readonly anyVetoFired: boolean;

  /** All anchors that survived in the output. */
  readonly survivingAnchors: readonly AnchorSurvival[];

  /** All anchors that were lost in the output. */
  readonly droppedAnchors: readonly AnchorSurvival[];

  /** Visual elements found in output that were not in input (Veto 2 detail). */
  readonly inventedContent: readonly string[];

  /** Prose quality issues found (Veto 3 detail). */
  readonly proseIssues: readonly string[];
}

// ============================================================================
// THRESHOLD CONSTANTS — Architecture §6.2
// ============================================================================

/** APS ≥ 0.95 — clean accept, all anchors preserved or near-perfect. */
const THRESHOLD_ACCEPT = 0.95;

/** APS 0.88–0.94 — accept with secondary checks (vetoes must pass). */
const THRESHOLD_ACCEPT_WITH_WARNING = 0.88;

/** APS 0.78–0.87 — retry band (if retry enabled for platform). */
const THRESHOLD_RETRY = 0.78;

/** APS < 0.78 — hard reject, fallback to assembled prompt. */
// Below THRESHOLD_RETRY = REJECT

// ============================================================================
// TEXT NORMALISATION
// ============================================================================

const ARTICLES = new Set(['a', 'an', 'the', 'one', 'of', 'in', 'on', 'at', 'to', 'and']);

/**
 * Normalise text for anchor comparison.
 * Strips weight syntax, lowercases, collapses whitespace.
 * Same normalisation approach as anchor-diff-gate.ts for consistency.
 */
function normaliseForComparison(text: string): string {
  return text
    .toLowerCase()
    // Strip parenthetical weights: (term:1.3)
    .replace(/\([^()]+:\d+\.?\d*\)/g, (match) =>
      match.replace(/[():]/g, '').replace(/\d+\.?\d*/g, '').trim(),
    )
    // Strip double-colon weights: term::1.3
    .replace(/\w[\w\s-]*::\d+\.?\d*/g, (match) => match.replace(/::\d+\.?\d*/g, ''))
    // Strip parameter flags: --ar 16:9
    .replace(/\s*--\w+\s*[^\s,]*/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// ANCHOR SURVIVAL CHECK
// ============================================================================

/**
 * Check whether a single anchor text survives in the normalised output.
 * Uses case-insensitive substring matching.
 */
function anchorSurvives(anchor: string, normalisedOutput: string): boolean {
  const normalisedAnchor = anchor.toLowerCase().trim();
  if (normalisedAnchor.length === 0) return true;
  return normalisedOutput.includes(normalisedAnchor);
}

/**
 * Check whether the subject phrase survives.
 *
 * More nuanced than simple substring: extracts significant words (>2 chars,
 * not articles) and requires ALL of them to appear in the output. The subject
 * is the most important anchor — partial survival is not acceptable.
 *
 * "A weathered lighthouse keeper" → checks "weathered", "lighthouse", "keeper"
 * all appear somewhere in the output.
 */
function subjectSurvives(subjectPhrase: string, normalisedOutput: string): boolean {
  const words = subjectPhrase
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !ARTICLES.has(w));

  if (words.length === 0) return true;

  return words.every((w) => normalisedOutput.includes(w));
}

// ============================================================================
// ANCHOR MANIFEST → SURVIVAL LIST
// ============================================================================

/**
 * Build the anchor survival list from an AnchorManifest.
 *
 * Severity assignments (architecture §6.1):
 *   Critical (weight 3): subject, primary action verb, named colours
 *   Important (weight 2): environment nouns, light sources
 *   Optional  (weight 1): (not currently tracked in AnchorManifest)
 *
 * Each anchor in the manifest becomes an AnchorSurvival entry with
 * its survival status checked against the output text.
 */
function buildSurvivalList(
  inputAnchors: AnchorManifest,
  normalisedOutput: string,
): AnchorSurvival[] {
  const results: AnchorSurvival[] = [];

  // ── Subject (critical) ──────────────────────────────────────────
  if (inputAnchors.subjectPhrase) {
    results.push({
      anchor: inputAnchors.subjectPhrase,
      category: 'subject',
      severity: 'critical',
      weight: SEVERITY_WEIGHTS.critical,
      survived: subjectSurvives(inputAnchors.subjectPhrase, normalisedOutput),
    });
  }

  // ── Action verbs (critical for primary, important for secondary) ─
  for (let i = 0; i < inputAnchors.actionVerbs.length; i++) {
    const verb = inputAnchors.actionVerbs[i]!;
    const isPrimary = i === 0;
    results.push({
      anchor: verb,
      category: 'action_verb',
      severity: isPrimary ? 'critical' : 'important',
      weight: SEVERITY_WEIGHTS[isPrimary ? 'critical' : 'important'],
      survived: anchorSurvives(verb, normalisedOutput),
    });
  }

  // ── Named colours (critical) ────────────────────────────────────
  for (const colour of inputAnchors.colours) {
    results.push({
      anchor: colour,
      category: 'colour',
      severity: 'critical',
      weight: SEVERITY_WEIGHTS.critical,
      survived: anchorSurvives(colour, normalisedOutput),
    });
  }

  // ── Environment nouns (important) ───────────────────────────────
  for (const noun of inputAnchors.environmentNouns) {
    results.push({
      anchor: noun,
      category: 'environment',
      severity: 'important',
      weight: SEVERITY_WEIGHTS.important,
      survived: anchorSurvives(noun, normalisedOutput),
    });
  }

  // ── Light sources (important) ───────────────────────────────────
  for (const light of inputAnchors.lightSources) {
    results.push({
      anchor: light,
      category: 'light_source',
      severity: 'important',
      weight: SEVERITY_WEIGHTS.important,
      survived: anchorSurvives(light, normalisedOutput),
    });
  }

  return results;
}

// ============================================================================
// APS SCORE COMPUTATION
// ============================================================================

/**
 * Compute the weighted APS score from the survival list.
 *
 * Formula (architecture §6.1):
 *   APS = Σ(surviving_anchors × severity_weight) / Σ(all_anchors × severity_weight)
 *
 * Returns 1.0 if no anchors were tracked (edge case: very minimal prompt).
 */
function computeScore(survivalList: readonly AnchorSurvival[]): number {
  if (survivalList.length === 0) return 1.0;

  let totalWeight = 0;
  let survivingWeight = 0;

  for (const entry of survivalList) {
    totalWeight += entry.weight;
    if (entry.survived) {
      survivingWeight += entry.weight;
    }
  }

  if (totalWeight === 0) return 1.0;
  return survivingWeight / totalWeight;
}

/**
 * Map APS score to threshold-based verdict (architecture §6.2).
 */
function scoreToVerdict(score: number): APSVerdict {
  if (score >= THRESHOLD_ACCEPT) return 'ACCEPT';
  if (score >= THRESHOLD_ACCEPT_WITH_WARNING) return 'ACCEPT_WITH_WARNING';
  if (score >= THRESHOLD_RETRY) return 'RETRY';
  return 'REJECT';
}

// ============================================================================
// VETO CHECKS — Architecture §6.3
// ============================================================================

/**
 * Veto 1 — Critical Anchor Loss (architecture §6.3).
 *
 * If ANY anchor with severity 'critical' (weight 3) is missing from the
 * output, reject regardless of APS score. A prompt missing its subject
 * is broken even if it preserved 8 of 9 other anchors.
 */
function checkCriticalAnchorVeto(survivalList: readonly AnchorSurvival[]): boolean {
  return survivalList.some(
    (entry) => entry.severity === 'critical' && !entry.survived,
  );
}

/**
 * Veto 2 — Invented Content Injection (architecture §6.3).
 *
 * If the output contains named visual elements not present in the input
 * and not part of a platform-appropriate quality prefix, reject.
 * GPT inventing content is the most common degradation mode.
 *
 * Uses the existing regression guard's invented-content detector for
 * style/framing labels, plus anchor-diff for invented visual anchors.
 */
function checkInventedContentVeto(
  inputText: string,
  outputText: string,
  inputAnchors: AnchorManifest,
  outputAnchors: AnchorManifest,
): string[] {
  const invented: string[] = [];

  // ── Invented style/framing labels (from regression guard) ─────
  const inventedLabels = detectInventedLabels(inputText, outputText);
  invented.push(...inventedLabels);

  // ── Invented colours ──────────────────────────────────────────
  const inputColours = new Set(inputAnchors.colours.map((c) => c.toLowerCase()));
  for (const colour of outputAnchors.colours) {
    if (!inputColours.has(colour.toLowerCase())) {
      invented.push(`invented colour: "${colour}"`);
    }
  }

  // ── Invented environment nouns ────────────────────────────────
  const inputEnv = new Set(inputAnchors.environmentNouns.map((n) => n.toLowerCase()));
  for (const noun of outputAnchors.environmentNouns) {
    if (!inputEnv.has(noun.toLowerCase())) {
      invented.push(`invented environment: "${noun}"`);
    }
  }

  // ── Invented light sources ────────────────────────────────────
  const inputLights = new Set(inputAnchors.lightSources.map((l) => l.toLowerCase()));
  for (const light of outputAnchors.lightSources) {
    if (!inputLights.has(light.toLowerCase())) {
      invented.push(`invented light source: "${light}"`);
    }
  }

  // ── Invented action verbs ─────────────────────────────────────
  // Only flag verbs that are clearly new — not inflectional variants.
  // "crashes" and "crashing" should not both flag. Use stem comparison.
  const inputVerbStems = new Set(
    inputAnchors.actionVerbs.map((v) => v.toLowerCase().replace(/(?:es|s|ing|ed)$/, '')),
  );
  for (const verb of outputAnchors.actionVerbs) {
    const stem = verb.toLowerCase().replace(/(?:es|s|ing|ed)$/, '');
    if (!inputVerbStems.has(stem)) {
      invented.push(`invented verb: "${verb}"`);
    }
  }

  return invented;
}

/**
 * Veto 3 — Prose Quality Floor (architecture §6.3).
 *
 * Rejects if the output contains:
 *   - Composition scaffold language (foreground/midground/background in same sentence)
 *   - Textbook phrasing ("creates a sense of depth")
 *   - Redundant 3+ word phrase repetition
 *
 * Uses the same detectors as the regression guard (DRY — single implementation).
 */
function checkProseQualityVeto(
  inputText: string,
  outputText: string,
): { vetoed: boolean; issues: string[] } {
  const issues: string[] = [];

  // ── Composition scaffold ──────────────────────────────────────
  const composition = detectMechanicalCompositionLanguage(inputText, outputText);
  if (composition.hasFgBgScaffold) {
    issues.push('Composition scaffold: foreground/midground/background in same sentence');
  } else if (composition.invented.length >= 2) {
    issues.push(`Composition scaffolding: ${composition.invented.length} phrases invented`);
  }

  // ── Textbook language ─────────────────────────────────────────
  const textbook = detectTextbookPromptLanguage(inputText, outputText);
  if (textbook.score >= 2) {
    issues.push(`Textbook language (score ${textbook.score}): ${[...textbook.hard, ...textbook.soft].slice(0, 2).join(', ')}`);
  }

  // ── Redundant phrase repetition ───────────────────────────────
  const redundant = detectRedundantPhraseReuse(inputText, outputText);
  if (redundant.phrases.length > 0) {
    issues.push(`Redundant phrases: ${redundant.phrases.slice(0, 3).join(', ')}`);
  }

  return {
    vetoed: issues.length > 0,
    issues,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Compute the Anchor Preservation Score and run all three vetoes.
 *
 * This is the primary quality gate for Call 3 output. It replaces
 * anchor-diff-gate as the first-line rejection mechanism.
 *
 * @param inputText     - The assembled prompt (Call 2 output, pre-GPT)
 * @param outputText    - The GPT-optimised prompt (Call 3 output, post-compliance)
 * @param inputAnchors  - Pre-computed anchor manifest from the input text
 *
 * @returns APSResult with score, verdict, veto flags, and diagnostics
 *
 * @example
 * ```ts
 * const inputAnchors = extractAnchors(assembledPrompt);
 * const aps = computeAPS(assembledPrompt, gptOutput, inputAnchors);
 *
 * if (aps.verdict === 'REJECT') {
 *   // Fallback to assembled prompt
 * } else if (aps.verdict === 'RETRY') {
 *   // Retry with tighter constraints (Phase 8)
 * } else {
 *   // Ship (run regression guard as secondary check)
 * }
 * ```
 */
export function computeAPS(
  inputText: string,
  outputText: string,
  inputAnchors: AnchorManifest,
): APSResult {
  // ── Normalise output for anchor comparison ──────────────────────
  const normalisedOutput = normaliseForComparison(outputText);

  // ── Build survival list ─────────────────────────────────────────
  const survivalList = buildSurvivalList(inputAnchors, normalisedOutput);

  const survivingAnchors = survivalList.filter((e) => e.survived);
  const droppedAnchors = survivalList.filter((e) => !e.survived);

  // ── Compute APS score ───────────────────────────────────────────
  const score = computeScore(survivalList);
  const scoreVerdict = scoreToVerdict(score);

  // ── Run vetoes ──────────────────────────────────────────────────
  const criticalAnchorVeto = checkCriticalAnchorVeto(survivalList);

  const outputAnchors = extractAnchors(outputText);
  const inventedContent = checkInventedContentVeto(inputText, outputText, inputAnchors, outputAnchors);
  const inventedContentVeto = inventedContent.length > 0;

  const proseCheck = checkProseQualityVeto(inputText, outputText);
  const proseQualityVeto = proseCheck.vetoed;

  const anyVetoFired = criticalAnchorVeto || inventedContentVeto || proseQualityVeto;

  // ── Determine final verdict ─────────────────────────────────────
  // Architecture §6.3: vetoes "reject regardless of APS score".
  // Any veto overrides ACCEPT, ACCEPT_WITH_WARNING, or RETRY to REJECT.
  // Only a score-based REJECT stays REJECT (already the strictest).
  let verdict = scoreVerdict;

  if (anyVetoFired && verdict !== 'REJECT') {
    verdict = 'REJECT';
  }

  return {
    score,
    verdict,
    scoreVerdict,
    criticalAnchorVeto,
    inventedContentVeto,
    proseQualityVeto,
    anyVetoFired,
    survivingAnchors,
    droppedAnchors,
    inventedContent,
    proseIssues: proseCheck.issues,
  };
}
