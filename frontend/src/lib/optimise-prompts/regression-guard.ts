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
//   6. Mechanical composition scaffolding (foreground/midground/background)
//   7. Textbook structure language ("creates a sense of depth")
//   8. Redundant phrase reuse (same 3+ word phrase repeated)
//
// Authority: ChatGPT architectural review Session 4 + 6 spec
// Used by: src/app/api/optimise-prompt/route.ts (GPT path only)
// ============================================================================

import type { AnchorManifest } from './preflight';
import { extractAnchors } from './preflight';

// ============================================================================
// TYPES
// ============================================================================

/** A single prose quality finding with sentence context. */
export interface ProseFinding {
  /** The detector that produced this finding */
  detector: 'composition' | 'textbook-hard' | 'textbook-soft' | 'redundant';
  /** The phrase or pattern matched */
  phrase: string;
  /** Sentence snippet where the finding occurred (first 80 chars) */
  context: string;
}

/** Diagnostic findings from prose quality detectors — always returned for tuning. */
export interface ProseQualityFindings {
  /** All individual findings with context */
  findings: ProseFinding[];
  /** Whether hard foreground+background scaffold was detected (same sentence) */
  compositionHardFail: boolean;
  /** Cumulative textbook score (hard=2pts, soft=1pt) */
  textbookScore: number;
  /** Redundant repeated phrases (longest match, overlaps collapsed) */
  redundantCount: number;
}

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
  /** Prose quality findings — always populated for diagnostics, even when passing */
  proseQuality: ProseQualityFindings;
}

/** Detailed anchor comparison between input and output. */
export interface AnchorDiff {
  droppedColours: string[];
  inventedColours: string[];
  droppedLightSources: string[];
  inventedLightSources: string[];
  droppedEnvironment: string[];
  inventedEnvironment: string[];
  droppedVerbs: string[];
  newVerbs: string[];
}

// ============================================================================
// ANCHOR DIFF
// ============================================================================

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
// INVENTED CONTENT DETECTION (Check 2)
// ============================================================================

const STYLE_LABELS = new Set([
  'neon-noir', 'neo-noir', 'painterly', 'cinematic', 'hyperrealistic',
  'photorealistic', 'atmospheric', 'moody', 'ethereal', 'dramatic',
  'surreal', 'impressionistic', 'dystopian', 'post-apocalyptic',
  'steampunk', 'solarpunk', 'vaporwave', 'lo-fi', 'high-contrast',
  'film noir', 'concept art', 'matte painting', 'digital painting',
]);

const FRAMING_LABELS = new Set([
  'low angle', 'high angle', 'bird\'s eye', 'worm\'s eye', 'dutch angle',
  'wide shot', 'close-up', 'extreme close-up', 'medium shot',
  'establishing shot', 'over the shoulder', 'tracking shot',
  'depth of field', 'shallow focus', 'bokeh', 'tilt-shift',
  'seen from below', 'seen from above', 'looming overhead',
]);

