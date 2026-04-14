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
//   T1: P13 (weight cap 8) → P2 (strip punctuation) → P14 (weight wrap ≤4 words)
//   T2: P1 (dedup MJ params)
//   T3: P15 (over-length truncation 280–420)
//   T4: P3 (self-correction) → P8 (meta-openers) → P10 (short sentence merge)
//       → P16 (over-length truncation ≤325) → P19 (retention safety guard)
//
// v4.5.1 additions (10 Apr 2026):
//   P14 — T1 weight-wrap enforcement (4-word limit, 2-word-tail heuristic)
//   P15 — T3 over-length truncation (280–420 char range)
//   P16 — T4 over-length truncation (≤325 chars)
//
// v4.5.2 additions (14 Apr 2026):
//   P19 — T4 retention safety guard
//     - repairs weak retained openers ("And", "While", "With")
//     - merges sub-10-word trailing fragments after retention
//     - trims fragment-like tails created by compression
//     - preserves anchor-rich wording rather than redesigning T4
//
// v4.5.3 additions (14 Apr 2026):
//   P20 — Priority-aware retention pass for T3/T4 before truncation
//     - protects anchor-bearing clauses before length reduction
//     - preserves subject, action, environment, interaction, lighting
//     - trims lower-value filler before scene anchors
//
// Removed (prompt now handles these — tested and confirmed no regression):
//   P11 (T3 meta-commentary opener fixer) — removed 28 Mar 2026
//   P12 (T1 CLIP qualitative adjective stripper) — removed 28 Mar 2026
//
// Authority: harmonizing-claude-openai.md §6, §10
//            call-2-quality-architecture-v0_3_1_1.md §3 (Stage B)
// Test file: src/lib/__tests__/call-2-post-processing-fixes.test.ts
// ============================================================================

import { enforceWeightCap } from "@/lib/harmony-compliance";

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

  let ar = "";
  const arMatches = [...paramSection.matchAll(/--ar\s+(\d+:\d+)/g)];
  if (arMatches.length > 0) ar = arMatches[arMatches.length - 1]?.[1] ?? "";

  let v = "";
  const vMatches = [...paramSection.matchAll(/--v\s+(\d+)/g)];
  if (vMatches.length > 0) v = vMatches[vMatches.length - 1]?.[1] ?? "";

  let s = "";
  const sMatches = [...paramSection.matchAll(/--s\s+(\d+)/g)];
  if (sMatches.length > 0) s = sMatches[sMatches.length - 1]?.[1] ?? "";

  const noBlocks = [...paramSection.matchAll(/--no\s+([^-]+?)(?=\s+--|$)/g)];
  const allNoTerms: string[] = [];
  const seen = new Set<string>();
  for (const block of noBlocks) {
    const terms = (block[1] ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    for (const term of terms) {
      const lower = term.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        allNoTerms.push(term);
      }
    }
  }

  const termSetLower = new Set(allNoTerms.map((t) => t.toLowerCase()));
  const fusionIndices: number[] = [];
  for (let i = 0; i < allNoTerms.length; i++) {
    const words = allNoTerms[i]!.toLowerCase().split(/\s+/);
    if (words.length <= 2) continue;
    for (let splitAt = 1; splitAt < words.length; splitAt++) {
      const firstPart = words.slice(0, splitAt).join(" ");
      const secondPart = words.slice(splitAt).join(" ");
      if (termSetLower.has(firstPart) && termSetLower.has(secondPart)) {
        fusionIndices.push(i);
        break;
      }
    }
  }
  for (let i = fusionIndices.length - 1; i >= 0; i--) {
    allNoTerms.splice(fusionIndices[i]!, 1);
  }

  if (allNoTerms.length > 0) {
    const last = allNoTerms[allNoTerms.length - 1];
    if (last) {
      allNoTerms[allNoTerms.length - 1] = last.replace(/[.!?]+$/, "").trim();
    }
  }

  const parts = [prose];
  if (ar) parts.push(`--ar ${ar}`);
  if (v) parts.push(`--v ${v}`);
  if (s) parts.push(`--s ${s}`);
  if (allNoTerms.length > 0) parts.push(`--no ${allNoTerms.join(", ")}`);

  return parts.join(" ");
}

// ============================================================================
// P2: T1 Trailing Punctuation Stripper
// ============================================================================

/**
 * P2: Strip trailing sentence punctuation from CLIP prompts.
 * CLIP prompts are comma-separated keyword lists — no periods.
 */
export function stripTrailingPunctuation(prompt: string): string {
  return prompt.replace(/[.!?]+\s*$/, "").trimEnd();
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
  const cleaned = prompt.replace(/[^.!?]*\?\s*No[,—–\s]+it\s+is\s+/gi, "");

  if (cleaned === prompt) return prompt;

  return cleaned
    .replace(
      /([.!?])([a-z])/g,
      (_m, p: string, c: string) => `${p} ${c.toUpperCase()}`,
    )
    .replace(/^\s*([a-z])/, (_m, c: string) => c.toUpperCase())
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ============================================================================
// P8: T4 Meta-Language Opener Fixer (broadened)
// ============================================================================

/** Abstract nouns GPT uses as meta-language sentence subjects in T4 */
export const T4_ABSTRACT_NOUNS = new Set([
  "scene",
  "room",
  "space",
  "place",
  "setting",
  "environment",
  "stillness",
  "silence",
  "atmosphere",
  "mood",
  "feeling",
  "sense",
  "quality",
  "tone",
  "air",
  "ambience",
  "light",
  "darkness",
  "void",
  "depth",
  "world",
  "landscape",
  "view",
]);

/** Meta-verbs GPT pairs with abstract nouns in T4 */
export const T4_META_VERBS = new Set([
  "is",
  "was",
  "has",
  "feels",
  "carries",
  "holds",
  "evokes",
  "suggests",
  "conveys",
  "captures",
  "reveals",
  "radiates",
  "exudes",
  "breathes",
  "embodies",
  "projects",
  "creates",
  "gives",
  "lends",
  "shows",
  "presents",
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
      const noun = (match[1] ?? "").toLowerCase();
      const verb = (match[2] ?? "").toLowerCase();

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

  return fixed.join(" ").trim();
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
  const wordCount = lastSentence.split(/\s+/).filter(Boolean).length;

  if (wordCount >= 10) return prompt;

  const prev = sentences[sentences.length - 2]!.replace(
    /[.!?]+$/,
    "",
  ).trimEnd();
  const shortContent = lastSentence.replace(/[.!?]+$/, "").trim();
  const lowered = shortContent.charAt(0).toLowerCase() + shortContent.slice(1);
  const merged = `${prev} — ${lowered}.`;

  const result = [...sentences.slice(0, -2), merged];
  return result.join(" ").trim();
}

// ============================================================================
// P14: T1 Weight-Wrap Enforcement (≤4 words)
// ============================================================================

const PAREN_WEIGHT_RE_GLOBAL = /\(([^):]+):([\d.]+)\)/g;

function countWeightWords(phrase: string): number {
  return phrase.trim().split(/\s+/).filter(Boolean).length;
}

const WEIGHT_STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "through",
  "across",
  "under",
  "over",
  "into",
  "onto",
  "upon",
  "between",
  "among",
  "for",
  "as",
]);

