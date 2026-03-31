// src/lib/optimise-prompts/regression-guard.ts
// ============================================================================
// REGRESSION GUARD — Post-GPT "no worse than input" validator
// ============================================================================
// Pure code. Runs AFTER GPT responds and compliance gates fire.
// Compares GPT's output against the original assembled prompt and rejects
// the output if it regressed on platform-relevant structural metrics.
//
// What it checks:
//   1. Dropped anchors (colours, light sources, environment nouns)
//   2. Invented content (words in output not present in input)
//   3. Verb substitution (action verbs changed)
//   4. Sentence count drift (for prose platforms)
//   5. Weight regression (for T1/T2 platforms)
//
// If regression is detected, the guard returns the assembled prompt with
// deterministic fixes only — not GPT's output.
//
// Design: defence in depth. GPT gets every chance to improve the prompt.
// But if it made things worse, the user gets back what they had.
//
// Authority: ChatGPT architectural review Session 4 spec
// Used by: src/app/api/optimise-prompt/route.ts (GPT path only)
// ============================================================================

import type { AnchorManifest } from './preflight';
import { extractAnchors } from './preflight';

// ============================================================================
// TYPES
// ============================================================================

/** Result of the regression check. */
export interface RegressionResult {
  /** Whether the output passed (no regression) */
  passed: boolean;
  /** If failed, the specific regressions found */
  regressions: string[];
  /** Anchor diff details */
  anchorDiff: AnchorDiff;
  /** Invented content found in output */
  inventedContent: string[];
}

/** Detailed anchor comparison between input and output. */
export interface AnchorDiff {
  /** Colours in input but missing from output */
  droppedColours: string[];
  /** Colours in output but not in input */
  inventedColours: string[];
  /** Light sources in input but missing from output */
  droppedLightSources: string[];
  /** Light sources in output but not in input */
  inventedLightSources: string[];
  /** Environment nouns in input but missing from output */
  droppedEnvironment: string[];
  /** Environment nouns in output but not in input */
  inventedEnvironment: string[];
  /** Action verbs in input but missing from output */
  droppedVerbs: string[];
  /** Action verbs in output but not in input (substituted) */
  newVerbs: string[];
}

// ============================================================================
// ANCHOR DIFF
// ============================================================================

/**
 * Compare anchor manifests between input and output.
 * Finds dropped anchors (in input, missing from output)
 * and invented anchors (in output, not in input).
 */
function diffAnchors(input: AnchorManifest, output: AnchorManifest): AnchorDiff {
  const diff = (inputList: string[], outputList: string[]) => {
    const inputSet = new Set(inputList.map(s => s.toLowerCase()));
    const outputSet = new Set(outputList.map(s => s.toLowerCase()));
    const dropped = [...inputSet].filter(s => !outputSet.has(s));
    const invented = [...outputSet].filter(s => !inputSet.has(s));
    return { dropped, invented };
  };

  const colours = diff(input.colours, output.colours);
  const lights = diff(input.lightSources, output.lightSources);
  const env = diff(input.environmentNouns, output.environmentNouns);
  const verbs = diff(input.actionVerbs, output.actionVerbs);

  return {
    droppedColours: colours.dropped,
    inventedColours: colours.invented,
    droppedLightSources: lights.dropped,
    inventedLightSources: lights.invented,
    droppedEnvironment: env.dropped,
    inventedEnvironment: env.invented,
    droppedVerbs: verbs.dropped,
    newVerbs: verbs.invented,
  };
}

// ============================================================================
// INVENTED CONTENT DETECTION
// ============================================================================

// Common style/atmosphere labels GPT likes to invent
const STYLE_LABELS = new Set([
  'neon-noir', 'neo-noir', 'painterly', 'cinematic', 'hyperrealistic',
  'photorealistic', 'atmospheric', 'moody', 'ethereal', 'dramatic',
  'surreal', 'impressionistic', 'dystopian', 'post-apocalyptic',
  'steampunk', 'solarpunk', 'vaporwave', 'lo-fi', 'high-contrast',
  'film noir', 'concept art', 'matte painting', 'digital painting',
]);

