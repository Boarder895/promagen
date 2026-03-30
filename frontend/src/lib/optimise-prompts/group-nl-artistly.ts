// src/lib/optimise-prompts/group-nl-artistly.ts
// ============================================================================
// DEDICATED BUILDER: Artistly — Independent System Prompt (v3.0.0)
// ============================================================================
// Tier 4 | negativeSupport: none | architecture: natural-language
//
// ★ SSOT REFERENCE IMPLEMENTATION (v3.0.0 — 30 Mar 2026)
//   Character limits are read from ctx (sourced from platform-config.json):
//     ctx.idealMin  → minimum acceptable output length
//     ctx.idealMax  → hard ceiling (never exceed)
//     ctx.sweetSpot → soft target for dense scenes
//   Both the system prompt AND the compliance gate use these values.
//   Change platform-config.json → Call 3 behaviour changes. One source of truth.
//
// Platform knowledge: Artistly auto-expands short inputs via a Smart Prompt
//   Enhancer. The optimiser delivers an anchor-dense seed prompt in clean
//   natural prose inside the effective range.
//
// FULLY INDEPENDENT — no shared imports from other builders.
// Existing features preserved: Yes.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from "./types";
import type { ComplianceResult } from "@/lib/harmony-compliance";

// ============================================================================
// CONSTANTS (behavioural — NOT character limits, those come from ctx)
// ============================================================================

// If clause-dropping would shrink more than this in one step, reject it
// and fall back to boundary trimming. Prevents catastrophic over-compression.
const MAX_SINGLE_DROP = 70;

const CLIP_QUALITY_TOKENS = [
  "masterpiece", "best quality", "highly detailed",
  "intricate textures", "sharp focus", "8K", "4K",
];

const MJ_FLAGS = [
  "ar", "v", "s", "stylize", "chaos", "weird", "tile",
  "repeat", "seed", "stop", "iw", "niji", "raw", "no",
];

const FILLER_PATTERNS: RegExp[] = [
  /\bvery\s+/gi, /\breally\s+/gi, /\bextremely\s+/gi, /\bquite\s+/gi,
  /\bbeautifully\s+/gi, /\bstunningly\s+/gi, /\bvisually\s+/gi,
  /\bscene of\s+/gi, /\bimage of\s+/gi, /\bdepiction of\s+/gi,
  /\bfeaturing\s+/gi, /\bshowing\s+/gi, /\bwith detailed\b/gi,
  /\bhighly realistic\b/gi, /\bhyper realistic\b/gi, /\bphotorealistic\b/gi,
];

const WEAK_ENDING_PATTERNS: RegExp[] = [
  /,\s*all in [^,.;:!?]+$/i,
  /,\s*in cinematic [^,.;:!?]+$/i, /,\s*with cinematic [^,.;:!?]+$/i,
  /,\s*in dramatic [^,.;:!?]+$/i, /,\s*with dramatic [^,.;:!?]+$/i,
  /,\s*in vivid detail$/i, /,\s*highly detailed$/i, /,\s*detailed$/i,
];

const CLAUSE_DROP_ORDER: RegExp[] = [
  /,\s*[^,.;:!?]{0,120}(?:intricate|detailed|refined|polished|cinematic|dramatic)[^,.;:!?]{0,120}$/i,
  /,\s*[^,.;:!?]{0,120}(?:background|backdrop)[^,.;:!?]{0,120}$/i,
  /,\s*[^,.;:!?]{0,120}(?:distant|far-off|far off)[^,.;:!?]{0,120}$/i,
];

const DANGLING_END_WORDS =
  /\b(?:and|or|with|without|behind|before|after|over|under|through|into|onto|from|to|of|in|on|at|as|while|amid|beneath)\b$/i;

// ============================================================================
// TEXT NORMALISATION
// ============================================================================

function normaliseWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])([^\s])/g, "$1 $2")
    .replace(/\s{2,}/g, " ")
    .trim();
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

