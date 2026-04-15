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
//   T3: P17/P18 (jargon + measurement conversion) → P19 (opening freshness) → P15 (length)
//   T4: P3 (self-correction) → P8 (meta-openers) → P10 (short sentence merge)
//       → P17/P18 (jargon + measurement conversion) → P19 (opening freshness)
//       → P16 (over-length truncation ≤325) → P21 (retention safety) → P22 (sentence floor)
//
// v4.5.1 additions (10 Apr 2026):
//   P14 — T1 weight-wrap enforcement (4-word limit, 2-word-tail heuristic)
//   P15 — T3 over-length truncation (280–420 char range)
//   P16 — T4 over-length truncation (≤325 chars)
//
// v6.2 additions:
//   P19 — T3-first opening freshness enforcer v2 (shared deterministic anti-echo)
//   P20 — Critical-anchor retention enforcer for T3/T4 before truncation
//   P21 — T4 retention safety guard
//   P22 — T4 final sentence-floor guard
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
// Shared sentence helpers
// ============================================================================

const T4_MIN_SENTENCE_WORDS = 10;

function splitSentencesPreserve(text: string): string[] {
  return (
    text
      .match(/[^.!?]+[.!?]?/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? []
  );
}

function ensureSentenceStop(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function capitaliseSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function normaliseJoinedSentence(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function mergeIntoPreviousSentence(previous: string, current: string): string {
  const prevCore = previous.replace(/[.!?]+$/, "").trim();
  const currentCore = current.replace(/[.!?]+$/, "").trim();

  if (!prevCore) return ensureSentenceStop(capitaliseSentence(currentCore));
  if (!currentCore) return ensureSentenceStop(capitaliseSentence(prevCore));

  const loweredCurrent =
    currentCore.charAt(0).toLowerCase() + currentCore.slice(1);

  return ensureSentenceStop(`${prevCore}, ${loweredCurrent}`.trim());
}

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
 * Also detects fusion artefacts where GPT omits separator between duplicate blocks.
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
 * CLIP prompts are comma-separated keyword lists — no full stops.
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
 * Operates on the full string because the "?" and "No"
 * often span a sentence boundary.
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
// P8: T4 Meta-Language Opener Fixer
// ============================================================================

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
 * P10: Merge T4 short trailing sentences into the previous sentence.
 */
export function mergeT4ShortSentences(prompt: string): string {
  const sentences = prompt.split(/(?<=[.!?])\s+/).filter(Boolean);

  if (sentences.length < 2) return prompt;

  const lastSentence = sentences[sentences.length - 1]!;
  const wordCount = lastSentence.split(/\s+/).length;

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
// P19: T3-first opening freshness enforcer v2
// ============================================================================

export type FreshnessTier = "tier3" | "tier4";

export interface OpeningFreshnessResult {
  text: string;
  wasFixed: boolean;
  fixes: string[];
}

const OPENING_WORD_WINDOW = 8;
const OPENING_SENTENCE_SPLIT_REGEX = /(?<=[.!?])\s+/;
const OPENING_CLAUSE_SPLIT_REGEX = /\s*(?:,|;|—|–)\s*/;
const HIGH_OVERLAP_RATIO = 0.75;

const DECLARATIVE_OPENING_SUBJECT_HINTS = new Set([
  "a",
  "an",
  "the",
  "one",
  "two",
  "three",
  "four",
  "five",
  "several",
  "many",
  "lone",
  "single",
  "solitary",
  "packed",
]);

const DECLARATIVE_OPENING_VERB_HINTS = new Set([
  "stands",
  "standing",
  "sits",
  "sitting",
  "walks",
  "walking",
  "runs",
  "running",
  "drives",
  "driving",
  "glides",
  "gliding",
  "floats",
  "floating",
  "surges",
  "surging",
  "rises",
  "rising",
  "falls",
  "falling",
  "burns",
  "burning",
  "watches",
  "watching",
  "leans",
  "leaning",
  "holds",
  "holding",
  "waits",
  "waiting",
  "pedals",
  "pedalling",
  "rides",
  "riding",
  "crowds",
  "crowding",
  "jostles",
  "jostling",
  "reflects",
  "reflecting",
  "cuts",
  "cutting",
  "sweeps",
  "sweeping",
]);

const STRONG_NON_SUBJECT_LEAD_PATTERNS: ReadonlyArray<RegExp> = [
  /^(?:at|inside|under|beneath|beyond|across|along|through|within|against|near|amid|among)\b/i,
  /^(?:in|on)\s+(?:the\s+)?(?:distance|foreground|background|street|square|platform|coast|shore|water|harbour|bookshop|station|hangar|valley|reef|cathedral|workshop|market|alley|bridge)\b/i,
  /^(?:warm|cold|cool|pale|soft|hard|golden|silver|blue|orange|crimson|violet|white|smoky|misty|foggy|rain-soaked|wind-blown)\b/i,
  /^(?:gas|neon|signal|sunlight|lamplight|shadow|mist|haze|spray|snow|rain|embers|smoke|twilight|first light|golden hour)\b/i,
];

function splitOpeningSentences(text: string): string[] {
  return text
    .split(OPENING_SENTENCE_SPLIT_REGEX)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function normaliseOpeningWords(
  text: string,
  count = OPENING_WORD_WINDOW,
): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, count);
}

function capitaliseFirst(text: string): string {
  return text.replace(/^\s*([a-z])/, (match) => match.toUpperCase());
}

function lowercaseFirst(text: string): string {
  return text.replace(/^\s*([A-Z])/, (match) => match.toLowerCase());
}

function ensureSentencePunctuation(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return trimmed;
  if (/[.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function exactOpeningEcho(source: string, candidate: string): boolean {
  const sourceWords = normaliseOpeningWords(source);
  const candidateWords = normaliseOpeningWords(candidate);

  const sampleSize = Math.min(
    OPENING_WORD_WINDOW,
    sourceWords.length,
    candidateWords.length,
  );

  if (sampleSize < 3) return false;

  return (
    sourceWords.slice(0, sampleSize).join(" ") ===
    candidateWords.slice(0, sampleSize).join(" ")
  );
}

function openingOverlapRatio(source: string, candidate: string): number {
  const sourceWords = normaliseOpeningWords(source);
  const candidateWords = normaliseOpeningWords(candidate);
  const sampleSize = Math.min(
    OPENING_WORD_WINDOW,
    sourceWords.length,
    candidateWords.length,
  );

  if (sampleSize < 3) return 0;

  let positionalMatches = 0;
  for (let i = 0; i < sampleSize; i += 1) {
    if (sourceWords[i] === candidateWords[i]) {
      positionalMatches += 1;
    }
  }

  return positionalMatches / sampleSize;
}

function isDeclarativeSubjectLedOpening(text: string): boolean {
  const words = normaliseOpeningWords(text, 6);
  if (words.length < 3) return false;

  const first = words[0] ?? "";
  const second = words[1] ?? "";
  const third = words[2] ?? "";
  const fourth = words[3] ?? "";

  if (DECLARATIVE_OPENING_SUBJECT_HINTS.has(first)) {
    return (
      DECLARATIVE_OPENING_VERB_HINTS.has(third) ||
      DECLARATIVE_OPENING_VERB_HINTS.has(fourth)
    );
  }

  if (
    DECLARATIVE_OPENING_SUBJECT_HINTS.has(first) ||
    DECLARATIVE_OPENING_SUBJECT_HINTS.has(second)
  ) {
    return (
      DECLARATIVE_OPENING_VERB_HINTS.has(fourth) ||
      DECLARATIVE_OPENING_VERB_HINTS.has(third)
    );
  }

  return false;
}

function hasStrongNonSubjectLead(text: string): boolean {
  const trimmed = text.trim();
  return STRONG_NON_SUBJECT_LEAD_PATTERNS.some((pattern) =>
    pattern.test(trimmed),
  );
}

function needsOpeningFreshnessRepair(
  source: string,
  candidate: string,
): boolean {
  if (exactOpeningEcho(source, candidate)) return true;
  if (openingOverlapRatio(source, candidate) >= HIGH_OVERLAP_RATIO) return true;
  if (
    isDeclarativeSubjectLedOpening(source) &&
    isDeclarativeSubjectLedOpening(candidate)
  ) {
    return true;
  }
  return false;
}

function reorderBySentencePriority(
  source: string,
  text: string,
  tier: FreshnessTier,
): OpeningFreshnessResult {
  const sentences = splitOpeningSentences(text);
  if (sentences.length < 2) {
    return { text, wasFixed: false, fixes: [] };
  }

  const minimumLeadWords = tier === "tier3" ? 6 : 5;

  for (let i = 1; i < sentences.length; i += 1) {
    const candidateLead = sentences[i];
    if (candidateLead === undefined) continue;
    if (countWords(candidateLead) < minimumLeadWords) continue;

    const reorderedParts = [
      candidateLead,
      ...sentences.slice(0, i),
      ...sentences.slice(i + 1),
    ];

    const reordered = reorderedParts
      .filter((sentence): sentence is string => typeof sentence === "string")
      .map((sentence) => sentence.trim())
      .join(" ")
      .trim();

    if (!needsOpeningFreshnessRepair(source, reordered)) {
      return {
        text: reordered,
        wasFixed: true,
        fixes: [`${tier}:sentence_reordered_to_freshen_opening_v2`],
      };
    }
  }

  return { text, wasFixed: false, fixes: [] };
}

function rotateFirstSentenceClauses(
  source: string,
  text: string,
  tier: FreshnessTier,
): OpeningFreshnessResult {
  const sentences = splitOpeningSentences(text);
  const firstSentence = sentences[0];
  if (firstSentence === undefined) {
    return { text, wasFixed: false, fixes: [] };
  }

  const clauses = firstSentence
    .split(OPENING_CLAUSE_SPLIT_REGEX)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);

  if (clauses.length < 2) {
    return { text, wasFixed: false, fixes: [] };
  }

  const firstClause = clauses[0];
  if (firstClause === undefined) {
    return { text, wasFixed: false, fixes: [] };
  }

  const minimumLeadWords = tier === "tier3" ? 5 : 4;

  for (let i = 1; i < clauses.length; i += 1) {
    const leadClause = clauses[i];
    if (leadClause === undefined) continue;
    if (countWords(leadClause) < minimumLeadWords) continue;

    const remainingClauses = [
      lowercaseFirst(firstClause),
      ...clauses.slice(1, i),
      ...clauses.slice(i + 1),
    ].filter((clause): clause is string => clause.trim().length > 0);

    const rebuiltFirstSentence = ensureSentencePunctuation(
      [capitaliseFirst(leadClause), ...remainingClauses].join(", "),
    );

    const rebuiltText = [rebuiltFirstSentence, ...sentences.slice(1)]
      .filter((sentence): sentence is string => typeof sentence === "string")
      .map((sentence) => sentence.trim())
      .join(" ")
      .trim();

    if (!needsOpeningFreshnessRepair(source, rebuiltText)) {
      return {
        text: rebuiltText,
        wasFixed: true,
        fixes: [`${tier}:clause_rotated_to_freshen_opening_v2`],
      };
    }
  }

  return { text, wasFixed: false, fixes: [] };
}

function frontInternalSceneLead(
  source: string,
  text: string,
  tier: FreshnessTier,
): OpeningFreshnessResult {
  const sentences = splitOpeningSentences(text);
  const firstSentence = sentences[0];
  if (!firstSentence) {
    return { text, wasFixed: false, fixes: [] };
  }

  const clauses = firstSentence
    .split(OPENING_CLAUSE_SPLIT_REGEX)
    .map((clause) => clause.trim())
    .filter(Boolean);

  if (clauses.length < 2) {
    return { text, wasFixed: false, fixes: [] };
  }

  const minimumLeadWords = tier === "tier3" ? 4 : 3;

  for (let i = 1; i < clauses.length; i += 1) {
    const leadClause = clauses[i];
    if (!leadClause) continue;
    if (countWords(leadClause) < minimumLeadWords) continue;
    if (!hasStrongNonSubjectLead(leadClause)) continue;

    const firstClause = clauses[0] ?? "";
    const remainingClauses = [
      lowercaseFirst(firstClause),
      ...clauses.slice(1, i),
      ...clauses.slice(i + 1),
    ].filter((clause) => clause.trim().length > 0);

    const rebuiltFirstSentence = ensureSentencePunctuation(
      [capitaliseFirst(leadClause), ...remainingClauses].join(", "),
    );

    const rebuiltText = [rebuiltFirstSentence, ...sentences.slice(1)]
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!needsOpeningFreshnessRepair(source, rebuiltText)) {
      return {
        text: rebuiltText,
        wasFixed: true,
        fixes: [`${tier}:internal_scene_lead_fronted_v2`],
      };
    }
  }

  return { text, wasFixed: false, fixes: [] };
}

function promoteLaterStrongLead(
  source: string,
  text: string,
  tier: FreshnessTier,
): OpeningFreshnessResult {
  const sentences = splitOpeningSentences(text);
  if (sentences.length < 2) {
    return { text, wasFixed: false, fixes: [] };
  }

  for (let i = 1; i < sentences.length; i += 1) {
    const candidateLead = sentences[i];
    if (!candidateLead) continue;
    if (!hasStrongNonSubjectLead(candidateLead)) continue;

    const reordered = [
      candidateLead,
      ...sentences.slice(0, i),
      ...sentences.slice(i + 1),
    ]
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!needsOpeningFreshnessRepair(source, reordered)) {
      return {
        text: reordered,
        wasFixed: true,
        fixes: [`${tier}:later_strong_lead_promoted_v2`],
      };
    }
  }

  return { text, wasFixed: false, fixes: [] };
}

export function enforceOpeningFreshness(
  source: string,
  text: string,
  tier: FreshnessTier,
): OpeningFreshnessResult {
  const trimmedSource = source.trim();
  const trimmedText = text.trim();

  if (trimmedSource.length === 0 || trimmedText.length === 0) {
    return { text, wasFixed: false, fixes: [] };
  }

  if (!needsOpeningFreshnessRepair(trimmedSource, trimmedText)) {
    return { text, wasFixed: false, fixes: [] };
  }

  const sentenceReorder = reorderBySentencePriority(
    trimmedSource,
    trimmedText,
    tier,
  );
  if (sentenceReorder.wasFixed) return sentenceReorder;

  const clauseRotation = rotateFirstSentenceClauses(
    trimmedSource,
    trimmedText,
    tier,
  );
  if (clauseRotation.wasFixed) return clauseRotation;

  const internalLead = frontInternalSceneLead(trimmedSource, trimmedText, tier);
  if (internalLead.wasFixed) return internalLead;

  const laterLead = promoteLaterStrongLead(trimmedSource, trimmedText, tier);
  if (laterLead.wasFixed) return laterLead;

  return { text, wasFixed: false, fixes: [] };
}

// ============================================================================
// P15: T3 Over-Length Truncation (280–420 chars)
// ============================================================================

const T3_MAX = 420;
const T3_MIN = 280;

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

const T3_HARD_MIN = 220;

const T3_UNDERLENGTH_CLAUSES: ReadonlyArray<string> = [
  "The scene remains visually grounded and easy to read.",
  "The image stays coherent, direct, and visually clear.",
  "The overall view remains natural, legible, and visually grounded.",
];

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
      text: trimmed.trimEnd() + ".",
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

export function enforceT3MaxLength(text: string): TruncationResult {
  if (text.length < T3_HARD_MIN) {
    return rescueUnderlengthT3(text);
  }

  if (text.length <= T3_MAX) {
    return { text, truncated: false };
  }

  const originalLength = text.length;

  const retentionVariant = buildCriticalAnchorRetentionVariant(
    text,
    T3_MAX,
    T3_MIN,
  );
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
      text: clauseResult.trimEnd() + ".",
      truncated: true,
      method: "clause",
      originalLength,
    };
  }

  const commaResult = truncateAtBoundary(text, T3_MAX, /,\s/g, 0);
  if (commaResult && commaResult.length >= T3_MIN) {
    return {
      text: commaResult.trimEnd() + ".",
      truncated: true,
      method: "comma-fallback",
      originalLength,
    };
  }

  const whitespaceResult = truncateAtWhitespace(text, T3_MAX);
  if (whitespaceResult && whitespaceResult.length >= T3_MIN) {
    return {
      text: whitespaceResult.trimEnd() + ".",
      truncated: true,
      method: "whitespace",
      originalLength,
    };
  }

  if (commaResult) {
    return {
      text: commaResult.trimEnd() + ".",
      truncated: true,
      method: "comma-fallback",
      originalLength,
    };
  }

  if (whitespaceResult) {
    return {
      text: whitespaceResult.trimEnd() + ".",
      truncated: true,
      method: "whitespace",
      originalLength,
    };
  }

  return {
    text: text.slice(0, T3_MAX).trimEnd() + ".",
    truncated: true,
    method: "whitespace",
    originalLength,
  };
}

// ============================================================================
// P20: Critical-Anchor Retention Enforcer for T3/T4
// ============================================================================

type AnchorClass =
  | "subject"
  | "action"
  | "environment"
  | "interaction"
  | "lighting"
  | "detail";

interface RetentionClause {
  sentenceIndex: number;
  clauseIndex: number;
  globalIndex: number;
  text: string;
  score: number;
  tags: Set<AnchorClass>;
}

const RETENTION_ACTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:stand|stands|standing|sit|sits|sitting|walk|walks|walking|run|runs|running|pedal|pedals|pedalling|drive|drives|driving|glide|glides|gliding|float|floats|floating|hammer|hammers|hammering|reach|reaches|reaching|grip|grips|gripping|hold|holds|holding|lean|leans|leaning|scatter|scatters|scattering|laugh|laughs|laughing|surge|surges|surging|smash|smashes|smashing|crash|crashes|crashing|slam|slams|slamming|cut|cuts|cutting|slice|slices|slicing|glow|glows|glowing|rise|rises|rising|fall|falls|falling|push|pushes|pushing|crowd|crowds|crowding|jostle|jostles|jostling|flicker|flickers|flickering|spray|sprays|spraying|fly|flies|flying|rescue|rescues|rescuing|burn|burns|burning)\b/i,
];

