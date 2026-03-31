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
// SUBJECT EXTRACTION
// ============================================================================

// Common leading prepositional/temporal patterns that bury the subject
const LEADING_SETTING_RE = /^(?:At|In|On|During|Beneath|Under|Above|Across|Beyond|Through|Amid|Among|Beside|Near|Against|Within)\s+(?:[^,]{3,80}),\s*(?:a|an|the)\s+/i;

// Alternative: leading "At [time] in [place], a [subject]"
const LEADING_TIME_PLACE_RE = /^(?:At\s+\w+\s+(?:in|on|at)\s+[^,]{3,60}),\s*(?:a|an|the)\s+/i;

/**
 * Find the primary subject phrase and its position.
 * Returns null if no clear subject is found or subject is already leading.
 */
function findSubjectPhrase(text: string): {
  phrase: string;
  position: number;
  settingPrefix: string;
} | null {
  // Check if subject is already at the front (no leading preposition)
  const startsWithSetting = /^(?:at|in|on|during|beneath|under|above|across|beyond|through|amid|among|beside|near|against|within)\s/i.test(text);

  if (!startsWithSetting) {
    // Subject is likely already front-loaded
    return null;
  }

  // Try to match "At/In/On [setting], a/an/the [subject]..."
  let match = text.match(LEADING_SETTING_RE);
  if (!match) {
    match = text.match(LEADING_TIME_PLACE_RE);
  }

  if (!match) {
    // Pattern doesn't match — don't guess, return null
    return null;
  }

  const settingPrefix = match[0];
  // The subject starts right after the article
  const afterSetting = text.slice(settingPrefix.length - 2); // keep "a " / "the "
  
  // Find the subject noun phrase — take up to the next verb or comma
  // This is deliberately conservative: take the article + noun phrase up to the first
  // natural break (comma, period, verb-like word after 3+ words)
  const subjectMatch = afterSetting.match(/^(?:a|an|the)\s+([^,.;:!?]+?)(?=\s+(?:pauses?|stands?|sits?|grips?|leans?|rests?|walks?|runs?|holds?|watches?|stares?|gazes?|waits?|crouches?|kneels?|clutches?|reaches?)\b|,|\.)/i);

  if (!subjectMatch) {
    return null;
  }

  const fullSubjectPhrase = subjectMatch[0]!.trim();
  const firstWord = fullSubjectPhrase.split(' ')[0] ?? '';
  const settingWithoutArticle = settingPrefix.slice(0, settingPrefix.length - firstWord.length - 1).replace(/,\s*$/, '').trim();

  return {
    phrase: fullSubjectPhrase,
    position: settingPrefix.length - 2, // where "a/an/the [subject]" starts
    settingPrefix: settingWithoutArticle,
  };
}

// ============================================================================
// ANCHOR EXTRACTION
// ============================================================================

/**
 * Extract a lightweight anchor manifest from the assembled prompt.
 * Used by the decision engine and (later) the regression guard.
 */
export function extractAnchors(text: string): AnchorManifest {
  const colours = extractColours(text);
  const lightSources = extractLightSources(text);
  const environmentNouns = extractEnvironmentNouns(text);

  // Find subject
  const subjectInfo = findSubjectPhrase(text);
  const startsWithSetting = /^(?:at|in|on|during|beneath|under|above)\s/i.test(text);

  // Extract action verbs (simple: common image-prompt verbs)
  const verbPattern = /\b(pauses?|stands?|sits?|grips?|leans?|rests?|walks?|runs?|holds?|watches?|stares?|gazes?|waits?|crouches?|kneels?|clutches?|reaches?|pours?|rises?|smash(?:es)?|crash(?:es)?|cuts?|slices?|glows?|flickers?|smears?|streaks?|disappears?|vanish(?:es)?|floats?|drifts?)\b/gi;
  const actionVerbs = [...new Set(
    [...text.matchAll(verbPattern)].map(m => m[0].toLowerCase())
  )];

  const anchorCount = colours.length + lightSources.length + environmentNouns.length + actionVerbs.length;

  return {
    subjectPhrase: subjectInfo?.phrase ?? null,
    subjectPosition: subjectInfo?.position ?? 0,
    subjectIsLeading: !startsWithSetting,
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
 * Move the primary subject to the front of the prompt.
 * Preserves all original words, sentence structure, and punctuation.
 * Returns null if reorder is not possible or not confident.
 *
 * CONSERVATIVE: only operates when there's a clear leading setting clause
 * followed by an article + subject. If the pattern doesn't match cleanly,
 * returns null and the caller should fall through to PASS_THROUGH or GPT.
 */
export function reorderSubjectFirst(text: string): {
  reordered: string;
  changes: string[];
} | null {
  // Already front-loaded — nothing to do
  if (!/^(?:at|in|on|during|beneath|under|above|across|beyond|through|amid|among)\s/i.test(text)) {
    return null;
  }

  // Find the first sentence break
  const firstSentenceEnd = text.search(/\.\s+[A-Z]/);
  const firstSentence = firstSentenceEnd > 0 ? text.slice(0, firstSentenceEnd + 1) : (text.split('.')[0] ?? text) + '.';
  const restOfText = firstSentenceEnd > 0 ? text.slice(firstSentenceEnd + 1).trim() : '';

  // Match pattern: "[Setting clause], a/an/the [subject] [rest of sentence]."
  const match = firstSentence.match(
    /^((?:At|In|On|During|Beneath|Under|Above|Across|Beyond|Through|Amid|Among)\s+[^,]{3,80}),\s+(a|an|the)\s+(.+)$/is
  );

  if (!match) {
    return null;
  }

  const settingClause = (match[1] ?? '').trim(); // "At midnight in a cramped cyberpunk alley"
  const article = match[2] ?? 'a';              // "a"
  const subjectAndRest = (match[3] ?? '').trim(); // "rain-drenched courier pauses under..."

  if (!settingClause || !subjectAndRest) {
    return null;
  }

  // Reconstruct: "[Article] [subject and rest] [setting clause]."
  // Capitalise the article, lowercase the setting start
  const capitalArticle = article.charAt(0).toUpperCase() + article.slice(1);
  const lowerSetting = settingClause.charAt(0).toLowerCase() + settingClause.slice(1);

  // Remove trailing period from subjectAndRest if present (we'll add it back)
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