function pruneDanglingTail(text: string): string {
  let out = cleanPunctuation(text);
  let guard = 0;
  while (DANGLING_END_WORDS.test(out) && guard < 3) {
    out = out.replace(DANGLING_END_WORDS, "").trim();
    out = cleanPunctuation(out);
    guard += 1;
  }
  return out;
}

// ============================================================================
// SYNTAX & TOKEN STRIPPING
// ============================================================================

function stripWeightSyntax(text: string): { text: string; changed: boolean } {
  let cleaned = text;
  const before = cleaned;
  cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, "$1");
  cleaned = cleaned.replace(/\{{1,3}\s*([^{}]+?)\s*\}{1,3}/g, "$1");
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

function stripClipQualityTokens(text: string): { text: string; fixes: string[] } {
  let cleaned = text;
  const fixes: string[] = [];
  for (const token of CLIP_QUALITY_TOKENS) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[\\s,])${escaped}(?=$|[\\s,])`, "gi");
    const before = cleaned;
    cleaned = cleaned.replace(re, " ");
    if (cleaned !== before) fixes.push(`Stripped CLIP token "${token}"`);
  }
  return { text: cleaned, fixes };
}

// ============================================================================
// COMPRESSION HELPERS
// ============================================================================

function compressByFillerRemoval(text: string): string {
  let out = text;
  for (const pattern of FILLER_PATTERNS) out = out.replace(pattern, "");
  return pruneDanglingTail(out);
}

function compressWeakEnding(text: string): string {
  let out = text;
  for (const pattern of WEAK_ENDING_PATTERNS) out = out.replace(pattern, "");
  return pruneDanglingTail(out);
}

function compressLongPhrases(text: string): string {
  let out = text;
  const replacements: Array<[RegExp, string]> = [
    [/\bat first light\b/gi, "at dawn"],
    [/\bat last light\b/gi, "at dusk"],
    [/\bin the cold wind\b/gi, "in cold wind"],
    [/\bin the warm wind\b/gi, "in warm wind"],
    [/\bglows through\b/gi, "glows in"],
    [/\bstretch across\b/gi, "stretch over"],
    [/\bwhile\b/gi, "as"],
    [/\bin the distance\b/gi, "beyond"],
    [/\bin the background\b/gi, "behind"],
    [/\bin the foreground\b/gi, "up close"],
  ];
  for (const [pattern, replacement] of replacements) out = out.replace(pattern, replacement);
  return pruneDanglingTail(out);
}

function trimTrailingClause(text: string): string {
  for (const pattern of CLAUSE_DROP_ORDER) {
    const candidate = text.replace(pattern, "");
    if (candidate !== text) return pruneDanglingTail(candidate);
  }
  return text;
}

function hardTrimAtBoundary(text: string, ceiling: number): string {
  const cleaned = pruneDanglingTail(text);
  if (cleaned.length <= ceiling) return cleaned;
  const slice = cleaned.slice(0, ceiling + 1);
  const lastBoundary = Math.max(
    slice.lastIndexOf(","), slice.lastIndexOf(";"),
    slice.lastIndexOf("."), slice.lastIndexOf(" "),
  );
  const trimmed = lastBoundary > Math.floor(ceiling * 0.7)
    ? slice.slice(0, lastBoundary)
    : cleaned.slice(0, ceiling);
  return pruneDanglingTail(trimmed);
}

// ============================================================================
// INTELLIGENT TRIM — 5-stage compression pipeline
// ============================================================================
// All limits (min, max, softTarget) are passed as parameters, NOT hardcoded.
// The builder function reads them from ctx and passes them in.
// ============================================================================

function intelligentTrim(
  text: string,
  min: number,
  max: number,
): { text: string; fixes: string[] } {
  const fixes: string[] = [];
  let current = pruneDanglingTail(text);

  if (current.length <= max) return { text: current, fixes };

  const startLength = current.length;
  let safeCeilingCandidate: string | null = null;

  // Stage 1: filler removal
  const stage1 = compressByFillerRemoval(current);
  if (stage1.length < current.length) {
    fixes.push(`Compression stage 1: removed filler (${current.length} -> ${stage1.length})`);
    current = stage1;
  }
  if (current.length <= max) {
    fixes.push(`Trimmed to ${current.length} chars within ceiling`);
    return { text: current, fixes };
  }

  // Stage 2: phrase tightening
  const stage2 = compressLongPhrases(current);
  if (stage2.length < current.length) {
    fixes.push(`Compression stage 2: tightened phrasing (${current.length} -> ${stage2.length})`);
    current = stage2;
  }
  if (current.length <= max) {
    fixes.push(`Trimmed to ${current.length} chars within ceiling`);
    return { text: current, fixes };
  }

  // Save a ceiling-respecting candidate as rescue fallback
  safeCeilingCandidate = hardTrimAtBoundary(current, max);

  // Stage 3: weak ending removal
  const stage3 = compressWeakEnding(current);
  if (stage3.length < current.length) {
    fixes.push(`Compression stage 3: removed weak ending (${current.length} -> ${stage3.length})`);
    current = stage3;
  }
  if (current.length <= max) {
    fixes.push(`Trimmed to ${current.length} chars within ceiling`);
    return { text: current, fixes };
  }

  // Refresh ceiling candidate after weak-ending removal
  const refreshed = hardTrimAtBoundary(current, max);
  if (refreshed.length >= min) safeCeilingCandidate = refreshed;

  // Stage 4: clause drops (with catastrophe guard)
  let loopGuard = 0;
  while (current.length > max && loopGuard < 5) {
    const next = trimTrailingClause(current);
    if (next === current) break;
    const drop = current.length - next.length;
    if (next.length < min || drop > MAX_SINGLE_DROP) {
      fixes.push(`Compression stage 4.${loopGuard + 1}: rejected clause drop (${current.length} -> ${next.length}, drop=${drop})`);
      break;
    }
    fixes.push(`Compression stage 4.${loopGuard + 1}: dropped clause (${current.length} -> ${next.length})`);
    current = next;
    loopGuard += 1;
  }

  // Stage 5: hard boundary trim
  if (current.length > max) {
    const before = current.length;
    current = hardTrimAtBoundary(current, max);
    if (current.length < before) {
      fixes.push(`Compression stage 5: boundary trim (${before} -> ${current.length})`);
    }
  }

  // Under-length rescue: if we dropped below min, use the safest candidate
  if (current.length < min && safeCeilingCandidate && safeCeilingCandidate.length >= min) {
    fixes.push(`Under-length rescue: used ceiling candidate (${current.length} -> ${safeCeilingCandidate.length})`);
    current = safeCeilingCandidate;
  }

  if (current.length < startLength) {
    fixes.push(`Final length ${current.length}/${max}`);
  }

  return { text: current, fixes };
}

// ============================================================================
// COMPLIANCE GATE FACTORY
// ============================================================================
// Returns a compliance function with ctx limits captured via closure.
// The groupCompliance signature is (text: string) => ComplianceResult —
// the limits are baked in, not passed at call time.
// ============================================================================

function createArtistlyCompliance(
  min: number,
  max: number,
  softTarget: number,
): (text: string) => ComplianceResult {
  return function enforceArtistlyCleanup(text: string): ComplianceResult {
    const fixes: string[] = [];
    let cleaned = text;

    // Strip unsupported syntax
    const weightResult = stripWeightSyntax(cleaned);
    cleaned = weightResult.text;
    if (weightResult.changed) fixes.push("Stripped unsupported weight syntax");

    const flagResult = stripMjFlags(cleaned);
    cleaned = flagResult.text;
    if (flagResult.changed) fixes.push("Stripped unsupported parameter flags");

    const qualityResult = stripClipQualityTokens(cleaned);
    cleaned = qualityResult.text;
    fixes.push(...qualityResult.fixes);

    // Remove negative phrasing (Artistly doesn't support negatives)
    cleaned = cleaned
      .replace(/\bwithout\s+[^,.;:!?]+/gi, "")
      .replace(/\bno\s+[^,.;:!?]+/gi, "");
    cleaned = pruneDanglingTail(cleaned);

    // Intelligent trim using config-driven limits
    const trimResult = intelligentTrim(cleaned, min, max);
    cleaned = trimResult.text;
    fixes.push(...trimResult.fixes);

    // Diagnostics
    if (cleaned.length > 0 && cleaned.length < min) {
      fixes.push(`Below minimum length (${cleaned.length}/${min} chars)`);
    } else if (cleaned.length >= softTarget && cleaned.length <= max) {
      fixes.push(`Good density for Artistly (${cleaned.length} chars)`);
    }

    return { text: cleaned, wasFixed: fixes.length > 0, fixes };
  };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildArtistlyPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  // ★ Read limits from ctx (sourced from platform-config.json)
  const min = ctx.idealMin;
  const max = ctx.idealMax;
  const sweetSpot = ctx.sweetSpot;
  const platformNote = ctx.groupKnowledge ?? "";

  const systemPrompt = `You are an expert prompt optimiser for "Artistly".