function isWeightStopWord(word: string): boolean {
  return WEIGHT_STOP_WORDS.has(word.toLowerCase());
}

export interface WeightWrapResult {
  text: string;
  fixes: string[];
  skipped: string[];
}

function findNounAnchorTail(
  words: string[],
): { tail: string; prefixWords: string[] } | null {
  const maxTail = Math.min(4, words.length - 1);

  for (let tailLen = 2; tailLen <= maxTail; tailLen++) {
    const tailStart = words.length - tailLen;
    const firstTailWord = words[tailStart];

    if (firstTailWord && !isWeightStopWord(firstTailWord)) {
      return {
        tail: words.slice(tailStart).join(" "),
        prefixWords: words.slice(0, tailStart),
      };
    }
  }

  return null;
}

export function enforceT1WeightWrap(text: string): WeightWrapResult {
  const fixes: string[] = [];
  const skipped: string[] = [];

  const hasNestedParens = /\([^)]*\([^)]*\)/.test(text);
  if (hasNestedParens) {
    skipped.push(
      "Nested parentheses detected — skipping weight-wrap enforcement",
    );
    return { text, fixes, skipped };
  }

  const result = text.replace(
    PAREN_WEIGHT_RE_GLOBAL,
    (fullMatch, phrase: string, weight: string) => {
      const trimmedPhrase = phrase.trim();
      const wordCount = countWeightWords(trimmedPhrase);

      if (wordCount <= 4) return fullMatch;

      const words = trimmedPhrase.split(/\s+/);

      if (words.length < 3) {
        skipped.push(`Unexpected word split for "${trimmedPhrase}" — skipping`);
        return fullMatch;
      }

      const anchor = findNounAnchorTail(words);

      if (!anchor) {
        const unwrapped = trimmedPhrase;
        fixes.push(
          `"(${trimmedPhrase}:${weight})" → "${unwrapped}" [unwrapped — no valid noun tail]`,
        );
        return unwrapped;
      }

      const meaningfulPrefix = anchor.prefixWords.filter(
        (w) => !isWeightStopWord(w),
      );

      let fixed: string;
      if (meaningfulPrefix.length > 0) {
        fixed = `${meaningfulPrefix.join(", ")}, (${anchor.tail}:${weight})`;
      } else {
        fixed = `(${anchor.tail}:${weight})`;
      }

      fixes.push(`"(${trimmedPhrase}:${weight})" → "${fixed}"`);
      return fixed;
    },
  );

  return { text: result, fixes, skipped };
}

// ============================================================================
// P17/P18: T3/T4 deterministic language cleanups
// ============================================================================

export interface TextCleanupResult {
  text: string;
  fixes: string[];
}

const T3_PHOTOGRAPHY_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /\b\d{1,3}\s*mm\s+Leica\b/gi,
    "through a wide natural frame with clinical sharpness and rich tonal depth",
  ],
  [
    /\bLeica\s+(?:M\d{1,2}|SL\d?-?\w*|Q\d?)\b/gi,
    "rendered with clinical sharpness, natural colour and fine micro-contrast",
  ],
  [
    /\bCanon\s+(?:EOS\s*)?(?:R\d|[567]D)\b/gi,
    "captured with warm natural colour and smooth skin-like rendering",
  ],
  [
    /\bNikon\s+(?:Z\d|D\d{3,4})\b/gi,
    "rendered with neutral precision and strong tonal range",
  ],
  [/\bSony\s+A\d{4}\b/gi, "with saturated vivid colour and razor-fine detail"],
  [
    /\bHasselblad\b/gi,
    "with medium-format depth, vast tonal range and quiet naturalistic colour",
  ],
  [
    /\b24\s*mm\s*(?:lens)?\b/gi,
    "an expansive wide-angle view pulling the whole scene in",
  ],
  [
    /\b35\s*mm\s*(?:lens)?\b/gi,
    "a natural wide view with honest spatial proportions",
  ],
  [/\b50\s*mm\s*(?:lens)?\b/gi, "a natural human-eye perspective"],
  [
    /\b85\s*mm\s*(?:lens)?\b/gi,
    "a tighter compressed view that isolates the subject",
  ],
  [
    /\b(?:70\s*-?\s*200|100\s*-?\s*400)\s*mm\b/gi,
    "telephoto compression pulling distant detail close and flattening depth",
  ],
  [
    /\b\d{3}\s*mm\b/gi,
    "heavily compressed distant detail stacked in narrow depth",
  ],
  [
    /\bf\/?\s*1\.2\b/gi,
    "extremely shallow focus with dreamlike separation from the background",
  ],
  [
    /\bf\/?\s*1\.4\b/gi,
    "soft background separation melting detail behind the subject",
  ],
  [/\bf\/?\s*1\.8\b/gi, "gentle background softening"],
  [/\bf\/?\s*2\.8\b/gi, "moderate background softening with a sense of depth"],
  [/\bf\/?\s*(?:4|5\.6)\b/gi, "balanced sharpness across the frame"],
  [/\bf\/?\s*(?:8|11|16)\b/gi, "deep sharpness from foreground to distance"],
  [
    /\bISO\s*\d{2,3}\b/gi,
    "clean grain-free detail with smooth shadow transitions",
  ],
  [/\bISO\s*\d{4,6}\b/gi, "visible grain lending a raw documentary texture"],
  [/\bdeep focus\b/gi, "sharp from foreground to distance"],
  [
    /\bshallow depth of field\b/gi,
    "the subject stays crisp while the background falls softly away",
  ],
  [
    /\bmoderate depth of field\b/gi,
    "the focal point is clear with gentle softening beyond it",
  ],
  [
    /\bkeeping the background crisp\b/gi,
    "distant detail remains clearly legible",
  ],
  [
    /\bbackground (?:stays|remaining|remains) crisp\b/gi,
    "distant detail remains clearly legible",
  ],
  [/\bsharp focus\b/gi, "edges and textures resolve clearly"],
];

