// src/lib/optimise-prompts/group-nl-artistly.ts
// ============================================================================
// DEDICATED BUILDER: Artistly — Independent System Prompt (v4.0.0)
// ============================================================================
// Tier 4 | negativeSupport: none | architecture: natural-language
//
// ★ SSOT REFERENCE IMPLEMENTATION (v4.0.0 — 31 Mar 2026)
//
//   KEY ARCHITECTURAL CHANGE from v3:
//     GPT's job:  aim for idealMin–idealMax (the quality target range).
//     Gate's job:  strip bad syntax + enforce maxChars (the platform limit).
//     The gate does NOT hard-trim to idealMax. If GPT returns 236 chars of
//     clean prose and maxChars is 500, the gate passes it through untouched.
//     Destructive trimming only fires when the platform limit is exceeded.
//
//   Config values from ctx (sourced from platform-config.json):
//     ctx.idealMin  → quality floor (GPT target, soft warning if under)
//     ctx.idealMax  → quality ceiling (GPT target, soft warning if over)
//     ctx.sweetSpot → soft target for dense scenes (GPT target)
//     ctx.maxChars  → platform hard limit (gate enforces this)
//
// Platform knowledge: Artistly auto-expands short inputs via Smart Prompt
//   Enhancer. The optimiser delivers an anchor-dense seed prompt.
//
// FULLY INDEPENDENT — no shared imports from other builders.
// Existing features preserved: Yes.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from "./types";
import type { ComplianceResult } from "@/lib/harmony-compliance";

// ============================================================================
// CONSTANTS (behavioural — NOT character limits, those come from ctx)
// ============================================================================

// If clause-dropping would shrink more than this in one step, reject it.
const MAX_SINGLE_DROP = 70;

// Fallback hard ceiling when maxChars is null (platform has no stated limit).
const DEFAULT_HARD_CEILING = 5000;

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
// COMPRESSION HELPERS (only used when above platform hard limit)
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

// ── Point 4: prefer comma boundaries over word boundaries ────────────
// Cutting at a comma loses a whole clause cleanly.
// Cutting at a space can orphan an adjective from its noun ("black" without "mountains").
function hardTrimAtBoundary(text: string, ceiling: number): string {
  const cleaned = pruneDanglingTail(text);
  if (cleaned.length <= ceiling) return cleaned;

  const slice = cleaned.slice(0, ceiling + 1);

  // Prefer structural boundaries (comma, semicolon, period) over word boundary
  const lastComma = slice.lastIndexOf(",");
  const lastSemicolon = slice.lastIndexOf(";");
  const lastPeriod = slice.lastIndexOf(".");
  const bestStructural = Math.max(lastComma, lastSemicolon, lastPeriod);

  // Only fall back to word boundary if no structural boundary in the back 40%
  const floorPos = Math.floor(ceiling * 0.6);
  if (bestStructural > floorPos) {
    return pruneDanglingTail(slice.slice(0, bestStructural));
  }

  // No good structural boundary — use last space
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > floorPos) {
    return pruneDanglingTail(slice.slice(0, lastSpace));
  }

  // Edge case: no good boundary at all — hard cut
  return pruneDanglingTail(cleaned.slice(0, ceiling));
}

// ============================================================================
// PLATFORM LIMIT TRIM — only fires when above maxChars
// ============================================================================
// This is the safety net. GPT should have stayed under idealMax (200).
// If GPT overshot to e.g. 236, and that's under maxChars (500), the gate
// does NOT trim — it passes through with a soft warning.
// This pipeline only runs when the text exceeds the platform hard limit.
// ============================================================================