export function detectInventedLabels(inputText: string, outputText: string): string[] {
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
// SENTENCE COUNT CHECK (Check 4)
// ============================================================================

function countSentences(text: string): number {
  const matches = text.match(/[.!?](?:\s+[A-Z]|$)/g);
  return matches ? matches.length : (text.trim().length > 0 ? 1 : 0);
}

// ============================================================================
// UTILITY: Find which sentence contains a phrase
// ============================================================================

function findSentenceContext(text: string, phrase: string): string {
  const lower = text.toLowerCase();
  const phraseLower = phrase.toLowerCase();
  const idx = lower.indexOf(phraseLower);
  if (idx < 0) return '';

  // Walk backward to sentence start
  let start = idx;
  while (start > 0 && !/[.!?]/.test(text[start - 1] ?? '')) start--;
  if (start > 0) start++; // skip past the period

  // Walk forward to sentence end
  let end = idx + phrase.length;
  while (end < text.length && !/[.!?]/.test(text[end] ?? '')) end++;
  if (end < text.length) end++; // include the period

  return text.slice(start, end).trim().slice(0, 80);
}

// ============================================================================
// LOW-VALUE PROSE DETECTORS (Checks 6, 7, 8)
// ============================================================================

// ── Detector 1: Mechanical composition scaffolding (Check 6) ────────────────

const COMPOSITION_SCAFFOLD_PHRASES = [
  'in the foreground',
  'in the midground',
  'in the middle ground',
  'in the background',
  'foreground steps',
  'foreground leads',
  'foreground frames',
  'midground trunks',
  'background adds',
  'background depth',
  'layered composition',
  'visual hierarchy',
  'balanced composition',
  'compositional depth',
  'the eye is drawn',
  'draws the viewer',
  'leading the eye',
  'framed as a',
  'provides a focal point',
  'focal point of',
];

/**
 * Hard-fail: requires explicit scaffold framing in the same sentence:
 *   - "in the foreground" + "in the background/midground" in one sentence
 *   - OR 2+ scaffold phrases in the same sentence
 *
 * Refined per ChatGPT review: does NOT trigger on innocent standalone mentions
 * like "foreground lanterns" or "background cliffs".
 */
function detectFgBgScaffoldSentence(outputText: string, inputText: string): boolean {
  const inputLower = inputText.toLowerCase();
  // If input already had this pattern, it's not GPT's fault
  if (/in the foreground/.test(inputLower) && /in the (?:background|midground|middle ground)/.test(inputLower)) {
    return false;
  }

  const sentences = outputText.split(/[.!?]\s+/);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();

    // Explicit scaffold: "in the foreground" + "in the background/midground"
    if (/\bin the foreground\b/.test(lower) && /\bin the (?:background|midground|middle ground)\b/.test(lower)) {
      return true;
    }

    // 2+ scaffold phrases in the same sentence
    let scaffoldHits = 0;
    for (const phrase of COMPOSITION_SCAFFOLD_PHRASES) {
      if (lower.includes(phrase) && !inputLower.includes(phrase)) {
        scaffoldHits++;
      }
    }
    if (scaffoldHits >= 2) return true;
  }
  return false;
}

interface CompositionResult {
  invented: string[];
  hasFgBgScaffold: boolean;
  findings: ProseFinding[];
}

export function detectMechanicalCompositionLanguage(
  inputText: string,
  outputText: string,
): CompositionResult {
  const inputLower = inputText.toLowerCase();
  const outputLower = outputText.toLowerCase();

  const invented = COMPOSITION_SCAFFOLD_PHRASES.filter(
    phrase => outputLower.includes(phrase) && !inputLower.includes(phrase),
  );

  const hasFgBgScaffold = detectFgBgScaffoldSentence(outputText, inputText);

  const findings: ProseFinding[] = invented.map(phrase => ({
    detector: 'composition' as const,
    phrase,
    context: findSentenceContext(outputText, phrase),
  }));

  return { invented, hasFgBgScaffold, findings };
}

// ── Detector 2: Textbook structure language (Check 7) ───────────────────────
// Hard/soft buckets with cumulative scoring per ChatGPT review.
// Hard phrase = 2 points. Soft phrase = 1 point.
// T3 fails at 3+ points. T4 fails at 2+ points.

const TEXTBOOK_HARD_PHRASES = [
  'creates a sense of',
  'creating a sense of',
  'evoking a feeling of',
  'adds visual interest',
  'adding visual interest',
  'for cinematic effect',
  'for cinematic impact',
  'for dramatic impact',
  'for dramatic effect',
  'draws the viewer',
  'drawing the viewer',
  'creates visual tension',
  'creating visual tension',
  'suggesting a narrative',
  'lending an air of',
];

const TEXTBOOK_SOFT_PHRASES = [
  'enhances the composition',
  'enhancing the composition',
  'establishes mood',
  'establishing mood',
  'establishes atmosphere',
  'establishing atmosphere',
  'creates contrast',
  'creating contrast',
  'builds contrast',
  'building contrast',
  'adds atmosphere',
  'adding atmosphere',
  'adding a touch of',
  'adding depth to',
  'contrasting sharply with',
  'complementing the',
];

interface TextbookResult {
  hard: string[];
  soft: string[];
  /** Cumulative score: hard=2pts, soft=1pt */
  score: number;
  findings: ProseFinding[];
}