const RETENTION_ENVIRONMENT_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:sky|street|lane|square|intersection|deck|gallery|village|cliff|cliffs|rock|rocks|reef|coral|tower|forge|anvil|asphalt|paving|water|ocean|wave|waves|surface|space|planet|earth|building|buildings|pad|cosmodrome|concrete|window|windows|depth|night|twilight|morning|evening|overcast|rain|mist|drizzle|wind|storm|fire|embers|smoke|smoky|city|road|harbour|shore|sea|snow|weeds?|paint|puddles?|shoes?|hand|hands|birds?|pigeons?)\b/i,
];

const RETENTION_INTERACTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:through|toward|towards|against|around|across|between|above|below|beside|alongside|under|over)\b/i,
  /\b(?:crowd|crowds|crowding|jostle|jostles|jostling|grip|grips|gripping|reach|reaches|reaching|cut|cuts|slice|slices|smash|smashes|smashing|crash|crashes|crashing|slam|slams|slamming|push|pushes|pushing|force|forces|forcing|trail|trails|trailing|scatter|scatters|scattering|flicker|flickers|flickering|rescue|rescues|rescuing)\b/i,
];

const RETENTION_LIGHTING_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:light|sunlight|sun|glow|beam|lit|lighting|shadow|shadows|bright|dark|orange|gold|golden|blue|magenta|cyan|violet|purple|misty|gloom|firelit|overcast|twilight|morning|evening|night)\b/i,
];