const T4_PHOTOGRAPHY_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /\b\d{1,3}\s*mm\s+Leica\b/gi,
    "a wide natural view that looks very sharp and lifelike",
  ],
  [
    /\bLeica\s+(?:M\d{1,2}|SL\d?-?\w*|Q\d?)\b/gi,
    "very sharp with natural lifelike colours",
  ],
  [
    /\bCanon\s+(?:EOS\s*)?(?:R\d|[567]D)\b/gi,
    "sharp with warm natural colours",
  ],
  [/\bNikon\s+(?:Z\d|D\d{3,4})\b/gi, "sharp with smooth even tones"],
  [/\bSony\s+A\d{4}\b/gi, "bright vivid colours with very fine detail"],
  [/\bHasselblad\b/gi, "extraordinarily detailed with rich subtle tones"],
  [/\b24\s*mm\s*(?:lens)?\b/gi, "wide-angle view taking in the whole scene"],
  [/\b35\s*mm\s*(?:lens)?\b/gi, "natural wide view"],
  [
    /\b50\s*mm\s*(?:lens)?\b/gi,
    "natural perspective like your own eyes see it",
  ],
  [
    /\b85\s*mm\s*(?:lens)?\b/gi,
    "zoomed-in portrait view that isolates the subject",
  ],
  [
    /\b(?:70\s*-?\s*200|100\s*-?\s*400)\s*mm\b/gi,
    "far-away detail brought up close",
  ],
  [/\b\d{3}\s*mm\b/gi, "tight zoom on distant detail"],
  [
    /\bf\/?\s*1\.[24]\b/gi,
    "very blurry background with the subject standing out sharply",
  ],
  [/\bf\/?\s*1\.8\b/gi, "softly blurred background"],
  [/\bf\/?\s*2\.8\b/gi, "slightly blurred background"],
  [/\bf\/?\s*(?:4|5\.6)\b/gi, "mostly sharp from front to back"],
  [/\bf\/?\s*(?:8|11|16)\b/gi, "everything sharp from near to far"],
  [/\bISO\s*\d{2,3}\b/gi, "clean smooth image with no grain"],
  [/\bISO\s*\d{4,6}\b/gi, "slightly grainy with a film-like feel"],
  [/\bdeep focus\b/gi, "sharp front to back"],
  [/\bshallow depth of field\b/gi, "soft background"],
  [/\bmoderate depth of field\b/gi, "gentle background softening"],
  [/\bkeeping the background crisp\b/gi, "clear distance detail"],
  [
    /\bbackground (?:stays|remaining|remains) crisp\b/gi,
    "clear distance detail",
  ],
  [/\bsharp focus\b/gi, "clear detail"],
];

export function convertPhotographyJargonTierAware(
  tier: "tier3" | "tier4",
  text: string,
): TextCleanupResult {
  const conversions =
    tier === "tier3" ? T3_PHOTOGRAPHY_CONVERSIONS : T4_PHOTOGRAPHY_CONVERSIONS;
  let next = text;
  const fixes: string[] = [];

  for (const [pattern, replacement] of conversions) {
    pattern.lastIndex = 0;
    if (pattern.test(next)) {
      next = next.replace(pattern, replacement);
      fixes.push(`${pattern} → ${replacement}`);
    }
  }

  return { text: next, fixes };
}

const T3_BANNED_PHRASE_REWRITES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bthe mood is\s+/gi, ""],
  [/\bthe scene feels\s+/gi, ""],
  [/\bthe scene is\s+/gi, ""],
  [/\bthat feels\s+/gi, ""],
  [/\bin the style of\s+/gi, ""],
  [/\brendered as\s+/gi, ""],
];

export function stripOrRewriteT3BannedPhrases(text: string): TextCleanupResult {
  let next = text;
  const fixes: string[] = [];
  for (const [pattern, replacement] of T3_BANNED_PHRASE_REWRITES) {
    pattern.lastIndex = 0;
    if (pattern.test(next)) {
      next = next.replace(pattern, replacement);
      fixes.push(pattern.toString());
    }
  }
  next = next.replace(/\s{2,}/g, " ").trim();
  return { text: next, fixes };
}

const T3_BANNED_TAIL_PATTERNS: ReadonlyArray<RegExp> = [
  /,?\s*captured in [^.]+\.?$/i,
  /,?\s*captured like [^.]+\.?$/i,
  /,?\s*shot with [^.]+\.?$/i,
  /,?\s*all framed in [^.]+\.?$/i,
  /,?\s*in cinematic [^.]+\.?$/i,
];

export function stripT3BannedTailConstructions(
  text: string,
): TextCleanupResult {
  let next = text;
  const fixes: string[] = [];
  for (const pattern of T3_BANNED_TAIL_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(next)) {
      next = next.replace(pattern, ".");
      fixes.push(pattern.toString());
    }
  }
  next = next
    .replace(/\s+\./g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { text: next, fixes };
}

// ============================================================================
// P15: T3 Over-Length Truncation (280–420 chars)
// ============================================================================

const T3_MAX = 420;
const T3_MIN = 280;
const T3_HARD_MIN = 220;

const T3_UNDERLENGTH_CLAUSES: ReadonlyArray<string> = [
  "The scene remains visually grounded and easy to read.",
  "The image stays coherent, direct, and visually clear.",
  "The overall view remains natural, legible, and visually grounded.",
];

type AnchorClass =
  | "subject"
  | "action"
  | "environment"
  | "interaction"
  | "lighting";

interface RetentionClause {
  sentenceIndex: number;
  clauseIndex: number;
  globalIndex: number;
  text: string;
  lowered: string;
  score: number;
  tags: Set<AnchorClass>;
}

const ACTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:stand|stands|standing|sit|sits|sitting|walk|walks|walking|run|runs|running|pedal|pedals|pedalling|drive|drives|driving|glide|glides|gliding|float|floats|floating|hammer|hammers|hammering|reach|reaches|reaching|grip|grips|gripping|hold|holds|holding|lean|leans|leaning|scatter|scatters|scattering|laugh|laughs|laughing|surge|surges|surging|smash|smashes|smashing|crash|crashes|crashing|slam|slams|slamming|cut|cuts|cutting|slice|slices|slicing|glow|glows|glowing|rise|rises|rising|fall|falls|falling|push|pushes|pushing|crowd|crowds|crowding|jostle|jostles|jostling|flicker|flickers|flickering|spray|sprays|spraying|fly|flies|flying)\b/i,
];

const ENVIRONMENT_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:sky|street|lane|square|intersection|deck|gallery|village|cliff|cliffs|rock|rocks|reef|coral|tower|forge|anvil|asphalt|paving|water|ocean|wave|waves|surface|space|planet|earth|building|buildings|pad|cosmodrome|concrete|window|windows|depth|night|twilight|morning|evening|overcast|rain|mist|drizzle|wind|storm|fire|embers|smoke|smoky|city|road|harbour|shore|sea)\b/i,
];

const INTERACTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:through|toward|towards|against|around|across|between|above|below|beside|alongside|under|over)\b/i,
  /\b(?:crowd|crowds|crowding|jostle|jostles|jostling|grip|grips|gripping|reach|reaches|reaching|cut|cuts|slice|slices|smash|smashes|smashing|crash|crashes|crashing|slam|slams|slamming|push|pushes|pushing|force|forces|forcing|trail|trails|trailing|scatter|scatters|scattering|flicker|flickers|flickering)\b/i,
];

const LIGHTING_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:light|sunlight|sun|glow|beam|lit|lighting|shadow|shadows|bright|dark|orange|gold|golden|blue|magenta|cyan|violet|purple|misty|gloom|firelit|overcast|twilight|morning|evening|night)\b/i,
];