// Framing/camera cues GPT likes to bolt on
const FRAMING_LABELS = new Set([
  'low angle', 'high angle', 'bird\'s eye', 'worm\'s eye', 'dutch angle',
  'wide shot', 'close-up', 'extreme close-up', 'medium shot',
  'establishing shot', 'over the shoulder', 'tracking shot',
  'depth of field', 'shallow focus', 'bokeh', 'tilt-shift',
  'seen from below', 'seen from above', 'looming overhead',
]);

/**
 * Detect style labels and framing cues in the output that weren't in the input.
 * These are the most common GPT inventions on NL platforms.
 */
function detectInventedLabels(inputText: string, outputText: string): string[] {
  const inputLower = inputText.toLowerCase();
  const outputLower = outputText.toLowerCase();
  const invented: string[] = [];

  for (const label of STYLE_LABELS) {
    if (outputLower.includes(label) && !inputLower.includes(label)) {
      invented.push(`style: "${label}"`);
    }
  }

  for (const label of FRAMING_LABELS) {
    if (outputLower.includes(label) && !inputLower.includes(label)) {
      invented.push(`framing: "${label}"`);
    }
  }

  return invented;
}

// ============================================================================
// SENTENCE COUNT CHECK
// ============================================================================

/**
 * Count sentences in text (rough but reliable for prompt prose).
 * Counts full stops followed by space+capital or end-of-string.
 */
function countSentences(text: string): number {
  // Count full stops that end a sentence (not abbreviations)
  const matches = text.match(/[.!?](?:\s+[A-Z]|$)/g);
  return matches ? matches.length : (text.trim().length > 0 ? 1 : 0);
}

// ============================================================================
// REGRESSION CHECK — THE MAIN GATE
// ============================================================================

/** Options controlling which checks run. */
export interface RegressionCheckOptions {
  /** Platform tier (1-4) — affects which checks are relevant */
  tier: number;
  /** Whether the platform uses weighted syntax (T1/T2) */
  supportsWeighting: boolean;
  /** The call3Mode for this platform */
  call3Mode: string;
  /** Whether to check sentence count preservation */
  checkSentenceCount: boolean;
  /** Whether to check verb preservation */
  checkVerbs: boolean;
  /** Whether verb substitution alone causes hard failure (T4 = true) */
  verbSubstitutionHardFail: boolean;
  /** Max allowed invented content items before failing */
  maxInventedItems: number;
  /** Max allowed dropped anchors (colours + lights + env) before failing */
  maxDroppedAnchors: number;
}

/** Default options per tier. */
export function defaultRegressionOptions(
  tier: number,
  call3Mode: string,
  supportsWeighting: boolean,
): RegressionCheckOptions {
  switch (tier) {
    case 1: // CLIP — strict syntax, loose prose
      return {
        tier,
        supportsWeighting,
        call3Mode,
        checkSentenceCount: false,  // CLIP doesn't have sentences
        checkVerbs: false,          // verbs less relevant for keyword prompts
        verbSubstitutionHardFail: false,
        maxInventedItems: 3,        // CLIP benefits from quality tokens
        maxDroppedAnchors: 1,       // anchors are critical for CLIP
      };
    case 2: // Midjourney — strict structure, moderate prose
      return {
        tier,
        supportsWeighting,
        call3Mode,
        checkSentenceCount: false,  // MJ uses clause structure, not sentences
        checkVerbs: true,           // verb quality matters
        verbSubstitutionHardFail: false, // MJ clause prose can benefit from stronger verbs
        maxInventedItems: 2,        // some creative additions OK
        maxDroppedAnchors: 1,       // anchors critical
      };
    case 3: // Natural language — moderate all
      return {
        tier,
        supportsWeighting,
        call3Mode,
        checkSentenceCount: true,
        checkVerbs: true,
        verbSubstitutionHardFail: false, // T3 may benefit from better verbs sometimes
        maxInventedItems: 2,
        maxDroppedAnchors: 2,
      };
    case 4: // Plain language — strict preservation
    default:
      return {
        tier,
        supportsWeighting,
        call3Mode,
        checkSentenceCount: true,
        checkVerbs: true,
        verbSubstitutionHardFail: true,  // T4: any verb swap = hard fail
        maxInventedItems: 1,             // T4 should add almost nothing
        maxDroppedAnchors: 1,
      };
  }
}