const RETENTION_DETAIL_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:rocket|launch tower|tower|pad|puddles?|asphalt|concrete|weeds?|paint|service buildings?|snow|embers?|helmet|gear|hose|dog|birds?|pigeons?|shoes?|feathers?|breadcrumbs?|windows?|cliffs?|rocks?|waves?|umbrellas?|traffic lights?|zebra stripes?)\b/i,
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
  [/\beye-level documentary view\b/gi, "eye-level view"],
  [/\s{2,}/g, " "],
];

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

function concreteDetailScore(clause: string): number {
  const words = clause.toLowerCase().match(/[a-z]+(?:-[a-z]+)*/g) ?? [];
  let score = 0;

  for (const pattern of RETENTION_DETAIL_PATTERNS) {
    if (pattern.test(clause)) score += 1.5;
  }

  for (const word of words) {
    if (word.length <= 3) continue;
    if (/(?:ing|ed|ly)$/.test(word)) continue;
    if (/(?:tion|sion|ness|ment|hood|ship|tude|ance|ence)$/.test(word))
      continue;
    score += 0.12;
  }

  return score;
}

function classifyRetentionClause(
  clause: string,
  sentenceIndex: number,
  clauseIndex: number,
  globalIndex: number,
): RetentionClause {
  const tags = new Set<AnchorClass>();

  if (sentenceIndex === 0 || globalIndex === 0) tags.add("subject");

  for (const pattern of RETENTION_ACTION_PATTERNS) {
    if (pattern.test(clause)) {
      tags.add("action");
      break;
    }
  }
  for (const pattern of RETENTION_ENVIRONMENT_PATTERNS) {
    if (pattern.test(clause)) {
      tags.add("environment");
      break;
    }
  }
  for (const pattern of RETENTION_INTERACTION_PATTERNS) {
    if (pattern.test(clause)) {
      tags.add("interaction");
      break;
    }
  }
  for (const pattern of RETENTION_LIGHTING_PATTERNS) {
    if (pattern.test(clause)) {
      tags.add("lighting");
      break;
    }
  }

  const detailScore = concreteDetailScore(clause);
  if (detailScore >= 1.5) tags.add("detail");

  let score = 0;
  if (globalIndex === 0) score += 12;
  if (sentenceIndex === 0) score += 4;
  if (sentenceIndex > 0) score += 3;
  if (tags.has("subject")) score += 8;
  if (tags.has("action")) score += 7;
  if (tags.has("environment")) score += 6;
  if (tags.has("interaction")) score += 5;
  if (tags.has("lighting")) score += 4;
  if (tags.has("detail")) score += 7;
  score += Math.min(
    4,
    Math.floor(clause.split(/\s+/).filter(Boolean).length / 5),
  );
  score += Math.min(3, Math.floor(detailScore));

  return { sentenceIndex, clauseIndex, globalIndex, text: clause, score, tags };
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

  return [...grouped.entries()]
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
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildCriticalAnchorRetentionVariant(
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

  const selected = new Set<number>([0]);
  const requiredTags: AnchorClass[] = [
    "action",
    "environment",
    "interaction",
    "lighting",
    "detail",
  ];

  for (const tag of requiredTags) {
    const match = byPriority.find((clause) => clause.tags.has(tag));
    if (match) selected.add(match.globalIndex);
  }

  const lateAnchor = byPriority.find(
    (clause) =>
      clause.sentenceIndex > 0 &&
      (clause.tags.has("detail") ||
        clause.tags.has("environment") ||
        clause.tags.has("lighting")),
  );
  if (lateAnchor) selected.add(lateAnchor.globalIndex);

  const buildSelected = (): RetentionClause[] =>
    clauses.filter((clause) => selected.has(clause.globalIndex));

  let candidate = renderRetentionText(buildSelected(), false);
  const optional = byPriority
    .filter((clause) => !selected.has(clause.globalIndex))
    .sort((a, b) => {
      const aLate = a.sentenceIndex > 0 ? 1 : 0;
      const bLate = b.sentenceIndex > 0 ? 1 : 0;
      if (bLate !== aLate) return bLate - aLate;
      if (b.score !== a.score) return b.score - a.score;
      return a.globalIndex - b.globalIndex;
    });

  const selectedSentenceSet = new Set(
    buildSelected().map((clause) => clause.sentenceIndex),
  );
  const sentenceCount = new Set(clauses.map((clause) => clause.sentenceIndex))
    .size;

  if (selectedSentenceSet.size < sentenceCount) {
    for (const clause of optional) {
      if (selectedSentenceSet.has(clause.sentenceIndex)) continue;
      selected.add(clause.globalIndex);
      const nextCandidate = renderRetentionText(buildSelected(), false);
      if (nextCandidate.length <= maxLen) {
        candidate = nextCandidate;
        selectedSentenceSet.add(clause.sentenceIndex);
      } else {
        selected.delete(clause.globalIndex);
      }
    }
  }

  for (const clause of optional) {
    selected.add(clause.globalIndex);
    const nextCandidate = renderRetentionText(buildSelected(), false);
    if (nextCandidate.length <= maxLen) {
      candidate = nextCandidate;
      if (candidate.length >= minLen) break;
      continue;
    }
    selected.delete(clause.globalIndex);
  }

  if (candidate.length > maxLen || candidate.length < minLen) {
    candidate = renderRetentionText(buildSelected(), true);
  }

  if (candidate.length > maxLen || candidate.length < minLen) return null;
  return candidate.length < text.length ? candidate : null;
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

  const retentionVariant = buildCriticalAnchorRetentionVariant(text, T4_MAX);
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
      text: commaResult.trimEnd() + ".",
      truncated: true,
      method: "comma-fallback",
      originalLength,
    };
  }

  const whitespaceResult = truncateAtWhitespace(text, T4_MAX);
  if (whitespaceResult) {
    return {
      text: whitespaceResult.trimEnd() + ".",
      truncated: true,
      method: "whitespace",
      originalLength,
    };
  }

  return {
    text: text.slice(0, T4_MAX).trimEnd() + ".",
    truncated: true,
    method: "whitespace",
    originalLength,
  };
}

