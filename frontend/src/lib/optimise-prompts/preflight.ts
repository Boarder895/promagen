// src/lib/optimise-prompts/preflight.ts
// ============================================================================
// CALL 3 PREFLIGHT ENGINE — Decision routing + deterministic transforms
// ============================================================================
// Pure code. No GPT. Runs BEFORE the GPT call in the route.
//
// Three responsibilities:
//   1. Extract lightweight anchor manifest from assembled prompt
//   2. Decide whether GPT is needed or a deterministic transform suffices
//   3. Provide deterministic subject-front-loader for prose platforms
//
// Design principle: GPT is the exception, not the default. Most Tier 4
// platforms and many Tier 3 platforms can be handled with code-only
// transforms. GPT is reserved for platforms where semantic rewriting
// adds measurable value.
//
// Authority: api-3.md, ChatGPT architectural review (31 Mar 2026)
// Used by: src/app/api/optimise-prompt/route.ts
// ============================================================================

// ============================================================================
// TYPES
// ============================================================================

/** Lightweight anchor manifest extracted from the assembled prompt. */
export interface AnchorManifest {
  /** Primary subject phrase (first noun phrase that looks like a subject) */
  subjectPhrase: string | null;
  /** Position (char index) where the subject phrase starts */
  subjectPosition: number;
  /** Whether the subject is already in the first 5 words */
  subjectIsLeading: boolean;
  /** Named colours found in the prompt */
  colours: string[];
  /** Light source descriptions */
  lightSources: string[];
  /** Major environment/setting nouns */
  environmentNouns: string[];
  /** Action verbs associated with the subject */
  actionVerbs: string[];
  /** Total anchor count (rough measure of prompt density) */
  anchorCount: number;
}

/** Decision output from the preflight engine. */
export type Call3Decision =
  | 'PASS_THROUGH'          // Return assembled prompt unchanged
  | 'REORDER_ONLY'          // Deterministic subject-front-load, no GPT
  | 'FORMAT_ONLY'           // Group gate cleanup only, no GPT
  | 'COMPRESS_ONLY'         // Deterministic compression, no GPT
  | 'MJ_DETERMINISTIC_ONLY' // Midjourney deterministic parse/normalise, no GPT
  | 'GPT_REWRITE';          // Full GPT path

/** Config-driven mode per platform. */
export type Call3Mode =
  | 'reorder_only'
  | 'format_only'
  | 'gpt_rewrite'
  | 'pass_through'
  | 'mj_deterministic';

import { parseMjPrompt, validateMjStructure } from './midjourney-deterministic';

// ============================================================================
// COLOUR DETECTION
// ============================================================================

const COLOUR_PATTERNS = [
  // Named colours with optional modifiers
  /\b(?:deep|pale|dark|bright|vivid|muted|warm|cool|rich|faded|soft|harsh)?\s*(?:red|blue|green|yellow|orange|purple|violet|pink|cyan|magenta|crimson|scarlet|gold|golden|silver|copper|bronze|amber|teal|turquoise|emerald|cobalt|indigo|maroon|ivory|charcoal|slate)\b/gi,
  // Compound colour descriptions
  /\b(?:purple-and-copper|magenta-and-cyan|black-and-white|blue-grey|blue-gray|grey-green|gray-green|rose-gold)\b/gi,
];

function extractColours(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of COLOUR_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern.source, 'gi'));
    for (const m of matches) {
      found.add(m[0].toLowerCase().trim());
    }
  }
  return [...found];
}

// ============================================================================
// LIGHT SOURCE DETECTION
// ============================================================================

const LIGHT_PATTERNS = [
  /\b(?:lighthouse beam|beam of light|lamp(?:light)?|lantern|candle(?:light)?|firelight|moonlight|sunlight|starlight|neon (?:light|glow|sign)|streetlight|headlight|window (?:light|glow))\b/gi,
  /\b(?:pale gold|warm orange|flickering|glowing|glows?|illuminat\w+|backlit|silhouett\w+)\b/gi,
];

function extractLightSources(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of LIGHT_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern.source, 'gi'));
    for (const m of matches) {
      found.add(m[0].toLowerCase().trim());
    }
  }
  return [...found];
}

// ============================================================================
// ENVIRONMENT NOUN DETECTION
// ============================================================================

const ENVIRONMENT_NOUNS = [
  /\b(?:alley|street|road|path|bridge|dock|pier|harbour|harbor|market|square|courtyard|garden|forest|mountain|cliff|coast|beach|shore|sea|ocean|river|lake|valley|desert|field|meadow|hill|rooftop|balcony|gallery|deck|tower|lighthouse|church|temple|castle|ruin|village|city|town)\b/gi,
];

