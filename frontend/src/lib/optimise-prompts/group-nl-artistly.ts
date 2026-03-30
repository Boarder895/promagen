// src/lib/optimise-prompts/group-nl-artistly.ts
// ============================================================================
// DEDICATED BUILDER: Artistly — Independent System Prompt
// ============================================================================
// Tier 4 | idealMin 100 | idealMax 200 | maxChars 500 | Strategy: REFINE
// negativeSupport: none
// architecture: natural-language
//
// Platform knowledge: Smart Prompt Enhancer auto-expands short inputs into
// detailed prompts. Keep inputs natural, vivid, and anchor-dense.
// FULLY INDEPENDENT — no shared imports. Own compliance gate + own system prompt.
// Pattern: matches dedicated builder approach.
// Authority: platform-config.json, Prompt_Engineering_Specs.md
// Existing features preserved: Yes.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from "./types";
import type { ComplianceResult } from "@/lib/harmony-compliance";

// ============================================================================
// CONSTANTS
// ============================================================================

const ARTISTLY_MIN = 100;
const ARTISTLY_SOFT_TARGET = 150;
const ARTISTLY_MAX = 200;

const CLIP_QUALITY_TOKENS = [
  "masterpiece",
  "best quality",
  "highly detailed",
  "intricate textures",
  "sharp focus",
  "8K",
  "4K",
];

const MJ_FLAGS = [
  "ar",
  "v",
  "s",
  "stylize",
  "chaos",
  "weird",
  "tile",
  "repeat",
  "seed",
  "stop",
  "iw",
  "niji",
  "raw",
  "no",
];

const FILLER_PATTERNS: RegExp[] = [
  /\bvery\s+/gi,
  /\breally\s+/gi,
  /\bextremely\s+/gi,
  /\bquite\s+/gi,
  /\bbeautifully\s+/gi,
  /\bstunningly\s+/gi,
  /\bvisually\s+/gi,
  /\bscene of\s+/gi,
  /\bimage of\s+/gi,
  /\bdepiction of\s+/gi,
  /\bfeaturing\s+/gi,
  /\bshowing\s+/gi,
  /\bwith detailed\b/gi,
  /\bhighly realistic\b/gi,
  /\bhyper realistic\b/gi,
  /\bphotorealistic\b/gi,
];

const WEAK_ENDING_PATTERNS: RegExp[] = [
  /,\s*all in [^,.;:!?]+$/i,
  /,\s*in cinematic [^,.;:!?]+$/i,
  /,\s*with cinematic [^,.;:!?]+$/i,
  /,\s*in dramatic [^,.;:!?]+$/i,
  /,\s*with dramatic [^,.;:!?]+$/i,
  /,\s*in vivid detail$/i,
  /,\s*highly detailed$/i,
  /,\s*detailed$/i,
];

const CLAUSE_DROP_ORDER: RegExp[] = [
  // Drop clauses containing generic quality/style words (never anchors)
  /,\s*[^,.;:!?]*(?:intricate|detailed|refined|polished|cinematic|dramatic)[^,.;:!?]*$/i,
  // Drop background/backdrop clauses (low visual priority)
  /,\s*[^,.;:!?]*(?:background|backdrop)[^,.;:!?]*$/i,
  // Drop "distant/far" spatial qualifiers (secondary depth cues)
  /,\s*[^,.;:!?]*(?:distant|far-off|far off)[^,.;:!?]*$/i,
];

function normaliseWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])([^\s])/g, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripWeightSyntax(text: string): { text: string; changed: boolean } {
  let cleaned = text;
  const before = cleaned;

  // (term:1.3) -> term
  cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, "$1");

  // {{{term}}} / {{term}} / {term} -> term
  cleaned = cleaned.replace(/\{{1,3}\s*([^{}]+?)\s*\}{1,3}/g, "$1");

  // term::1.3 -> term
  cleaned = cleaned.replace(
    /([A-Za-z0-9][A-Za-z0-9'’-]*(?:\s+[A-Za-z0-9][A-Za-z0-9'’-]*){0,6})::(?:\d+\.?\d*)/g,
    "$1",
  );

  return { text: cleaned, changed: cleaned !== before };
}

function stripMjFlags(text: string): { text: string; changed: boolean } {
  let cleaned = text;
  const before = cleaned;

  for (const flag of MJ_FLAGS) {
    const re = new RegExp(`\\s*--${flag}\\b(?:\\s+[^,.;:!?\\s]+)?`, "gi");
    cleaned = cleaned.replace(re, "");
  }

  return { text: cleaned, changed: cleaned !== before };
}