function platformLimitTrim(
  text: string,
  hardCeiling: number,
  idealMin: number,
): { text: string; fixes: string[] } {
  const fixes: string[] = [];
  let current = pruneDanglingTail(text);

  if (current.length <= hardCeiling) return { text: current, fixes };

  const startLength = current.length;

  // Stage 1: filler removal
  const stage1 = compressByFillerRemoval(current);
  if (stage1.length < current.length) {
    fixes.push(`Compression stage 1: removed filler (${current.length} -> ${stage1.length})`);
    current = stage1;
  }
  if (current.length <= hardCeiling) {
    fixes.push(`Within platform limit at ${current.length} chars`);
    return { text: current, fixes };
  }

  // Stage 2: phrase tightening
  const stage2 = compressLongPhrases(current);
  if (stage2.length < current.length) {
    fixes.push(`Compression stage 2: tightened phrasing (${current.length} -> ${stage2.length})`);
    current = stage2;
  }
  if (current.length <= hardCeiling) {
    fixes.push(`Within platform limit at ${current.length} chars`);
    return { text: current, fixes };
  }

  // Stage 3: weak ending removal
  const stage3 = compressWeakEnding(current);
  if (stage3.length < current.length) {
    fixes.push(`Compression stage 3: removed weak ending (${current.length} -> ${stage3.length})`);
    current = stage3;
  }
  if (current.length <= hardCeiling) {
    fixes.push(`Within platform limit at ${current.length} chars`);
    return { text: current, fixes };
  }

  // Stage 4: clause drops (with catastrophe guard)
  let loopGuard = 0;
  while (current.length > hardCeiling && loopGuard < 5) {
    const next = trimTrailingClause(current);
    if (next === current) break;
    const drop = current.length - next.length;
    if (next.length < idealMin || drop > MAX_SINGLE_DROP) {
      fixes.push(`Compression stage 4.${loopGuard + 1}: rejected clause drop (${current.length} -> ${next.length}, drop=${drop})`);
      break;
    }
    fixes.push(`Compression stage 4.${loopGuard + 1}: dropped clause (${current.length} -> ${next.length})`);
    current = next;
    loopGuard += 1;
  }

  // Stage 5: hard boundary trim (comma-preferred)
  if (current.length > hardCeiling) {
    const before = current.length;
    current = hardTrimAtBoundary(current, hardCeiling);
    if (current.length < before) {
      fixes.push(`Compression stage 5: boundary trim (${before} -> ${current.length})`);
    }
  }

  if (current.length < startLength) {
    fixes.push(`Final length ${current.length}/${hardCeiling}`);
  }

  return { text: current, fixes };
}

// ============================================================================
// COMPLIANCE GATE FACTORY
// ============================================================================
// Returns a compliance function with ctx limits captured via closure.
//
// v4.0 architecture:
//   1. Strip bad syntax (weights, flags, CLIP tokens, negatives) — always
//   2. If length <= maxChars (500): pass through. Log soft warning if over idealMax.
//   3. If length > maxChars (500): run platformLimitTrim to bring under the hard limit.
//   4. Log diagnostics for under-length or good-density.
// ============================================================================