function extractEnvironmentNouns(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of ENVIRONMENT_NOUNS) {
    const matches = text.matchAll(new RegExp(pattern.source, 'gi'));
    for (const m of matches) {
      found.add(m[0].toLowerCase().trim());
    }
  }
  return [...found];
}

// ============================================================================
// OPENER DETECTION — Scene-setting lead-in patterns
// ============================================================================
// Two categories:
//   1. Single-word prepositional/locational — unambiguous scene-setters
//   2. Two-word compound openers — need second-token validation
//
// "Deep in a grove" = opener. "Deep green water" = adjective, NOT opener.
// Two-word matching prevents false positives: "deep" alone is never an opener.
//
// Authority: ChatGPT Session 5 architectural review
// ============================================================================

/** Single-word openers — always scene-setting lead-ins. */
const SINGLE_WORD_OPENERS = new Set([
  'at', 'in', 'on', 'beneath', 'below', 'under', 'above', 'over',
  'beyond', 'behind', 'before', 'across', 'along', 'between', 'among',
  'amid', 'inside', 'outside', 'within', 'through', 'near', 'beside',
  'against', 'during',
]);

/**
 * Two-word compound openers — matched as pairs to prevent false positives.
 * "Deep in" = opener. "Deep green" = adjective (not matched).
 * "Hidden beneath" = opener. "Hidden lantern" = adjective (not matched).
 */
const TWO_WORD_OPENERS: ReadonlyArray<[string, Set<string>]> = [
  // Depth / distance
  ['deep',        new Set(['in', 'within', 'inside', 'beneath', 'below', 'under', 'among', 'amid'])],
  ['far',         new Set(['above', 'beyond', 'below', 'beneath', 'across', 'from'])],
  ['high',        new Set(['above', 'on', 'over', 'atop', 'upon'])],
  ['low',         new Set(['beneath', 'below', 'in', 'over', 'across'])],
  ['half',        new Set(['hidden', 'buried', 'submerged', 'obscured', 'covered', 'lost'])],
  // Participial
  ['surrounded',  new Set(['by'])],
  ['bathed',      new Set(['in', 'beneath', 'under', 'by'])],
  ['lost',        new Set(['in', 'among', 'beneath', 'within'])],
  ['hidden',      new Set(['in', 'beneath', 'behind', 'among', 'within', 'under'])],
  ['perched',     new Set(['on', 'atop', 'above', 'upon', 'over'])],
  ['nestled',     new Set(['among', 'in', 'between', 'beneath', 'within'])],
  ['silhouetted', new Set(['against', 'beneath', 'before', 'in'])],
];

/**
 * Check if text starts with a scene-setting opener (not the subject).
 * Returns 'single' | 'compound' | null.
 */
function detectOpenerType(text: string): 'single' | 'compound' | null {
  const words = text.split(/\s+/);
  const w1 = (words[0] ?? '').toLowerCase();
  const w2 = (words[1] ?? '').toLowerCase();

  if (SINGLE_WORD_OPENERS.has(w1)) return 'single';

  for (const [first, seconds] of TWO_WORD_OPENERS) {
    if (w1 === first && seconds.has(w2)) return 'compound';
  }

  return null;
}

// ============================================================================
// SUBJECT EXTRACTION
// ============================================================================

/** All opener first-words for regex alternation. */
const OPENER_WORDS_PATTERN = [
  // Single-word
  'At', 'In', 'On', 'Beneath', 'Below', 'Under', 'Above', 'Over',
  'Beyond', 'Behind', 'Before', 'Across', 'Along', 'Between', 'Among',
  'Amid', 'Inside', 'Outside', 'Within', 'Through', 'Near', 'Beside',
  'Against', 'During',
  // Compound first-words (second word consumed by [^,]{3,80})
  'Deep', 'Far', 'High', 'Low', 'Half',
  'Surrounded', 'Bathed', 'Lost', 'Hidden', 'Perched', 'Nestled', 'Silhouetted',
].join('|');

/** "[Opener] [setting], a/an/the/one [subject]..." */
const LEADING_SETTING_RE = new RegExp(
  `^(?:${OPENER_WORDS_PATTERN})\\s+(?:[^,]{3,80}),\\s*(?:a|an|the|one)\\s+`,
  'i',
);

/** "At [time] in [place], a [subject]" */
const LEADING_TIME_PLACE_RE = /^(?:At\s+\w+\s+(?:in|on|at)\s+[^,]{3,60}),\s*(?:a|an|the|one)\s+/i;