function stripClipQualityTokens(text: string): {
  text: string;
  fixes: string[];
} {
  let cleaned = text;
  const fixes: string[] = [];

  for (const token of CLIP_QUALITY_TOKENS) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[\\s,])${escaped}(?=$|[\\s,])`, "gi");
    const before = cleaned;
    cleaned = cleaned.replace(re, " ");
    if (cleaned !== before) {
      fixes.push(`Stripped CLIP token "${token}"`);
    }
  }

  return { text: cleaned, fixes };
}

function cleanPunctuation(text: string): string {
  return normaliseWhitespace(
    text
      .replace(/,+/g, ",")
      .replace(/\.+/g, ".")
      .replace(/\s*,\s*,+/g, ", ")
      .replace(/^[,.;:\s]+|[,.;:\s]+$/g, "")
      .replace(/\s+([.?!])/g, "$1"),
  );
}

function compressByFillerRemoval(text: string): string {
  let out = text;
  for (const pattern of FILLER_PATTERNS) {
    out = out.replace(pattern, "");
  }
  return cleanPunctuation(out);
}

function compressWeakEnding(text: string): string {
  let out = text;
  for (const pattern of WEAK_ENDING_PATTERNS) {
    out = out.replace(pattern, "");
  }
  return cleanPunctuation(out);
}

function compressLongPhrases(text: string): string {
  let out = text;

  // General phrase compressions — work for any scene, not test-specific
  const replacements: Array<[RegExp, string]> = [
    [/\bat first light\b/gi, "at dawn"],
    [/\bat last light\b/gi, "at dusk"],
    [/\bin the cold wind\b/gi, "in cold wind"],
    [/\bin the warm wind\b/gi, "in warm wind"],
    [/\bglows through\b/gi, "glows in"],
    [/\bstretch across\b/gi, "stretch over"],
    [/\bwhile\b/gi, "as"],
    [/\bthat is\b/gi, "that's"],
    [/\bin the distance\b/gi, "beyond"],
    [/\bin the background\b/gi, "behind"],
    [/\bin the foreground\b/gi, "up close"],
  ];

  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }

  return cleanPunctuation(out);
}

function trimTrailingClause(text: string): string {
  let out = text;

  for (const pattern of CLAUSE_DROP_ORDER) {
    const candidate = out.replace(pattern, "");
    if (candidate !== out) {
      out = cleanPunctuation(candidate);
      if (out.length <= ARTISTLY_MAX) return out;
    }
  }

  const lastComma = out.lastIndexOf(",");
  if (lastComma > 0) {
    out = cleanPunctuation(out.slice(0, lastComma));
  }

  return out;
}

function hardTrimAtBoundary(text: string, ceiling: number): string {
  if (text.length <= ceiling) return text;

  const slice = text.slice(0, ceiling + 1);
  const lastBoundary = Math.max(
    slice.lastIndexOf(","),
    slice.lastIndexOf(";"),
    slice.lastIndexOf("."),
    slice.lastIndexOf(" "),
  );

  const trimmed =
    lastBoundary > Math.floor(ceiling * 0.7)
      ? slice.slice(0, lastBoundary)
      : text.slice(0, ceiling);

  return cleanPunctuation(trimmed);
}

function intelligentArtistlyTrim(text: string): {
  text: string;
  fixes: string[];
} {
  const fixes: string[] = [];
  let current = cleanPunctuation(text);

  if (current.length <= ARTISTLY_MAX) {
    return { text: current, fixes };
  }

  const startLength = current.length;

  const stage1 = compressByFillerRemoval(current);
  if (stage1.length < current.length) {
    fixes.push(
      `Compression stage 1: removed filler (${current.length} → ${stage1.length})`,
    );
    current = stage1;
  }
  if (current.length <= ARTISTLY_MAX) {
    fixes.push(`Trimmed to ${current.length} chars within ceiling`);
    return { text: current, fixes };
  }

  const stage2 = compressLongPhrases(current);
  if (stage2.length < current.length) {
    fixes.push(
      `Compression stage 2: tightened phrasing (${current.length} → ${stage2.length})`,
    );
    current = stage2;
  }
  if (current.length <= ARTISTLY_MAX) {
    fixes.push(`Trimmed to ${current.length} chars within ceiling`);
    return { text: current, fixes };
  }

  const stage3 = compressWeakEnding(current);
  if (stage3.length < current.length) {
    fixes.push(
      `Compression stage 3: removed weak ending (${current.length} → ${stage3.length})`,
    );
    current = stage3;
  }
  if (current.length <= ARTISTLY_MAX) {
    fixes.push(`Trimmed to ${current.length} chars within ceiling`);
    return { text: current, fixes };
  }

  let loopGuard = 0;
  while (current.length > ARTISTLY_MAX && loopGuard < 5) {
    const next = trimTrailingClause(current);
    if (next === current) break;
    fixes.push(
      `Compression stage 4.${loopGuard + 1}: dropped lowest-priority clause (${current.length} → ${next.length})`,
    );
    current = next;
    loopGuard += 1;
  }

  if (current.length > ARTISTLY_MAX) {
    const before = current.length;
    current = hardTrimAtBoundary(current, ARTISTLY_MAX);
    if (current.length < before) {
      fixes.push(
        `Compression stage 5: boundary trim (${before} → ${current.length})`,
      );
    }
  }

  if (current.length < startLength) {
    fixes.push(`Final length ${current.length}/${ARTISTLY_MAX}`);
  }

  return { text: current, fixes };
}

// ============================================================================
// COMPLIANCE: Artistly-specific cleanup
// ============================================================================

function enforceArtistlyCleanup(text: string): ComplianceResult {
  const fixes: string[] = [];
  let cleaned = text;

  const weightResult = stripWeightSyntax(cleaned);
  cleaned = weightResult.text;
  if (weightResult.changed) fixes.push("Stripped unsupported weight syntax");

  const flagResult = stripMjFlags(cleaned);
  cleaned = flagResult.text;
  if (flagResult.changed) fixes.push("Stripped unsupported parameter flags");

  const qualityResult = stripClipQualityTokens(cleaned);
  cleaned = qualityResult.text;
  fixes.push(...qualityResult.fixes);

  cleaned = cleaned
    .replace(/\bwithout\s+[^,.;:!?]+/gi, "")
    .replace(/\bno\s+[^,.;:!?]+/gi, "");
  cleaned = cleanPunctuation(cleaned);

  const trimResult = intelligentArtistlyTrim(cleaned);
  cleaned = trimResult.text;
  fixes.push(...trimResult.fixes);

  if (cleaned.length > 0 && cleaned.length < ARTISTLY_MIN) {
    fixes.push(
      `Below minimum length (${cleaned.length}/${ARTISTLY_MIN} chars)`,
    );
  } else if (
    cleaned.length >= ARTISTLY_SOFT_TARGET &&
    cleaned.length <= ARTISTLY_MAX
  ) {
    fixes.push(`Good density for Artistly (${cleaned.length} chars)`);
  }

  return {
    text: cleaned,
    wasFixed: fixes.length > 0,
    fixes,
  };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildArtistlyPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? "";

  const systemPrompt = `You are an expert prompt optimiser for "Artistly".