const LOW_VALUE_RETENTION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\s*(?:and|while|with)\s+/i, ""],
  [
    /^\s*the whole (?:site|scene|moment|place|view|image) (?:feels|stays|remains)\s+/i,
    "",
  ],
  [/^\s*the frame (?:stays|keeps)\s+/i, ""],
  [/^\s*the overall view (?:stays|remains)\s+/i, ""],
  [/^\s*in a wide [^,]+ view,?\s*/i, ""],
  [/^\s*from a [^,]+ view,?\s*/i, ""],
  [/\bthe whole (?:site|scene|moment|place) feels\b/gi, "feels"],
  [/\bthe whole (?:moment|site|scene|place) stays\b/gi, "stays"],
  [/\bwide desolate view\b/gi, "desolate view"],
  [/\bwide underwater view\b/gi, "underwater view"],
  [/\beye-level documentary view\b/gi, "eye-level view"],
  [/\bsmall schools of fish\b/gi, "small fish"],
  [/\s{2,}/g, " "],
];

export interface TruncationResult {
  text: string;
  truncated: boolean;
  method?:
    | "sentence"
    | "clause"
    | "whitespace"
    | "comma-fallback"
    | "underlength-rescue"
    | "priority-retention";
  originalLength?: number;
}

function appendSentence(base: string, sentence: string): string {
  const trimmedBase = base.trim();
  const trimmedSentence = sentence.trim();
  if (!trimmedSentence) return trimmedBase;

  const normalisedBase = /[.!?]$/.test(trimmedBase)
    ? trimmedBase
    : `${trimmedBase}.`;

  return `${normalisedBase} ${trimmedSentence}`.replace(/\s{2,}/g, " ").trim();
}

function rescueUnderlengthT3(text: string): TruncationResult {
  if (text.length >= T3_HARD_MIN) {
    return { text, truncated: false };
  }

  const originalLength = text.length;
  let next = text.trim();

  for (const clause of T3_UNDERLENGTH_CLAUSES) {
    if (next.length >= T3_HARD_MIN) break;
    if (next.toLowerCase().includes(clause.toLowerCase())) continue;
    next = appendSentence(next, clause);
  }

  if (next.length < T3_HARD_MIN) {
    next = appendSentence(
      next,
      "The framing stays simple and visually consistent.",
    );
  }

  if (next.length > T3_MAX) {
    const trimmed = truncateAtWhitespace(next, T3_MAX) ?? next.slice(0, T3_MAX);
    return {
      text: `${trimmed.trimEnd()}.`,
      truncated: true,
      method: "underlength-rescue",
      originalLength,
    };
  }

  return {
    text: next,
    truncated: true,
    method: "underlength-rescue",
    originalLength,
  };
}