/** Verbs the subject detection looks for after the noun phrase. */
const SUBJECT_VERB_PATTERN = '(?:pauses?|stands?|sits?|grips?|leans?|rests?|walks?|runs?|holds?|watches?|stares?|gazes?|waits?|crouches?|kneels?|clutches?|reaches?|burns?|rises?|hangs?|floats?|drifts?|glows?|flickers?|looms?|towers?|lies?|sleeps?|faces?|turns?|steps?|emerges?)';

/**
 * Find the primary subject phrase and its position.
 * Returns null if no clear subject found or subject already leading.
 */
function findSubjectPhrase(text: string): {
  phrase: string;
  position: number;
  settingPrefix: string;
} | null {
  if (!detectOpenerType(text)) return null;

  let match = text.match(LEADING_SETTING_RE);
  if (!match) match = text.match(LEADING_TIME_PLACE_RE);
  if (!match) return null;

  const settingPrefix = match[0];
  const afterSetting = text.slice(settingPrefix.length - 2); // keep "a " / "the "

  const subjectRe = new RegExp(
    `^(?:a|an|the|one)\\s+([^,.;:!?]+?)(?=\\s+${SUBJECT_VERB_PATTERN}\\b|,|\\.)`,
    'i',
  );
  const subjectMatch = afterSetting.match(subjectRe);
  if (!subjectMatch) return null;

  const fullSubjectPhrase = subjectMatch[0]!.trim();
  const firstWord = fullSubjectPhrase.split(' ')[0] ?? '';
  const settingWithoutArticle = settingPrefix.slice(0, settingPrefix.length - firstWord.length - 1).replace(/,\s*$/, '').trim();

  return {
    phrase: fullSubjectPhrase,
    position: settingPrefix.length - 2,
    settingPrefix: settingWithoutArticle,
  };
}

// ============================================================================
// ANCHOR EXTRACTION
// ============================================================================

/**
 * Extract a lightweight anchor manifest from the assembled prompt.
 */
export function extractAnchors(text: string): AnchorManifest {
  const colours = extractColours(text);
  const lightSources = extractLightSources(text);
  const environmentNouns = extractEnvironmentNouns(text);

  const subjectInfo = findSubjectPhrase(text);
  const openerType = detectOpenerType(text);

  const verbPattern = /\b(pauses?|stands?|sits?|grips?|leans?|rests?|walks?|runs?|holds?|watches?|stares?|gazes?|waits?|crouches?|kneels?|clutches?|reaches?|pours?|rises?|smash(?:es)?|crash(?:es)?|cuts?|slices?|glows?|flickers?|smears?|streaks?|disappears?|vanish(?:es)?|floats?|drifts?|burns?|hangs?|looms?|towers?|lies?|sleeps?|faces?|turns?|steps?|emerges?)\b/gi;
  const actionVerbs = [...new Set(
    [...text.matchAll(verbPattern)].map(m => m[0].toLowerCase())
  )];

  const anchorCount = colours.length + lightSources.length + environmentNouns.length + actionVerbs.length;

  return {
    subjectPhrase: subjectInfo?.phrase ?? null,
    subjectPosition: subjectInfo?.position ?? 0,
    subjectIsLeading: openerType === null,
    colours,
    lightSources,
    environmentNouns,
    actionVerbs,
    anchorCount,
  };
}

// ============================================================================
// DETERMINISTIC SUBJECT-FRONT-LOADER
// ============================================================================

/**
 * Move the primary subject to the front of the prompt (Pattern A only).
 * Swaps two blocks: opener clause → end, subject+rest → front.
 * All original words preserved. No verb changes. No invented framing.
 * Returns null if not confident → caller falls through to PASS_THROUGH.
 *
 * SAFETY:
 * - Only operates on sentence 1
 * - Requires article-led subject (a/an/the/one)
 * - Rejects weight syntax (::, (term:1.3), --flags)
 * - Rejects multi-subject before main verb ("a fox and a priest")
 * - Pattern A only: opener moves to end, no internal restructuring
 */