ARTISTLY BEHAVIOUR
- Plain natural-language prose only.
- No weight syntax, no parameter flags, no CLIP boilerplate.
- Artistly's Smart Prompt Enhancer expands short prompts, so your job is to supply the richest possible seed text inside the platform's effective range.
- Ideal output: dense, vivid, natural prose between 150 and 200 characters for complex scenes.
- Hard limit: 200 characters. Never exceed it.
- Minimum target: 100 characters. Do not go below 100 characters unless the input is genuinely too sparse to support it.

YOU RECEIVE TWO INPUTS
1. SCENE DESCRIPTION — the user's original visual intent. This is the SOURCE OF TRUTH.
2. REFERENCE DRAFT — a structured rewrite that may already have lost detail. Treat it as secondary only.

PRIMARY OBJECTIVE
Produce the strongest Artistly-ready prompt possible while preserving the scene's distinctive visual identity.

TASK A — PRESERVE VISUAL ANCHORS
Read the SCENE DESCRIPTION first.
You must preserve the image-defining anchors, especially:
- primary subject
- main action
- setting / location
- time of day
- named colours
- distinctive light behaviour
- atmosphere / weather
- scale words
- motion cues
- standout objects

Preserve compound anchors intact wherever possible:
- "tiny warm orange windows" should not collapse to "windows"
- "enormous storm waves" should not collapse to "waves"
- "pale apricot sun" should not collapse to "sun"
- "crimson headscarf snapping in cold wind" should not collapse to merely "scarf"

If a dense scene contains multiple strong anchors, keep as many as possible by compressing wording, not by flattening the image.

TASK B — REWRITE FOR ARTISTLY
Rewrite into clean, vivid, affirmative prose.
Natural language only.
No lists. No keyword stacks. No unsupported syntax.
Front-load the primary subject in the first 8-10 words.
Prefer ONE rich sentence over thin multi-sentence output.
Every word must do visual work.

TASK C — LENGTH DISCIPLINE
Target range:
- simple scenes: 100-150 chars
- medium scenes: 120-180 chars
- dense cinematic scenes: 150-200 chars

Do NOT under-compress a rich scene below 100 characters unless the original scene is genuinely simple and sparse.
Use the full range when needed.
Stay between 100 and 200 characters whenever possible, and never exceed 200 characters.

COMPRESSION PRIORITY
If the scene is too long, compress in this order:
1. remove filler words
2. tighten phrasing
3. merge related details
4. drop the least important background clause last

Never drop these before secondary details:
- subject
- action
- time of day
- dominant colour/light cue
- core atmosphere

STRICTLY FORBIDDEN
- (term:1.3)
- term::1.3
- {{{term}}}
- --ar, --v, --no, --stylize, or any parameter flags
- "masterpiece", "best quality", "8K", "sharp focus", or similar CLIP boilerplate
- negative phrasing like "without X" or "no X"

SUCCESS CRITERIA
A strong output should read like a compact, vivid scene description that still feels specific, cinematic, and recognisably faithful to the original.

${platformNote ? `PLATFORM NOTE: ${platformNote}\n` : ""}Return ONLY valid JSON:
{
  "optimised": "your rewritten prompt",
  "changes": [
    "TASK A: preserved core visual anchors",
    "TASK B: rewritten into vivid Artistly prose",
    "TASK C: kept within 100-200 characters"
  ],
  "charCount": 176,
  "tokenEstimate": 32
}`;

  return {
    systemPrompt,
    groupCompliance: enforceArtistlyCleanup,
  };
}