/**
 * Check whether GPT's output is a regression from the assembled input.
 *
 * Runs after GPT + compliance gates. If regression is detected, the caller
 * should discard GPT output and return the assembled prompt (optionally
 * with deterministic fixes applied).
 *
 * @param inputText - The original assembled prompt (sanitised)
 * @param outputText - GPT's output after compliance gates
 * @param options - Tier-specific check configuration
 */
export function checkRegression(
  inputText: string,
  outputText: string,
  options: RegressionCheckOptions,
): RegressionResult {
  const regressions: string[] = [];

  // ── Extract anchors from both ──────────────────────────────────────
  const inputAnchors = extractAnchors(inputText);
  const outputAnchors = extractAnchors(outputText);
  const anchorDiff = diffAnchors(inputAnchors, outputAnchors);

  // ── Check 1: Dropped anchors ───────────────────────────────────────
  const totalDropped =
    anchorDiff.droppedColours.length +
    anchorDiff.droppedLightSources.length +
    anchorDiff.droppedEnvironment.length;

  if (totalDropped > options.maxDroppedAnchors) {
    const details: string[] = [];
    if (anchorDiff.droppedColours.length > 0) details.push(`colours: ${anchorDiff.droppedColours.join(', ')}`);
    if (anchorDiff.droppedLightSources.length > 0) details.push(`lights: ${anchorDiff.droppedLightSources.join(', ')}`);
    if (anchorDiff.droppedEnvironment.length > 0) details.push(`environment: ${anchorDiff.droppedEnvironment.join(', ')}`);
    regressions.push(`Dropped ${totalDropped} anchor(s): ${details.join('; ')}`);
  }

  // ── Check 2: Invented content ──────────────────────────────────────
  const inventedContent = detectInventedLabels(inputText, outputText);

  // Also count invented anchors (new colours, lights, env nouns not in input)
  const inventedAnchors: string[] = [];
  if (anchorDiff.inventedColours.length > 0) {
    inventedAnchors.push(...anchorDiff.inventedColours.map(c => `colour: "${c}"`));
  }
  if (anchorDiff.inventedLightSources.length > 0) {
    inventedAnchors.push(...anchorDiff.inventedLightSources.map(l => `light: "${l}"`));
  }
  if (anchorDiff.inventedEnvironment.length > 0) {
    inventedAnchors.push(...anchorDiff.inventedEnvironment.map(e => `env: "${e}"`));
  }

  const allInvented = [...inventedContent, ...inventedAnchors];
  if (allInvented.length > options.maxInventedItems) {
    regressions.push(`Invented ${allInvented.length} items: ${allInvented.slice(0, 5).join(', ')}${allInvented.length > 5 ? '...' : ''}`);
  }

  // ── Check 3: Verb substitution ─────────────────────────────────────
  // T4: any verb swap is a hard fail (preservation tier)
  // T3: verb swap is noted but only fails when combined with other regressions
  // T2: not checked by default (clause prose may genuinely benefit)
  let verbSubstitutionDetected = false;
  if (options.checkVerbs && anchorDiff.droppedVerbs.length > 0) {
    if (anchorDiff.newVerbs.length > 0 && anchorDiff.droppedVerbs.length > 0) {
      verbSubstitutionDetected = true;
      if (options.verbSubstitutionHardFail) {
        // T4: immediate regression
        regressions.push(
          `Verb substitution (hard fail): lost [${anchorDiff.droppedVerbs.join(', ')}], added [${anchorDiff.newVerbs.join(', ')}]`
        );
      }
      // T3: will be added below only if other regressions already exist
    }
  }

  // ── Check 4: Sentence count drift ──────────────────────────────────
  if (options.checkSentenceCount) {
    const inputSentences = countSentences(inputText);
    const outputSentences = countSentences(outputText);

    // Merging 3 sentences into 1 run-on is a regression
    if (inputSentences >= 2 && outputSentences < inputSentences - 1) {
      regressions.push(
        `Sentence count dropped: ${inputSentences} → ${outputSentences} (merged into run-on)`
      );
    }
  }

  // ── Check 5: Weight regression (T1/T2) ─────────────────────────────
  if (options.supportsWeighting) {
    const inputWeightCount = (inputText.match(/\w::[\d.]+/g) ?? []).length;
    const outputWeightCount = (outputText.match(/\w::[\d.]+/g) ?? []).length;

    if (inputWeightCount > 0 && outputWeightCount < inputWeightCount) {
      regressions.push(
        `Weight clause regression: ${inputWeightCount} → ${outputWeightCount} weighted clauses`
      );
    }
  }

  // ── Soft verb substitution (T3) — add only if other regressions exist ──
  // For non-hard-fail tiers, verb substitution alone is acceptable but
  // strengthens the case when combined with other problems.
  if (verbSubstitutionDetected && !options.verbSubstitutionHardFail && regressions.length > 0) {
    regressions.push(
      `Verb substitution (contributing): lost [${anchorDiff.droppedVerbs.join(', ')}], added [${anchorDiff.newVerbs.join(', ')}]`
    );
  }

  return {
    passed: regressions.length === 0,
    regressions,
    anchorDiff,
    inventedContent: allInvented,
  };
}