export function reorderSubjectFirst(text: string): {
  reordered: string;
  changes: string[];
} | null {
  // Already front-loaded — nothing to do
  if (!detectOpenerType(text)) return null;

  // Reject syntax-sensitive prompts
  if (/::[\d.]|\([^()]+:\d+\.?\d*\)|--(?:ar|v|s|no|stylize)\b/.test(text)) {
    return null;
  }

  // Sentence 1 only
  const firstSentenceEnd = text.search(/\.\s+[A-Z]/);
  const firstSentence = firstSentenceEnd > 0
    ? text.slice(0, firstSentenceEnd + 1)
    : (text.split('.')[0] ?? text) + '.';
  const restOfText = firstSentenceEnd > 0
    ? text.slice(firstSentenceEnd + 1).trim()
    : '';

  // Match: "[Opener clause], a/an/the/one [subject+rest]."
  const matchRe = new RegExp(
    `^((?:${OPENER_WORDS_PATTERN})\\s+[^,]{3,80}),\\s+(a|an|the|one)\\s+(.+)$`,
    'is',
  );
  let match = firstSentence.match(matchRe);

  // Also try time+place: "At midnight in a shrine, a fox..."
  if (!match) {
    match = firstSentence.match(
      /^(At\s+\w+\s+(?:in|on|at)\s+[^,]{3,60}),\s+(a|an|the|one)\s+(.+)$/is,
    );
  }

  if (!match) return null;

  const settingClause = (match[1] ?? '').trim();
  const article = match[2] ?? 'a';
  const subjectAndRest = (match[3] ?? '').trim();

  if (!settingClause || !subjectAndRest) return null;

  // Reject multi-subject ambiguity: "a fox and a priest" before the main verb
  const preVerbRe = new RegExp(`^(.+?)\\b${SUBJECT_VERB_PATTERN}\\b`, 'i');
  const preVerbMatch = subjectAndRest.match(preVerbRe);
  const preVerbText = preVerbMatch ? preVerbMatch[1] ?? '' : '';
  if (/\band\s+(?:a|an|the|one)\s+/i.test(preVerbText)) {
    return null;
  }

  // Pattern A: swap opener to end, subject+rest to front
  const capitalArticle = article.charAt(0).toUpperCase() + article.slice(1);
  const lowerSetting = settingClause.charAt(0).toLowerCase() + settingClause.slice(1);
  const cleanSubjectAndRest = subjectAndRest.replace(/\.\s*$/, '');

  const reorderedFirst = `${capitalArticle} ${cleanSubjectAndRest} ${lowerSetting}.`;

  const reordered = restOfText
    ? `${reorderedFirst} ${restOfText}`
    : reorderedFirst;

  return {
    reordered: reordered.trim(),
    changes: [
      'Subject front-loaded (deterministic reorder)',
      `Moved "${settingClause}" after subject`,
    ],
  };
}

// ============================================================================
// DECISION ENGINE
// ============================================================================

/**
 * Analyse the assembled prompt and decide what kind of optimisation it needs.
 *
 * Decision priority:
 *   1. Config-driven mode (call3Mode) is the primary signal
 *   2. Structural analysis refines the decision within that mode
 *
 * For reorder_only mode:
 *   - If subject is already front-loaded → PASS_THROUGH
 *   - If subject can be moved deterministically → REORDER_ONLY
 *   - If reorder fails confidence check → PASS_THROUGH (not GPT)
 *
 * For format_only mode:
 *   - Always FORMAT_ONLY (group gate handles it)
 *
 * For gpt_rewrite mode:
 *   - If prompt exceeds hardCeiling → COMPRESS (GPT needed)
 *   - Otherwise → GPT_REWRITE
 */
export function analyseOptimisationNeed(
  prompt: string,
  call3Mode: Call3Mode,
  hardCeiling: number,
  anchors: AnchorManifest,
): Call3Decision {
  // ── Config-driven routing ────────────────────────────────────────────
  switch (call3Mode) {
    case 'pass_through':
      return 'PASS_THROUGH';

    case 'reorder_only': {
      // Subject already leads — nothing to do
      if (anchors.subjectIsLeading) {
        return 'PASS_THROUGH';
      }
      // Try deterministic reorder — if confidence is high, reorder; if low, pass through
      const reorderResult = reorderSubjectFirst(prompt);
      if (reorderResult) {
        return 'REORDER_ONLY';
      }
      // Reorder not confident — don't fall through to GPT, just pass through
      return 'PASS_THROUGH';
    }

    case 'format_only':
      return 'FORMAT_ONLY';

    case 'mj_deterministic': {
      // Parse and validate Midjourney structure
      const parsed = parseMjPrompt(prompt);
      const validation = validateMjStructure(parsed);
      // If structure is valid (has weighted clauses, params), deterministic is enough
      if (parsed.isValid && validation.isValid) {
        return 'MJ_DETERMINISTIC_ONLY';
      }
      // Structure is broken — GPT needed to restructure
      return 'GPT_REWRITE';
    }

    case 'gpt_rewrite': {
      // Check if compression is needed first
      if (prompt.length > hardCeiling) {
        return 'COMPRESS_ONLY';
      }
      return 'GPT_REWRITE';
    }

    default:
      return 'GPT_REWRITE';
  }
}