function sentenceSplit(text: string): string[] {
  return (
    text
      .match(/[^.!?]+[.!?]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [text.trim()]
  );
}

function clauseSplit(sentence: string): string[] {
  return sentence
    .split(/,\s+|;\s+|\s+—\s+/)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function classifyRetentionClause(
  clause: string,
  sentenceIndex: number,
  clauseIndex: number,
  globalIndex: number,
): RetentionClause {
  const lowered = clause.toLowerCase();
  const tags = new Set<AnchorClass>();

  if (sentenceIndex === 0 || globalIndex === 0) {
    tags.add("subject");
  }

  for (const pattern of ACTION_PATTERNS) {
    if (pattern.test(clause)) {
      tags.add("action");
      break;
    }
  }

  for (const pattern of ENVIRONMENT_PATTERNS) {
    if (pattern.test(clause)) {
      tags.add("environment");
      break;
    }
  }

  for (const pattern of INTERACTION_PATTERNS) {
    if (pattern.test(clause)) {
      tags.add("interaction");
      break;
    }
  }

  for (const pattern of LIGHTING_PATTERNS) {
    if (pattern.test(clause)) {
      tags.add("lighting");
      break;
    }
  }

  let score = 0;

  if (globalIndex === 0) score += 12;
  if (sentenceIndex === 0) score += 4;
  if (tags.has("subject")) score += 8;
  if (tags.has("action")) score += 7;
  if (tags.has("environment")) score += 6;
  if (tags.has("interaction")) score += 5;
  if (tags.has("lighting")) score += 4;

  score += Math.min(
    4,
    Math.floor(clause.split(/\s+/).filter(Boolean).length / 5),
  );

  return {
    sentenceIndex,
    clauseIndex,
    globalIndex,
    text: clause,
    lowered,
    score,
    tags,
  };
}

function buildRetentionClauses(text: string): RetentionClause[] {
  const clauses: RetentionClause[] = [];
  let globalIndex = 0;

  sentenceSplit(text).forEach((sentence, sentenceIndex) => {
    clauseSplit(sentence).forEach((clause, clauseIndex) => {
      clauses.push(
        classifyRetentionClause(
          clause,
          sentenceIndex,
          clauseIndex,
          globalIndex,
        ),
      );
      globalIndex += 1;
    });
  });

  return clauses;
}

function tightenRetentionClause(clause: string): string {
  let next = clause.trim();

  for (const [pattern, replacement] of LOW_VALUE_RETENTION_PATTERNS) {
    next = next.replace(pattern, replacement);
  }

  return next
    .replace(/^\s*[,-]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderRetentionText(
  clauses: RetentionClause[],
  tightened: boolean,
): string {
  const grouped = new Map<number, string[]>();

  for (const clause of clauses) {
    const rendered = tightened
      ? tightenRetentionClause(clause.text)
      : clause.text.trim();
    if (!rendered) continue;

    const existing = grouped.get(clause.sentenceIndex) ?? [];
    existing.push(rendered);
    grouped.set(clause.sentenceIndex, existing);
  }

  const sentences = [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, parts]) => {
      const sentence = parts
        .join(", ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (!sentence) return "";

      const capped = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      return /[.!?]$/.test(capped) ? capped : `${capped}.`;
    })
    .filter(Boolean);

  return sentences
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildPriorityRetentionVariant(
  text: string,
  maxLen: number,
  minLen = 0,
): string | null {
  const clauses = buildRetentionClauses(text);
  if (clauses.length < 3) return null;

  const byPriority = [...clauses].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.globalIndex - b.globalIndex;
  });

  const selected = new Set<number>();
  selected.add(0);

  const requiredTags: AnchorClass[] = [
    "action",
    "environment",
    "interaction",
    "lighting",
  ];

  for (const tag of requiredTags) {
    const match = byPriority.find((clause) => clause.tags.has(tag));
    if (match) selected.add(match.globalIndex);
  }

  const buildSelectedClauses = (): RetentionClause[] =>
    clauses.filter((clause) => selected.has(clause.globalIndex));

  let candidate = renderRetentionText(buildSelectedClauses(), false);

  const optional = byPriority.filter(
    (clause) => !selected.has(clause.globalIndex),
  );

  for (const clause of optional) {
    selected.add(clause.globalIndex);
    const nextCandidate = renderRetentionText(buildSelectedClauses(), false);

    if (nextCandidate.length <= maxLen) {
      candidate = nextCandidate;
      if (candidate.length >= minLen) break;
      continue;
    }

    selected.delete(clause.globalIndex);
  }

  if (candidate.length > maxLen || candidate.length < minLen) {
    candidate = renderRetentionText(buildSelectedClauses(), true);
  }

  if (candidate.length > maxLen || candidate.length < minLen) {
    for (const clause of optional) {
      if (selected.has(clause.globalIndex)) continue;

      selected.add(clause.globalIndex);
      const nextCandidate = renderRetentionText(buildSelectedClauses(), true);

      if (nextCandidate.length <= maxLen) {
        candidate = nextCandidate;
        if (candidate.length >= minLen) break;
      } else {
        selected.delete(clause.globalIndex);
      }
    }
  }

  if (candidate.length > maxLen || candidate.length < minLen) {
    return null;
  }

  return candidate.length < text.length ? candidate : null;
}

export function enforceT3MaxLength(text: string): TruncationResult {
  if (text.length < T3_HARD_MIN) {
    return rescueUnderlengthT3(text);
  }

  if (text.length <= T3_MAX) {
    return { text, truncated: false };
  }

  const originalLength = text.length;

  const retentionVariant = buildPriorityRetentionVariant(text, T3_MAX, T3_MIN);
  if (retentionVariant) {
    return {
      text: retentionVariant,
      truncated: true,
      method: "priority-retention",
      originalLength,
    };
  }

  const sentenceResult = truncateAtBoundary(text, T3_MAX, /\.\s/g, 1);
  if (sentenceResult && sentenceResult.length >= T3_MIN) {
    return {
      text: sentenceResult.trimEnd(),
      truncated: true,
      method: "sentence",
      originalLength,
    };
  }

  const clauseResult = truncateAtBoundary(text, T3_MAX, /[;]\s|(?:\s—\s)/g, 0);
  if (clauseResult && clauseResult.length >= T3_MIN) {
    return {
      text: `${clauseResult.trimEnd()}.`,
      truncated: true,
      method: "clause",
      originalLength,
    };
  }

  const commaResult = truncateAtBoundary(text, T3_MAX, /,\s/g, 0);
  if (commaResult && commaResult.length >= T3_MIN) {
    return {
      text: `${commaResult.trimEnd()}.`,
      truncated: true,
      method: "comma-fallback",
      originalLength,
    };
  }

  const whitespaceResult = truncateAtWhitespace(text, T3_MAX);
  if (whitespaceResult && whitespaceResult.length >= T3_MIN) {
    return {
      text: `${whitespaceResult.trimEnd()}.`,
      truncated: true,
      method: "whitespace",
      originalLength,
    };
  }

  if (commaResult) {
    return {
      text: `${commaResult.trimEnd()}.`,
      truncated: true,
      method: "comma-fallback",
      originalLength,
    };
  }

  if (whitespaceResult) {
    return {
      text: `${whitespaceResult.trimEnd()}.`,
      truncated: true,
      method: "whitespace",
      originalLength,
    };
  }

  return {
    text: `${text.slice(0, T3_MAX).trimEnd()}.`,
    truncated: true,
    method: "whitespace",
    originalLength,
  };
}

// ============================================================================
// P16: T4 Over-Length Truncation (≤325 chars)
// ============================================================================

const T4_MAX = 325;

export function enforceT4MaxLength(text: string): TruncationResult {
  if (text.length <= T4_MAX) {
    return { text, truncated: false };
  }

  const originalLength = text.length;

  const retentionVariant = buildPriorityRetentionVariant(text, T4_MAX);
  if (retentionVariant) {
    return {
      text: retentionVariant,
      truncated: true,
      method: "priority-retention",
      originalLength,
    };
  }

  const sentenceResult = truncateAtBoundary(text, T4_MAX, /\.\s/g, 1);
  if (sentenceResult) {
    return {
      text: sentenceResult.trimEnd(),
      truncated: true,
      method: "sentence",
      originalLength,
    };
  }

  const commaResult = truncateAtBoundary(text, T4_MAX, /,\s/g, 0);
  if (commaResult) {
    return {
      text: `${commaResult.trimEnd()}.`,
      truncated: true,
      method: "comma-fallback",
      originalLength,
    };
  }

  const whitespaceResult = truncateAtWhitespace(text, T4_MAX);
  if (whitespaceResult) {
    return {
      text: `${whitespaceResult.trimEnd()}.`,
      truncated: true,
      method: "whitespace",
      originalLength,
    };
  }

  return {
    text: `${text.slice(0, T4_MAX).trimEnd()}.`,
    truncated: true,
    method: "whitespace",
    originalLength,
  };
}

// ============================================================================
// SHARED TRUNCATION HELPERS
// ============================================================================

function truncateAtBoundary(
  text: string,
  maxLen: number,
  pattern: RegExp,
  offset: number,
): string | null {
  let lastGoodPos = -1;

  for (const m of text.matchAll(pattern)) {
    const cutPos = (m.index ?? 0) + (m[0]?.length ?? 0) - offset;
    if (cutPos > 0 && cutPos <= maxLen) {
      lastGoodPos = cutPos;
    }
  }

  if (lastGoodPos <= 0) return null;
  return text.slice(0, lastGoodPos);
}

function truncateAtWhitespace(text: string, maxLen: number): string | null {
  const window = text.slice(0, maxLen);
  const lastSpace = window.lastIndexOf(" ");
  if (lastSpace <= 0) return null;
  return text.slice(0, lastSpace);
}

// ============================================================================
// P18: NUMERIC MEASUREMENT → VISUAL CONVERSION (Aim 6.2, 6.3 — Phase 3)
// ============================================================================

const WIND_SPEED_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:0|[1-5])\s*km\/h\b/gi,
    "still air",
  ],
  [
    /(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:[6-9]|1[0-9])\s*km\/h\b/gi,
    "a light breeze",
  ],
  [
    /(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:2[0-9]|3[0-9])\s*km\/h\b/gi,
    "a steady wind",
  ],
  [
    /(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:4[0-9]|5[0-9])\s*km\/h\b/gi,
    "a strong wind",
  ],
  [
    /(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:6[0-9]|[7-9][0-9])\s*km\/h\b/gi,
    "fierce gusting wind",
  ],
  [
    /(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b\d{3,}\s*km\/h\b/gi,
    "extreme gale-force wind",
  ],
  [
    /(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:[1-9]|1[0-2])\s*mph\b/gi,
    "a light breeze",
  ],
  [
    /(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:1[3-9]|2[0-4])\s*mph\b/gi,
    "a steady wind",
  ],
  [
    /(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:2[5-9]|3[0-9])\s*mph\b/gi,
    "a strong wind",
  ],
  [
    /(?:\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b\s*)?\b(?:4[0-9]|[5-9][0-9])\s*mph\b/gi,
    "fierce wind",
  ],
];