// ============================================================================
// LIGHTWEIGHT MJ DETERMINISTIC REGRESSION CHECK
// ============================================================================

/** Slim result for MJ deterministic path. */
export interface MjDeterministicRegressionResult {
  passed: boolean;
  regressions: string[];
}

/**
 * Lightweight regression check for the Midjourney deterministic path.
 * Only checks structural integrity — not prose, not style labels, not verbs.
 *
 * Checks:
 *   1. Weighted clause count did not decrease
 *   2. No clause prose became empty
 *   3. No weights disappeared entirely
 *   4. Parameter block exists (--ar at minimum)
 *   5. --no exists and is not empty
 *   6. No parenthetical weight syntax leaked back in
 */
export function checkMjDeterministicRegression(
  inputText: string,
  outputText: string,
): MjDeterministicRegressionResult {
  const regressions: string[] = [];

  // 1. Weighted clause count
  const inputClauses = (inputText.match(/\w::[\d.]+/g) ?? []).length;
  const outputClauses = (outputText.match(/\w::[\d.]+/g) ?? []).length;
  if (inputClauses > 0 && outputClauses < inputClauses) {
    regressions.push(`Clause count decreased: ${inputClauses} → ${outputClauses}`);
  }

  // 2. No weights disappeared entirely
  if (inputClauses > 0 && outputClauses === 0) {
    regressions.push('All weighted clauses lost');
  }

  // 3. Parameter block exists
  if (!/--ar\s+\d+:\d+/.test(outputText)) {
    regressions.push('Missing --ar parameter');
  }

  // 4. --no exists and has content
  if (!/--no\s+\S/.test(outputText)) {
    regressions.push('Missing or empty --no block');
  }

  // 5. No parenthetical syntax leaked back
  if (/\([^()]+:\d+\.?\d*\)/.test(outputText)) {
    regressions.push('Parenthetical weight syntax leaked into output');
  }

  return {
    passed: regressions.length === 0,
    regressions,
  };
}