ARTISTLY BEHAVIOUR
- Plain natural-language prose only.
- No weight syntax, no parameter flags, no CLIP boilerplate.
- Artistly auto-expands prompts via a Smart Prompt Enhancer, so your job is to supply an anchor-dense seed prompt, not a generic summary.
- HARD OUTPUT RANGE: ${min}–${max} characters (inclusive). Never exceed ${max}. Avoid going under ${min}.

YOU RECEIVE TWO INPUTS
1. SCENE DESCRIPTION — the user's original visual intent. This is the SOURCE OF TRUTH.
2. REFERENCE DRAFT — may already have lost detail. Treat it as secondary only.

PRIMARY OBJECTIVE
Produce the strongest Artistly-ready prompt possible while preserving the scene's distinctive visual identity.

TASK A — PRESERVE VISUAL ANCHORS
Read the SCENE DESCRIPTION first.
Preserve the image-defining anchors, especially:
- primary subject and action
- setting + time of day
- named colours
- distinctive lighting
- atmosphere / weather
- motion cues
- standout objects

Compression rule: shorten wording BEFORE dropping anchors.
If you must drop something, drop secondary background context last.

TASK B — REWRITE FOR ARTISTLY
Rewrite into clean, vivid, affirmative prose.
Natural language only. No lists. No keyword stacks.
Prefer ONE rich sentence.
Front-load the primary subject in the first 8–10 words.

TASK C — LENGTH DISCIPLINE
Before returning JSON:
1) Count characters in "optimised" exactly.
2) If > ${max}, compress by removing filler and tightening phrasing. Only then drop the least important clause.
3) If < ${min}, add missing anchors from the SCENE DESCRIPTION until you are within range.
Aim for ${sweetSpot}–${max} characters on dense cinematic scenes.

STRICTLY FORBIDDEN
- (term:1.3)
- term::1.3
- {{{term}}}
- any --flags like --ar, --v, --no
- "masterpiece", "best quality", "8K", "sharp focus", or similar boilerplate
- negative phrasing like "without X" or "no X"

${platformNote ? `PLATFORM NOTE: ${platformNote}\n` : ""}Return ONLY valid JSON:
{
  "optimised": "your rewritten prompt",
  "changes": [
    "TASK A: preserved key visual anchors from the scene description",
    "TASK B: rewritten into vivid Artistly prose",
    "TASK C: kept within ${min}-${max} characters"
  ],
  "charCount": 176,
  "tokenEstimate": 32
}`;

  return {
    systemPrompt,
    // ★ Compliance gate reads limits from ctx via closure — not hardcoded
    groupCompliance: createArtistlyCompliance(min, max, sweetSpot),
  };
}