const COMPASS_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\s+(?:wind|breeze|gust)s?\b/gi,
    "wind",
  ],
  [
    /\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b/gi,
    "",
  ],
];

const NUMERIC_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b-?\d+\s*°?\s*C\b/gi, "cold air"],
  [/\b\d+\s*°?\s*F\b/gi, "warm air"],
  [/\b\d+(?:\.\d+)?\s*(?:metres?|meters?|m)\s+(?:tall|high)\b/gi, "towering"],
  [/\b\d+(?:\.\d+)?\s*(?:feet|ft)\s+(?:tall|high)\b/gi, "towering"],
  [
    /\b\d+(?:\.\d+)?\s*(?:metres?|meters?|m|feet|ft)\s+(?:wide|long)\b/gi,
    "broad",
  ],
  [
    /\b\d+(?:\.\d+)?\s*(?:km|kilometres?|kilometers?|miles?)\s+(?:away|distant)\b/gi,
    "in the distance",
  ],
  [/\b\d+(?:\.\d+)?\s*(?:cm|mm|inches?|in)\b/gi, ""],
];

const CLOCK_TIME_CONVERSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:0?[5-6])\s*AM\b/gi, "at first light"],
  [/\b(?:0?[7-9]|10|11)\s*AM\b/gi, "in the morning"],
  [/\b12\s*PM\b/gi, "at midday"],
  [/\b(?:0?1|0?2|0?3|0?4)\s*PM\b/gi, "in the afternoon"],
  [/\b(?:0?5|0?6|0?7)\s*PM\b/gi, "towards evening"],
  [/\b(?:0?8|0?9|10|11)\s*PM\b/gi, "late at night"],
];

function cleanupMeasurementResiduals(text: string): string {
  return text
    .replace(/,\s*,/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/\b(?:a|the)\s+,/gi, ",")
    .replace(/,\s*\./g, ".")
    .replace(/^\s*,\s*/g, "")
    .replace(/\s+,/g, ",")
    .trim();
}

export function convertMeasurementsToVisual(text: string): TextCleanupResult {
  let next = text;
  const fixes: string[] = [];

  for (const table of [
    WIND_SPEED_CONVERSIONS,
    CLOCK_TIME_CONVERSIONS,
    COMPASS_CONVERSIONS,
    NUMERIC_CONVERSIONS,
  ]) {
    for (const [pattern, replacement] of table) {
      pattern.lastIndex = 0;
      if (pattern.test(next)) {
        const before = next;
        next = next.replace(pattern, replacement);
        if (next !== before) {
          fixes.push(`${pattern} → "${replacement || "(removed)"}"`);
        }
      }
    }
  }

  next = cleanupMeasurementResiduals(next);
  return { text: next, fixes };
}

// ============================================================================
// P19: T4 Retention Safety Guard
// ============================================================================

export interface T4SafetyGuardResult {
  text: string;
  fixes: string[];
}

const T4_WEAK_OPENERS = /^(?:and|while|with|as)\b[\s,]*/i;
const T4_FRAGMENT_STARTERS =
  /^(?:and|while|with|as|under|over|through|across|towards?|into|onto|beneath|inside|outside)\b/i;
const T4_MIN_SENTENCE_WORDS = 10;

function splitSentencesPreserve(text: string): string[] {
  return (
    text
      .match(/[^.!?]+[.!?]?/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [text.trim()]
  );
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function capitaliseSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function ensureSentenceStop(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function normaliseJoinedSentence(text: string): string {
  return ensureSentenceStop(
    capitaliseSentence(
      text
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([,.;!?])/g, "$1")
        .replace(/^[,;:\-–—\s]+/, "")
        .trim(),
    ),
  );
}

function stripWeakSentenceOpener(sentence: string): {
  text: string;
  changed: boolean;
} {
  const trimmed = sentence.trim();
  const next = trimmed
    .replace(T4_WEAK_OPENERS, "")
    .replace(/^\s*[,-]\s*/, "")
    .trim();
  return {
    text:
      next.length > 0 ? capitaliseSentence(next) : capitaliseSentence(trimmed),
    changed: next.length > 0 && next !== trimmed,
  };
}

function mergeIntoPreviousSentence(previous: string, current: string): string {
  const prevCore = previous.replace(/[.!?]+$/, "").trim();
  let currentCore = current.replace(/[.!?]+$/, "").trim();

  currentCore = currentCore
    .replace(T4_WEAK_OPENERS, "")
    .replace(/^\s*[,-]\s*/, "")
    .trim();
  if (!currentCore) {
    return ensureSentenceStop(prevCore);
  }

  const lowered = currentCore.charAt(0).toLowerCase() + currentCore.slice(1);

  return `${prevCore}, ${lowered}.`
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

function cleanT4TailFragment(sentence: string): {
  text: string;
  changed: boolean;
} {
  const trimmed = sentence.trim();
  const core = trimmed.replace(/[.!?]+$/, "").trim();

  if (countWords(core) >= T4_MIN_SENTENCE_WORDS) {
    return {
      text: ensureSentenceStop(capitaliseSentence(core)),
      changed: false,
    };
  }

  if (!T4_FRAGMENT_STARTERS.test(core)) {
    return {
      text: ensureSentenceStop(capitaliseSentence(core)),
      changed: false,
    };
  }

  const stripped = core
    .replace(T4_FRAGMENT_STARTERS, "")
    .replace(/^\s*[,-]\s*/, "")
    .trim();
  if (!stripped) {
    return {
      text: ensureSentenceStop(capitaliseSentence(core)),
      changed: false,
    };
  }

  return {
    text: ensureSentenceStop(capitaliseSentence(stripped)),
    changed: true,
  };
}

/**
 * P19: Final Tier 4 safety guard after retention/truncation.
 *
 * Goal:
 * - keep the retention logic
 * - prevent broken plain-language output caused by retention fragments
 * - avoid a redesign of T4 generation strategy
 */
export function applyT4RetentionSafetyGuard(text: string): T4SafetyGuardResult {
  const fixes: string[] = [];
  const sentences = splitSentencesPreserve(text);

  if (sentences.length === 0) {
    return { text, fixes };
  }

  {
    const cleaned = stripWeakSentenceOpener(sentences[0]!);
    if (cleaned.changed) {
      sentences[0] = ensureSentenceStop(cleaned.text);
      fixes.push("Stripped weak T4 opener from first sentence");
    } else {
      sentences[0] = ensureSentenceStop(cleaned.text);
    }
  }

  for (let i = 1; i < sentences.length; i++) {
    const cleaned = cleanT4TailFragment(sentences[i]!);
    if (cleaned.changed) {
      fixes.push(`Cleaned fragment-like opener in sentence ${i + 1}`);
    }
    sentences[i] = cleaned.text;
  }

  for (let i = 1; i < sentences.length; ) {
    const current = sentences[i]!;
    const wordCount = countWords(current.replace(/[.!?]+$/, "").trim());

    if (wordCount < T4_MIN_SENTENCE_WORDS) {
      sentences[i - 1] = mergeIntoPreviousSentence(sentences[i - 1]!, current);
      sentences.splice(i, 1);
      fixes.push(`Merged short T4 sentence ${i + 1} into previous sentence`);
      continue;
    }

    i += 1;
  }

  const finalText = sentences
    .map((sentence) => normaliseJoinedSentence(sentence))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { text: finalText, fixes };
}

// ============================================================================
// P20: PRIORITY-AWARE RETENTION PASS FOR T3/T4
// ============================================================================

interface AnchorPresence {
  subject: boolean;
  action: boolean;
  environment: boolean;
  interaction: boolean;
  lighting: boolean;
}

interface RetentionSentence {
  index: number;
  text: string;
  words: number;
  anchors: AnchorPresence;
  score: number;
}

const SUBJECT_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:man|woman|child|children|girl|boy|person|people|cyclist|diver|blacksmith|astronaut|keeper|firefighter|dog|cat|bird|pigeons?|rocket|tower|village|reef|coral|cosmodrome|forge|crossing|beam|waves?|buildings?|service buildings?|launch tower)\b/i,
  /^\s*(?:a|an|the)\s+[a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){0,3}\b/i,
];

const ACTION_RETENTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:grip|grips|gripping|hold|holds|holding|reach|reaches|reaching|glide|glides|gliding|drive|drives|driving|pedal|pedals|pedalling|hammer|hammers|hammering|smash|smashes|smashing|slam|slams|slamming|crash|crashes|crashing|surge|surges|surging|scatter|scatters|scattering|laugh|laughs|laughing|glow|glows|glowing|cut|cuts|cutting|rise|rises|rising|fall|falls|falling|flicker|flickers|flickering|hang|hangs|hanging|burn|burns|burning|rescue|rescues|rescuing|photograph|photographs|photographing|stand|stands|standing|slide|slides|sliding|wash|washes|washing|stretch|stretches|stretching|lift|lifts|lifting|fly|flies|flying|move|moves|moving|stream|streams|streaming|lean|leans|leaning|float|floats|floating|feed|feeds|feeding)\b/i,
];