// ============================================================================
// P21: T4 retention safety guard
// ============================================================================

export interface T4RetentionSafetyResult {
  text: string;
  fixes: string[];
}

function stripSentenceStop(text: string): string {
  return text.replace(/[.!?]+$/, "").trim();
}

function hasStrongOpeningAnchor(text: string): boolean {
  const stripped = stripSentenceStop(text).toLowerCase();

  return (
    /\b(?:man|woman|child|girl|boy|worker|driver|cyclist|pilot|firefighter|soldier|chef|dog|cat|horse|bird|rocket|tower|ship|boat|car|train|tram|bus|crane|bridge|lighthouse|warehouse|forge|anvil|market|street|square|beach|cliff|reef|planet|earth)\b/.test(
      stripped,
    ) ||
    /\b(?:standing|sitting|walking|running|driving|gliding|floating|hammering|reaching|gripping|holding|burning|rising|falling|surging|smashing|crowding)\b/.test(
      stripped,
    )
  );
}

export function applyT4RetentionSafetyGuard(
  text: string,
): T4RetentionSafetyResult {
  const fixes: string[] = [];
  const sentences = splitSentencesPreserve(text);

  if (sentences.length < 2) {
    return { text, fixes };
  }

  const first = sentences[0]!;
  const second = sentences[1]!;

  const firstWordCount = countWords(stripSentenceStop(first));
  const firstHasStrongAnchor = hasStrongOpeningAnchor(first);

  if (firstWordCount < T4_MIN_SENTENCE_WORDS && !firstHasStrongAnchor) {
    sentences[0] = mergeIntoPreviousSentence(first, second);
    sentences.splice(1, 1);
    fixes.push("Merged weak short T4 opening into sentence 2");
  }

  return {
    text: sentences
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim(),
    fixes,
  };
}