export function detectTextbookPromptLanguage(
  inputText: string,
  outputText: string,
): TextbookResult {
  const inputLower = inputText.toLowerCase();
  const outputLower = outputText.toLowerCase();

  const hard = TEXTBOOK_HARD_PHRASES.filter(
    phrase => outputLower.includes(phrase) && !inputLower.includes(phrase),
  );
  const soft = TEXTBOOK_SOFT_PHRASES.filter(
    phrase => outputLower.includes(phrase) && !inputLower.includes(phrase),
  );

  const score = (hard.length * 2) + soft.length;

  const findings: ProseFinding[] = [
    ...hard.map(phrase => ({
      detector: 'textbook-hard' as const,
      phrase,
      context: findSentenceContext(outputText, phrase),
    })),
    ...soft.map(phrase => ({
      detector: 'textbook-soft' as const,
      phrase,
      context: findSentenceContext(outputText, phrase),
    })),
  ];

  return { hard, soft, score, findings };
}

// ── Detector 3: Redundant phrase reuse (Check 8) ────────────────────────────
// Token-based overlap collapse per ChatGPT review.

const NGRAM_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'of',
  'for', 'with', 'from', 'by', 'as', 'is', 'are', 'was', 'were',
]);

/** Phrases already caught by composition/textbook detectors — skip to avoid double-penalty. */
const REDUNDANT_IGNORE = new Set([
  'in the foreground',
  'in the background',
  'in the midground',
  'in the middle ground',
]);

function extractContentNgrams(text: string, n: number): Map<string, number> {
  // Fixed: no unnecessary escape on dash — put it last in character class
  const words = text.toLowerCase().replace(/[.,;:!?—–-]/g, ' ').split(/\s+/).filter(Boolean);
  const ngrams = new Map<string, number>();

  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n);
    if (gram.every(w => NGRAM_STOP_WORDS.has(w))) continue;
    const key = gram.join(' ');
    ngrams.set(key, (ngrams.get(key) ?? 0) + 1);
  }

  return ngrams;
}

/**
 * Token-based overlap collapse: keep longest, suppress shorter phrases that
 * are contiguous token subsequences of a longer kept phrase.
 * "a low centered viewpoint" suppresses "low centered viewpoint" and "a low centered".
 */
function collapseOverlapping(phrases: string[]): string[] {
  // Sort longest first (by token count, then string length)
  const sorted = [...phrases].sort((a, b) => {
    const aToks = a.split(' ').length;
    const bToks = b.split(' ').length;
    return bToks !== aToks ? bToks - aToks : b.length - a.length;
  });

  const kept: string[] = [];

  for (const phrase of sorted) {
    const phraseToks = phrase.split(' ');

    // Check if this phrase's tokens are a contiguous subsequence of any kept phrase
    const isSubsequence = kept.some(k => {
      const kToks = k.split(' ');
      if (phraseToks.length >= kToks.length) return false;
      // Slide window across kept tokens
      for (let i = 0; i <= kToks.length - phraseToks.length; i++) {
        let match = true;
        for (let j = 0; j < phraseToks.length; j++) {
          if (kToks[i + j] !== phraseToks[j]) { match = false; break; }
        }
        if (match) return true;
      }
      return false;
    });

    if (!isSubsequence) {
      kept.push(phrase);
    }
  }

  return kept;
}

interface RedundantResult {
  phrases: string[];
  findings: ProseFinding[];
}

export function detectRedundantPhraseReuse(
  inputText: string,
  outputText: string,
): RedundantResult {
  const allRepeated: string[] = [];

  for (const n of [3, 4, 5]) {
    const outputGrams = extractContentNgrams(outputText, n);
    const inputGrams = extractContentNgrams(inputText, n);

    for (const [gram, count] of outputGrams) {
      if (count >= 2) {
        const inputCount = inputGrams.get(gram) ?? 0;
        if (inputCount < 2 && !REDUNDANT_IGNORE.has(gram)) {
          allRepeated.push(gram);
        }
      }
    }
  }

  const collapsed = collapseOverlapping(allRepeated);

  const findings: ProseFinding[] = collapsed.map(phrase => ({
    detector: 'redundant' as const,
    phrase: `"${phrase}"`,
    context: findSentenceContext(outputText, phrase),
  }));

  return { phrases: collapsed.map(g => `"${g}"`), findings };
}

// ============================================================================
// REGRESSION CHECK — THE MAIN GATE
// ============================================================================