const ENVIRONMENT_RETENTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:sky|street|lane|square|reef|water|ocean|sea|gallery deck|deck|rocks?|cliffs?|village|forge|cosmodrome|tower|intersection|zebra stripes|paving|asphalt|concrete|pad|surface|road|walls?|city|buildings?|night|country lane|coral reef|stone paving|rain-soaked deck|wheel-rutted asphalt)\b/i,
];

const INTERACTION_RETENTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:through|across|against|below|above|beside|between|toward|towards|around|behind|under|over|into|onto)\b/i,
  /\b(?:cuts? through|crowd around|rises above|glows against|reaching toward|reaching towards|catch(?:es)? the sun|mirror the lights|glow through|hangs from|push through|slam(?:s)? the|smash(?:es)? the)\b/i,
];

const LIGHTING_RETENTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:light|sunlight|sun glare|glow|glows?|beam|shadows?|twilight|night|golden hour|window light|furnace light|orange|purple|copper|mist|misty|drizzle|rain|spray|atmosphere|air|gloom|overcast|bright surface|warm|cool|blue depth|reflections?|embers|driving rain|soft early light|hard white highlights)\b/i,
];

const LOW_VALUE_FILLER_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:the whole site feels|the whole place feels|the moment stays|the moment feels|everything beyond[^,.]*|keeping the diver as the main subject|keeping the diver as the clear focal point|keeping the diver as the main focus|from an eye-level documentary view|in an eye-level documentary view|in a wide underwater view|with deep city layers|with dense city depth[^,.]*|leaving the vast site[^,.]*|like history stepped away and never returned|for a quiet, emotional portrait|for quiet emotional detail)\b/gi,
  /\b(?:far off|far away|in the distance)\b,?\s*/gi,
];

function normaliseRetentionWhitespace(text: string): string {
  return text
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*,/g, ".")
    .replace(/,\s*\./g, ".")
    .replace(/^\s*[,.]\s*/g, "")
    .trim();
}

function trimLowValueFiller(text: string): string {
  let next = text;

  for (const pattern of LOW_VALUE_FILLER_PATTERNS) {
    next = next.replace(pattern, " ");
  }

  return normaliseRetentionWhitespace(next)
    .replace(/\s+([.!?])/g, "$1")
    .replace(/\bAnd\s+(?=[A-Z])/g, "")
    .trim();
}

function splitIntoRetentionSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => normaliseRetentionWhitespace(part))
    .filter(Boolean);
}

function hasAnyPattern(text: string, patterns: ReadonlyArray<RegExp>): boolean {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      pattern.lastIndex = 0;
      return true;
    }
    pattern.lastIndex = 0;
  }
  return false;
}

function classifyRetentionSentence(
  sentence: string,
  index: number,
): RetentionSentence {
  const anchors: AnchorPresence = {
    subject: index === 0 || hasAnyPattern(sentence, SUBJECT_PATTERNS),
    action: hasAnyPattern(sentence, ACTION_RETENTION_PATTERNS),
    environment: hasAnyPattern(sentence, ENVIRONMENT_RETENTION_PATTERNS),
    interaction: hasAnyPattern(sentence, INTERACTION_RETENTION_PATTERNS),
    lighting: hasAnyPattern(sentence, LIGHTING_RETENTION_PATTERNS),
  };

  let score = 0;
  if (anchors.subject) score += 10;
  if (anchors.action) score += 8;
  if (anchors.environment) score += 6;
  if (anchors.interaction) score += 5;
  if (anchors.lighting) score += 4;
  if (index === 0) score += 3;

  const words = sentence.split(/\s+/).filter(Boolean).length;
  score += Math.min(4, Math.floor(words / 5));

  return {
    index,
    text: sentence,
    words,
    anchors,
    score,
  };
}

function collectAnchorCoverageFromSentences(
  sentences: ReadonlyArray<RetentionSentence>,
): AnchorPresence {
  return {
    subject: sentences.some((s) => s.anchors.subject),
    action: sentences.some((s) => s.anchors.action),
    environment: sentences.some((s) => s.anchors.environment),
    interaction: sentences.some((s) => s.anchors.interaction),
    lighting: sentences.some((s) => s.anchors.lighting),
  };
}