// ============================================================================
// P22: T4 final sentence-floor guard
// ============================================================================

export interface T4SentenceFloorResult {
  text: string;
  fixes: string[];
}

function lowercaseFirstChar(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function mergeLeadingSentenceIntoNext(leading: string, next: string): string {
  const leadCore = stripSentenceStop(leading);
  const nextCore = stripSentenceStop(next);

  if (!leadCore) return ensureSentenceStop(capitaliseSentence(nextCore));
  if (!nextCore) return ensureSentenceStop(capitaliseSentence(leadCore));

  const merged = `${leadCore}, ${lowercaseFirstChar(nextCore)}`;
  return ensureSentenceStop(capitaliseSentence(merged));
}

/**
 * P22: Final T4 sentence-floor guard.
 *
 * After retention/truncation, no final T4 sentence should remain under 10 words.
 * Repair short opening fragments by merging them forward, then merge any
 * remaining short later fragments back into the previous sentence.
 */
export function enforceT4SentenceFloor(text: string): T4SentenceFloorResult {
  const fixes: string[] = [];
  const sentences = splitSentencesPreserve(text).map((s) =>
    ensureSentenceStop(normaliseJoinedSentence(s)),
  );

  if (sentences.length === 0) {
    return { text, fixes };
  }

  if (sentences.length >= 2) {
    const firstWordCount = countWords(stripSentenceStop(sentences[0]!));
    if (firstWordCount < T4_MIN_SENTENCE_WORDS) {
      sentences[1] = mergeLeadingSentenceIntoNext(sentences[0]!, sentences[1]!);
      sentences.shift();
      fixes.push("Merged short opening T4 sentence into sentence 2");
    }
  }

  for (let i = 1; i < sentences.length; ) {
    const currentWordCount = countWords(stripSentenceStop(sentences[i]!));

    if (currentWordCount < T4_MIN_SENTENCE_WORDS) {
      sentences[i - 1] = mergeIntoPreviousSentence(
        sentences[i - 1]!,
        sentences[i]!,
      );
      sentences.splice(i, 1);
      fixes.push(`Merged short T4 sentence ${i + 1} into previous sentence`);
      continue;
    }

    i += 1;
  }

  const finalText = sentences
    .map((sentence) => ensureSentenceStop(normaliseJoinedSentence(sentence)))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { text: finalText, fixes };
}

// ============================================================================
// Shared truncation helpers
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
// P18: Numeric measurement → visual conversion
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
// Full pipeline orchestrator
// ============================================================================

export interface TierPrompts {
  tier1: { positive: string; negative: string };
  tier2: { positive: string; negative: string };
  tier3: { positive: string; negative: string };
  tier4: { positive: string; negative: string };
}

export function postProcessTiers(
  tiers: TierPrompts,
  sourceText?: string,
): TierPrompts {
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

        if (sourceText?.trim()) {
          const freshness = enforceOpeningFreshness(sourceText, text, "tier3");
          if (freshness.wasFixed) {
            text = freshness.text;
            if (typeof console !== "undefined") {
              console.debug(
                "[harmony-post-processing] P19 T3 opening freshness fixes:",
                freshness.fixes.join("; "),
              );
            }
          }
        }

        const result = enforceT3MaxLength(text);
        if (result.truncated && typeof console !== "undefined") {
          console.debug(
            `[harmony-post-processing] P15 T3 truncated: ${result.originalLength} → ${result.text.length} (${result.method})`,
          );
        }

        return result.text;
      })(),
      negative: tiers.tier3.negative,
    },

    tier4: {
      positive: (() => {
        let text = tiers.tier4.positive;

        text = fixT4SelfCorrection(text);
        text = fixT4MetaOpeners(text);
        text = mergeT4ShortSentences(text);

        const jargon = convertPhotographyJargonTierAware("tier4", text);
        if (jargon.fixes.length > 0) {
          text = jargon.text;
        }

        const measurements = convertMeasurementsToVisual(text);
        if (measurements.fixes.length > 0) {
          text = measurements.text;
        }

        if (sourceText?.trim()) {
          const freshness = enforceOpeningFreshness(sourceText, text, "tier4");
          if (freshness.wasFixed) {
            text = freshness.text;
            if (typeof console !== "undefined") {
              console.debug(
                "[harmony-post-processing] P19 T4 opening freshness fixes:",
                freshness.fixes.join("; "),
              );
            }
          }
        }

        const truncationResult = enforceT4MaxLength(text);
        if (truncationResult.truncated) {
          text = truncationResult.text;
          if (typeof console !== "undefined") {
            console.debug(
              `[harmony-post-processing] P16 T4 truncated: ${truncationResult.originalLength} → ${text.length} (${truncationResult.method})`,
            );
          }
        }

        const retentionResult = applyT4RetentionSafetyGuard(text);
        if (retentionResult.fixes.length > 0) {
          text = retentionResult.text;
          if (typeof console !== "undefined") {
            console.debug(
              "[harmony-post-processing] P21 T4 retention safety fixes:",
              retentionResult.fixes.join("; "),
            );
          }
        }

        const sentenceFloorResult = enforceT4SentenceFloor(text);
        if (sentenceFloorResult.fixes.length > 0) {
          text = sentenceFloorResult.text;
          if (typeof console !== "undefined") {
            console.debug(
              "[harmony-post-processing] P22 T4 sentence-floor fixes:",
              sentenceFloorResult.fixes.join("; "),
            );
          }
        }

        return text;
      })(),
      negative: tiers.tier4.negative,
    },
  };
}