/** Options controlling which checks run. */
export interface RegressionCheckOptions {
  tier: number;
  supportsWeighting: boolean;
  call3Mode: string;
  checkSentenceCount: boolean;
  checkVerbs: boolean;
  verbSubstitutionHardFail: boolean;
  maxInventedItems: number;
  maxDroppedAnchors: number;
  /** Whether to run low-value prose detectors (T3/T4 only) */
  checkProseQuality: boolean;
  /** Cumulative textbook score threshold (hard=2pts, soft=1pt) */
  maxTextbookScore: number;
}

/** Default options per tier. */
export function defaultRegressionOptions(
  tier: number,
  call3Mode: string,
  supportsWeighting: boolean,
): RegressionCheckOptions {
  switch (tier) {
    case 1:
      return {
        tier, supportsWeighting, call3Mode,
        checkSentenceCount: false,
        checkVerbs: false,
        verbSubstitutionHardFail: false,
        maxInventedItems: 3,
        maxDroppedAnchors: 1,
        checkProseQuality: false,
        maxTextbookScore: 99,
      };
    case 2:
      return {
        tier, supportsWeighting, call3Mode,
        checkSentenceCount: false,
        checkVerbs: true,
        verbSubstitutionHardFail: false,
        maxInventedItems: 2,
        maxDroppedAnchors: 1,
        checkProseQuality: false,
        maxTextbookScore: 99,
      };
    case 3:
      return {
        tier, supportsWeighting, call3Mode,
        checkSentenceCount: true,
        checkVerbs: true,
        verbSubstitutionHardFail: false,
        maxInventedItems: 2,
        maxDroppedAnchors: 2,
        checkProseQuality: true,
        maxTextbookScore: 3,  // 1 hard (2pts) + 1 soft (1pt) = fail
      };
    case 4:
    default:
      return {
        tier, supportsWeighting, call3Mode,
        checkSentenceCount: true,
        checkVerbs: true,
        verbSubstitutionHardFail: true,
        maxInventedItems: 1,
        maxDroppedAnchors: 1,
        checkProseQuality: true,
        maxTextbookScore: 2,  // any hard phrase = fail
      };
  }
}

/**
 * Check whether GPT's output is a regression from the assembled input.
 */