function createArtistlyCompliance(
  idealMin: number,
  idealMax: number,
  softTarget: number,
  hardCeiling: number,
): (text: string) => ComplianceResult {
  return function enforceArtistlyCleanup(text: string): ComplianceResult {
    const fixes: string[] = [];
    let cleaned = text;

    // ── Always: strip unsupported syntax ───────────────────────────────
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

    // ── Length enforcement: maxChars only ──────────────────────────────
    if (cleaned.length > hardCeiling) {
      // Above platform limit — must trim to prevent rejection
      const trimResult = platformLimitTrim(cleaned, hardCeiling, idealMin);
      cleaned = trimResult.text;
      fixes.push(...trimResult.fixes);
    } else if (cleaned.length > idealMax) {
      // Between idealMax and hardCeiling — GPT overshot the quality target
      // but the platform will accept it. Pass through with soft warning.
      fixes.push(`Above ideal range (${cleaned.length}/${idealMax} chars) — platform limit is ${hardCeiling}`);
    }

    // ── Diagnostics ───────────────────────────────────────────────────
    if (cleaned.length > 0 && cleaned.length < idealMin) {
      fixes.push(`Below ideal minimum (${cleaned.length}/${idealMin} chars)`);
    } else if (cleaned.length >= softTarget && cleaned.length <= idealMax) {
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
  const idealMin = ctx.idealMin;
  const idealMax = ctx.idealMax;
  const sweetSpot = ctx.sweetSpot;
  const hardCeiling = ctx.maxChars ?? DEFAULT_HARD_CEILING;
  const platformNote = ctx.groupKnowledge ?? "";

  const systemPrompt = `You optimise image prompts for Artistly.

PLATFORM KNOWLEDGE:
Artistly is a plain-language platform with a Smart Prompt Enhancer that auto-expands short prompts. Your job is to deliver a dense, vivid seed — not a complete description. Artistly responds best to concrete nouns, specific colours, strong verbs, and clear spatial relationships. It does NOT need atmosphere padding, quality clichés, or verbose scene-setting.

LENGTH RULES:
HARD: Do not exceed ${hardCeiling} characters.
SOFT: You may lengthen or shorten freely. The goal is the best prompt, not a specific length. Shorter and denser beats longer and padded.

OPTIMISATION RULES — do ALL of these:

1. SUBJECT FIRST: The primary subject must be the first 1–3 words. Not "At midnight in a cramped alley, a courier..." but "Rain-drenched courier in a cramped alley at midnight..." Strip all scene-setting openers.

2. UPGRADE VERBS: Replace generic verbs with stronger, more visual ones. "pauses" → "leans". "grips" → "clutches". "gives off" → "casts". Every verb should paint a picture. Do NOT just use synonyms — the replacement must be more visually evocative.

3. TWO SENTENCES. FULL STOPS. NON-NEGOTIABLE.
Sentence 1: the hero shot — subject, action, primary visual. Ends with a full stop.
Sentence 2: environment, atmosphere, background. Ends with a full stop.
FAILURE: a single sentence with commas, semicolons, "while", "as", or "and" chaining 3+ clauses. If your output has no full stop before the final full stop, it is REJECTED. Count your full stops before returning.

4. ONE COMPOSITION CUE: Add one natural composition or framing cue woven into the prose. Not "low angle" bolted between commas. Instead: "seen from below" or "looming overhead" or "framed by" — embedded in the description, not tagged on.

5. STRIP FILLER: Remove words that add length but not visual information. "At twilight on a rain-lashed coast" → "on a rain-lashed coast at twilight" (setting after subject). Remove "while", "as", "beneath" chains that pad clause count.

6. KEEP ALL ANCHORS. ADD NOTHING.
Every named subject, object, colour, light source, and distinctive detail from the input must survive in your output. Shorten wording, never drop anchors.
DO NOT invent content that is not in the input. No new colours, no new objects, no new atmosphere words, no style labels like "neon-noir" or "painterly cinematic" unless those exact words appear in the input. If a word is not in the input prompt, it does not belong in your output.

FORBIDDEN SYNTAX:
(term:1.3), term::1.3, {{{term}}}, --flags, "masterpiece", "best quality", "8K", "sharp focus", negative phrasing like "without X" or "no X".

BEFORE → AFTER EXAMPLES:

BEFORE:
At twilight on a rain-lashed coast, a weathered lighthouse keeper grips the iron railing on the gallery deck. Below, enormous storm waves smash the jagged rocks and throw salt spray into a purple-and-copper sky, while the lighthouse beam cuts a pale gold arc through driving rain. Tiny warm orange windows glow in the distant fishing village against dark cliffs.

AFTER:
Weathered lighthouse keeper clutches the iron gallery railing as enormous storm waves shatter against jagged rocks below, salt spray rising into a purple-and-copper twilight sky. A pale gold lighthouse beam slices through driving rain toward a distant fishing village glowing with tiny warm orange windows beneath dark cliffs.

WHY: Subject moved to word 1. "grips" → "clutches", "smash" → "shatter", "cuts" → "slices" — stronger verbs. Three sentences compressed to two with full stops. "iron gallery railing" places the viewer on the deck. All anchors preserved. Nothing invented.

BEFORE:
At midnight in a cramped cyberpunk alley, a rain-drenched courier pauses beneath a flickering magenta-and-cyan noodle sign, one gloved hand resting on a dented motorbike. Steam pours from street vents, and neon reflections smear across black puddles.

AFTER:
Rain-drenched courier leans against a dented motorbike beneath a flickering magenta-and-cyan noodle sign in a cramped midnight alley. Steam spills from street vents as neon reflections streak across black puddles.

WHY: Subject at word 1. "pauses" → "leans" (more visual), "pours" → "spills", "smear" → "streak". Two clean sentences with full stops. All anchors kept. Nothing invented.
${platformNote ? `\nPLATFORM NOTE: ${platformNote}` : ""}

Return ONLY valid JSON:
{
  "optimised": "Hero sentence about the subject and action. Environment sentence about atmosphere and background.",
  "changes": ["subject front-loaded", "upgraded N verbs", "2 sentences with full stops", "added composition cue", "no content invented"],
  "charCount": 250,
  "tokenEstimate": 45
}`;

  return {
    systemPrompt,
    // ★ Gate enforces maxChars (platform limit), NOT idealMax (quality target)
    groupCompliance: createArtistlyCompliance(idealMin, idealMax, sweetSpot, hardCeiling),
    // ★ 0.5 instead of default 0.4 — testing whether higher temp breaks GPT
    //   out of clause-chaining habit for sentence structure compliance
    temperature: 0.5,
  };
}