function joinRetentionSentences(
  sentences: ReadonlyArray<RetentionSentence>,
): string {
  return sentences
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((s) => {
      const clean = normaliseRetentionWhitespace(s.text);
      if (!clean) return "";
      return /[.!?]$/.test(clean) ? clean : `${clean}.`;
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildPrioritySentenceRetentionCandidate(
  originalText: string,
  maxLen: number,
): string | null {
  const rawSentences = splitIntoRetentionSentences(originalText);
  if (rawSentences.length <= 1) return null;

  const sentences = rawSentences.map((sentence, index) =>
    classifyRetentionSentence(sentence, index),
  );

  const originalCoverage = collectAnchorCoverageFromSentences(sentences);
  const selected = new Map<number, RetentionSentence>();

  const firstSentence = sentences[0];
  if (firstSentence) {
    selected.set(firstSentence.index, firstSentence);
  }

  const anchorOrder: ReadonlyArray<keyof AnchorPresence> = [
    "subject",
    "action",
    "environment",
    "interaction",
    "lighting",
  ];

  for (const anchorKey of anchorOrder) {
    if (!originalCoverage[anchorKey]) continue;

    const candidate = sentences
      .filter((sentence) => sentence.anchors[anchorKey])
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      })[0];

    if (candidate) {
      selected.set(candidate.index, candidate);
    }
  }

  let candidateText = joinRetentionSentences([...selected.values()]);

  const optional = sentences
    .filter((sentence) => !selected.has(sentence.index))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

  for (const sentence of optional) {
    const preview = joinRetentionSentences([...selected.values(), sentence]);
    if (preview.length <= maxLen) {
      selected.set(sentence.index, sentence);
      candidateText = preview;
    }
  }

  candidateText = trimLowValueFiller(candidateText);

  if (candidateText.length > maxLen) {
    const fallback = truncateAtBoundary(candidateText, maxLen, /\.\s/g, 1);
    if (fallback) {
      candidateText = normaliseRetentionWhitespace(fallback);
      if (candidateText && !/[.!?]$/.test(candidateText)) {
        candidateText += ".";
      }
    }
  }

  if (!candidateText || candidateText.length > maxLen) {
    return null;
  }

  const candidateSentences = splitIntoRetentionSentences(candidateText).map(
    (sentence, index) => classifyRetentionSentence(sentence, index),
  );
  const candidateCoverage =
    collectAnchorCoverageFromSentences(candidateSentences);

  const keepsCore =
    (!originalCoverage.subject || candidateCoverage.subject) &&
    (!originalCoverage.action || candidateCoverage.action);

  const preservedAnchorCount = anchorOrder.filter(
    (anchorKey) => !originalCoverage[anchorKey] || candidateCoverage[anchorKey],
  ).length;

  return keepsCore && preservedAnchorCount >= 3 ? candidateText : null;
}

function applyPriorityAwareRetention(
  text: string,
  maxLen: number,
  _tier: "tier3" | "tier4",
): string {
  if (text.length <= maxLen) {
    return text;
  }

  const fillerTrimmed = trimLowValueFiller(text);
  if (fillerTrimmed.length <= maxLen) {
    return fillerTrimmed;
  }

  const candidate = buildPrioritySentenceRetentionCandidate(
    fillerTrimmed,
    maxLen,
  );
  if (candidate && candidate.length <= maxLen) {
    return candidate;
  }

  return fillerTrimmed;
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
 * Phase B: tier2 will be empty strings (MJ removed from Call 2).
 * Processing still runs — deduplicateMjParams on empty string is a no-op.
 * Mutates nothing — returns a new object.
 */
export function postProcessTiers(tiers: TierPrompts): TierPrompts {
  return {
    tier1: {
      positive: (() => {
        let text = tiers.tier1.positive;
        const capResult = enforceWeightCap(text, 8);
        if (capResult.wasFixed) text = capResult.text;

        text = stripTrailingPunctuation(text);

        const wrapResult = enforceT1WeightWrap(text);
        if (wrapResult.fixes.length > 0) {
          text = wrapResult.text;
          if (typeof console !== "undefined") {
            console.debug(
              "[harmony-post-processing] P14 T1 weight-wrap fixes:",
              wrapResult.fixes.join("; "),
            );
          }
        }
        if (wrapResult.skipped.length > 0 && typeof console !== "undefined") {
          console.debug(
            "[harmony-post-processing] P14 T1 weight-wrap skipped:",
            wrapResult.skipped.join("; "),
          );
        }
        return text;
      })(),
      negative: stripTrailingPunctuation(tiers.tier1.negative),
    },

    tier2: {
      positive: deduplicateMjParams(tiers.tier2.positive),
      negative: tiers.tier2.negative,
    },

    tier3: {
      positive: (() => {
        let text = tiers.tier3.positive;

        const jargon = convertPhotographyJargonTierAware("tier3", text);
        if (jargon.fixes.length > 0) text = jargon.text;

        const measurements = convertMeasurementsToVisual(text);
        if (measurements.fixes.length > 0) text = measurements.text;

        const banned = stripOrRewriteT3BannedPhrases(text);
        if (banned.fixes.length > 0) text = banned.text;

        const tails = stripT3BannedTailConstructions(text);
        if (tails.fixes.length > 0) text = tails.text;

        text = applyPriorityAwareRetention(text, T3_MAX, "tier3");

        const result = enforceT3MaxLength(text);
        if (result.truncated && typeof console !== "undefined") {
          console.debug(
            `[harmony-post-processing] P15/P20 T3 truncated: ${result.originalLength} → ${result.text.length} (${result.method})`,
          );
        }

        return result.text;
      })(),
      negative: tiers.tier3.negative,
    },

    tier4: {
      positive: (() => {
        let text = tiers.tier4.positive;

        text = mergeT4ShortSentences(
          fixT4MetaOpeners(fixT4SelfCorrection(text)),
        );

        const jargon = convertPhotographyJargonTierAware("tier4", text);
        if (jargon.fixes.length > 0) text = jargon.text;

        const measurements = convertMeasurementsToVisual(text);
        if (measurements.fixes.length > 0) text = measurements.text;

        text = applyPriorityAwareRetention(text, T4_MAX, "tier4");

        const maxResult = enforceT4MaxLength(text);
        if (maxResult.truncated) {
          text = maxResult.text;
          if (typeof console !== "undefined") {
            console.debug(
              `[harmony-post-processing] P16/P20 T4 truncated: ${maxResult.originalLength} → ${text.length} (${maxResult.method})`,
            );
          }
        } else {
          text = maxResult.text;
        }

        const guardResult = applyT4RetentionSafetyGuard(text);
        if (guardResult.fixes.length > 0) {
          text = guardResult.text;
          if (typeof console !== "undefined") {
            console.debug(
              `[harmony-post-processing] P19 T4 safety guard fixes: ${guardResult.fixes.join("; ")}`,
            );
          }
        }

        const finalCap = enforceT4MaxLength(text);
        if (finalCap.truncated) {
          text = finalCap.text;
          if (typeof console !== "undefined") {
            console.debug(
              `[harmony-post-processing] P16 T4 final cap: ${finalCap.originalLength} → ${text.length} (${finalCap.method})`,
            );
          }
        } else {
          text = finalCap.text;
        }

        return text;
      })(),
      negative: tiers.tier4.negative,
    },
  };
}