export function checkRegression(
  inputText: string,
  outputText: string,
  options: RegressionCheckOptions,
): RegressionResult {
  const regressions: string[] = [];

  // ── Extract anchors ────────────────────────────────────────────────
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
  const inventedAnchors: string[] = [];
  if (anchorDiff.inventedColours.length > 0) inventedAnchors.push(...anchorDiff.inventedColours.map(c => `colour: "${c}"`));
  if (anchorDiff.inventedLightSources.length > 0) inventedAnchors.push(...anchorDiff.inventedLightSources.map(l => `light: "${l}"`));
  if (anchorDiff.inventedEnvironment.length > 0) inventedAnchors.push(...anchorDiff.inventedEnvironment.map(e => `env: "${e}"`));

  const allInvented = [...inventedContent, ...inventedAnchors];
  if (allInvented.length > options.maxInventedItems) {
    regressions.push(`Invented ${allInvented.length} items: ${allInvented.slice(0, 5).join(', ')}${allInvented.length > 5 ? '...' : ''}`);
  }

  // ── Check 3: Verb substitution ─────────────────────────────────────
  let verbSubstitutionDetected = false;
  if (options.checkVerbs && anchorDiff.droppedVerbs.length > 0) {
    if (anchorDiff.newVerbs.length > 0 && anchorDiff.droppedVerbs.length > 0) {
      verbSubstitutionDetected = true;
      if (options.verbSubstitutionHardFail) {
        regressions.push(
          `Verb substitution (hard fail): lost [${anchorDiff.droppedVerbs.join(', ')}], added [${anchorDiff.newVerbs.join(', ')}]`
        );
      }
    }
  }

  // ── Check 4: Sentence count drift ──────────────────────────────────
  if (options.checkSentenceCount) {
    const inputSentences = countSentences(inputText);
    const outputSentences = countSentences(outputText);
    if (inputSentences >= 2 && outputSentences < inputSentences - 1) {
      regressions.push(`Sentence count dropped: ${inputSentences} → ${outputSentences} (merged into run-on)`);
    }
  }

  // ── Check 5: Weight regression (T1/T2) ─────────────────────────────
  if (options.supportsWeighting) {
    const inputWeightCount = (inputText.match(/\w::[\d.]+/g) ?? []).length;
    const outputWeightCount = (outputText.match(/\w::[\d.]+/g) ?? []).length;
    if (inputWeightCount > 0 && outputWeightCount < inputWeightCount) {
      regressions.push(`Weight clause regression: ${inputWeightCount} → ${outputWeightCount} weighted clauses`);
    }
  }

  // ── Prose quality detectors (Checks 6, 7, 8) ──────────────────────
  // Always run and populate findings for diagnostics/tuning.
  // Only contribute to regressions when checkProseQuality is true.
  const composition = detectMechanicalCompositionLanguage(inputText, outputText);
  const textbook = detectTextbookPromptLanguage(inputText, outputText);
  const redundant = detectRedundantPhraseReuse(inputText, outputText);

  const proseQuality: ProseQualityFindings = {
    findings: [...composition.findings, ...textbook.findings, ...redundant.findings],
    compositionHardFail: composition.hasFgBgScaffold,
    textbookScore: textbook.score,
    redundantCount: redundant.phrases.length,
  };

  if (options.checkProseQuality) {
    // Check 6: Composition scaffolding
    if (composition.hasFgBgScaffold) {
      regressions.push('Mechanical composition scaffold: foreground/background in same sentence');
    } else if (composition.invented.length >= 2) {
      regressions.push(`Composition scaffolding: ${composition.invented.length} phrases invented (${composition.invented.slice(0, 3).join(', ')})`);
    }

    // Check 7: Textbook language — cumulative scoring (hard=2pts, soft=1pt)
    if (textbook.score >= options.maxTextbookScore) {
      const parts: string[] = [];
      if (textbook.hard.length > 0) parts.push(`hard: ${textbook.hard.slice(0, 2).join(', ')}`);
      if (textbook.soft.length > 0) parts.push(`soft: ${textbook.soft.slice(0, 2).join(', ')}`);
      regressions.push(`Textbook language (score ${textbook.score}/${options.maxTextbookScore}): ${parts.join('; ')}`);
    }

    // Check 8: Redundant phrases
    if (redundant.phrases.length > 0) {
      regressions.push(`Redundant phrases: ${redundant.phrases.slice(0, 3).join(', ')}`);
    }
  }

  // ── Soft verb substitution (T3) — contributing only ────────────────
  if (verbSubstitutionDetected && !options.verbSubstitutionHardFail && regressions.length > 0) {
    regressions.push(`Verb substitution (contributing): lost [${anchorDiff.droppedVerbs.join(', ')}], added [${anchorDiff.newVerbs.join(', ')}]`);
  }

  return {
    passed: regressions.length === 0,
    regressions,
    anchorDiff,
    inventedContent: allInvented,
    proseQuality,
  };
}

// ============================================================================
// LIGHTWEIGHT MJ DETERMINISTIC REGRESSION CHECK
// ============================================================================

export interface MjDeterministicRegressionResult {
  passed: boolean;
  regressions: string[];
}

export function checkMjDeterministicRegression(
  inputText: string,
  outputText: string,
): MjDeterministicRegressionResult {
  const regressions: string[] = [];

  const inputClauses = (inputText.match(/\w::[\d.]+/g) ?? []).length;
  const outputClauses = (outputText.match(/\w::[\d.]+/g) ?? []).length;
  if (inputClauses > 0 && outputClauses < inputClauses) {
    regressions.push(`Clause count decreased: ${inputClauses} → ${outputClauses}`);
  }
  if (inputClauses > 0 && outputClauses === 0) {
    regressions.push('All weighted clauses lost');
  }
  if (!/--ar\s+\d+:\d+/.test(outputText)) {
    regressions.push('Missing --ar parameter');
  }
  if (!/--no\s+\S/.test(outputText)) {
    regressions.push('Missing or empty --no block');
  }
  if (/\([^()]+:\d+\.?\d*\)/.test(outputText)) {
    regressions.push('Parenthetical weight syntax leaked into output');
  }

  return { passed: regressions.length === 0, regressions };
}
