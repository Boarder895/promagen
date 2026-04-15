// src/app/api/generate-tier-prompts/route.ts
// ============================================================================
// POST /api/generate-tier-prompts — AI Tier Prompt Generation (Call 2)
// ============================================================================
// Generates all 4 tier prompts directly from the user's human text
// description using the Prompt Intelligence Engine.
//
// v6.1: No-silent-discard — compress, don't cut.
//   - P3 rewritten: PRESERVE APPROVED CONTENT — all elements survive, compress don't drop
//   - T1: DROP ORDER → COMPRESSION ORDER (merge, don't delete)
//   - T3 LENGTH: conditional density rule (rich input = compress, sparse = enrich)
//   - T4: ANCHOR TRIAGE → COMPRESSION PRIORITY (fuse, don't cut)
//   - Camera/lens conversion rule added to T3
//   - Anti-echo-regression sentence added to T3 + T4 echo blocks
// v6.0: Phase B — T2 removed, content invention removed, 3-tier output.
//   - T2 (Midjourney) section deleted from system prompt (moves to Call T2, Phase C)
//   - P3 carve-out: "but not their original sentence position or opening order"
//   - P4 rewritten: "do not preserve the user's wording" — anti-echo at precedence level
//   - T3 LENGTH: enrichment licence (visual properties of existing elements, not new content)
//   - T3 echo: restructuring recipe + simple-input WRONG/RIGHT (bookshop cat)
//   - T4 echo: expanded to match T3 strength + simple-input WRONG/RIGHT
//   - T3 EXPERT VALUE replaced: approved content only, no invented cues
//   - T3 example block replaced with P1-compliant restructuring example
//   - Zod ResponseSchema: tier2 dropped, 3-tier output (tier1, tier3, tier4)
//   - enforceMjParameters() compliance removed (dead code without T2)
//   - TIER_DISPLAY: tier 2 entry removed
// v5.0: Engine-fill removed (P1: user is the only source of creative intent).
//   fill: "engine" branch deleted from user message construction.
//   categoryDecisions now only contains user-typed terms.
//   coverageSeed field added to request schema (Phase A prep for anatomy array).
// v4.5: T4 character ceiling raised 250→325 (SSOT idealMax avg is 277, 7/15 platforms accept 300+).
// v4.4: T2 negative duplication root-cause fix — empty negative field, inline only.
// v4.3: T1 interaction dedup + T4 value-add reframed as conversion not addition.
// v4.2: Strengthened 3 weak fixes from v4.1 3-scene retest.
//   T1: interaction scan/count + 2 more WRONG/RIGHT examples (Fix 1)
//   T3: verb fidelity expanded to 4 WRONG/RIGHT with aggressive rule (Fix 6)
//   T4: value-add bar raised from "one word" to "one visual detail" (Fix 3)
// v4.1: 6 targeted fixes from 20-test dual-assessor trend analysis.
//   T1: interaction preservation + scale modifiers (Fixes 1, 6)
//   T3: "captured" ban + detached tail ban + verb fidelity (Fixes 5, 6)
//   T4: anchor triage + value-add self-check + anti-paraphrase (Fixes 2, 3, 4)
// v4.0: Accepts optional gapIntent + categoryDecisions from the
// Check → Assess → Decide → Generate flow. When present, the user
// message includes user-typed category decisions.
// Backward compatible: omitting gapIntent/categoryDecisions works identically.
//
// Authority: prompt-lab-v4-flow.md §9, ai-disguise.md §5
// Pattern: matches /api/parse-sentence (same rate-limit, env, Zod, error handling)
// Scope: Prompt Lab (/studio/playground) ONLY
// One Brain rule: This does NOT replace assemblePrompt() for the standard builder.
// ============================================================================

import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import {
  deduplicateQualityTokens,
  demoteGenericQualityWeights,
  enforceSubjectHighestWeight,
  enforceT1Syntax,
  ensureT1QualitySuffix,
  normaliseT1Ordering,
  stripT1CameraJargon,
} from "@/lib/harmony-compliance";
import type { ComplianceContext } from "@/lib/harmony-compliance";
import { postProcessTiers } from "@/lib/harmony-post-processing";
import { normaliseTierBundle } from "@/lib/call-2-normalise-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

// ============================================================================
// REQUEST SCHEMA
// ============================================================================

const ProviderContextSchema = z.object({
  /** Platform tier (1–4) */
  tier: z.number().int().min(1).max(4),
  /** Platform name for display in system prompt */
  name: z.string().max(100),
  /** Prompt style: keywords | natural | plain | midjourney */
  promptStyle: z.string().max(50),
  /** Sweet spot token count */
  sweetSpot: z.number().int().min(10).max(2000),
  /** Maximum token limit */
  tokenLimit: z.number().int().min(10).max(5000),
  /** Quality prefix terms */
  qualityPrefix: z.array(z.string().max(50)).max(10).optional(),
  /** Weight syntax pattern (e.g., "{term}::{weight}") */
  weightingSyntax: z.string().max(50).optional(),
  /** Whether the platform supports term weighting */
  supportsWeighting: z.boolean().optional(),
  /** How the platform handles negative prompts */
  negativeSupport: z.enum(["separate", "inline", "none", "converted"]),
});

const RequestSchema = z.object({
  /** The user's original human text description */
  sentence: z
    .string()
    .min(1, "Description cannot be empty")
    .max(1000, "Maximum 1,000 characters"),
  /** Selected provider ID, or null for generic tiers */
  providerId: z.string().max(50).nullable(),
  /** Provider's platform format data (sent by client to avoid server-side file reads) */
  providerContext: ProviderContextSchema.nullable(),
  // ── v4: Category decisions from Check → Assess → Decide flow ──────
  /** Why Call 2 is receiving this shape of input (§9) */
  gapIntent: z.enum(["all-satisfied", "skipped", "user-decided"]).optional(),
  /** Decisions per uncovered category — only present when gapIntent is "user-decided" */
  categoryDecisions: z
    .array(
      z.object({
        category: z.enum([
          "subject",
          "action",
          "style",
          "environment",
          "composition",
          "camera",
          "lighting",
          "colour",
          "atmosphere",
          "materials",
          "fidelity",
          "negative",
        ]),
        fill: z.string().min(1).max(100),
      }),
    )
    .optional(),
  /** Phase A prep: Call 1's matched phrases per category, seeds anatomy array.
   *  Optional — absent on first fire (Call 1/Call 2 run in parallel).
   *  Present on re-fires (provider change) when Call 1 has already returned. */
  coverageSeed: z
    .array(
      z.object({
        category: z.enum([
          "subject",
          "action",
          "style",
          "environment",
          "composition",
          "camera",
          "lighting",
          "colour",
          "atmosphere",
          "materials",
          "fidelity",
          "negative",
        ]),
        matchedPhrases: z.array(z.string().max(200)).max(20),
      }),
    )
    .optional(),
});

// ============================================================================
// RESPONSE SCHEMA
// ============================================================================

/** Anatomy segment schema — maps a substring of the positive prompt to a category */
const AnatomySegmentSchema = z.object({
  text: z.string().max(500),
  category: z.enum([
    "subject",
    "action",
    "style",
    "environment",
    "composition",
    "camera",
    "lighting",
    "colour",
    "atmosphere",
    "materials",
    "fidelity",
    "negative",
    "structural",
  ]),
  source: z.enum([
    "human",
    "user_addition",
    "generated_negative",
    "structural",
  ]),
  locked: z.boolean(),
});

const TierOutputSchema = z.object({
  positive: z.string().max(2000),
  negative: z.string().max(500),
  /** Phase B: anatomy array — optional, GPT may omit. Validated server-side when present. */
  anatomy: z.array(AnatomySegmentSchema).max(50).optional(),
});

const ResponseSchema = z.object({
  tier1: TierOutputSchema,
  tier3: TierOutputSchema,
  tier4: TierOutputSchema,
});

export type GeneratedTierPrompts = z.infer<typeof ResponseSchema>;

// ============================================================================
// TIER NAMES (for system prompt)
// ============================================================================

const TIER_DISPLAY: Record<number, string> = {
  1: "CLIP-Based",
  3: "Natural Language",
  4: "Plain Language",
};

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

function buildSystemPrompt(
  providerContext: z.infer<typeof ProviderContextSchema> | null,
): string {
  // ── Build T1 syntax instruction dynamically (Pattern 1: examples > rules) ──
  // When a provider is selected with known weight syntax, the T1 section's FIRST
  // bullet shows THAT provider's syntax with concrete examples. This is critical
  // because GPT follows the first concrete example in a section (Pattern 2).
  const isDoubleColon = providerContext?.weightingSyntax?.includes("::");
  const isParenthetical = providerContext?.weightingSyntax?.includes("(");
  const hasProvider = providerContext !== null;

  let t1SyntaxInstruction: string;
  if (hasProvider && isDoubleColon) {
    // Provider uses double-colon (e.g., Leonardo)
    t1SyntaxInstruction = `- CRITICAL — The user has selected ${providerContext.name}. This platform uses DOUBLE-COLON weight syntax. You MUST use: term::weight. Example: elderly samurai::1.4, weathered katana::1.3, golden hour::1.2. Do NOT use parenthetical (term:weight) syntax — that is WRONG for ${providerContext.name}. WRONG: (elderly samurai:1.4). RIGHT: elderly samurai::1.4.
- Every weighted term in Tier 1 MUST use the double-colon :: pattern. If you catch yourself writing parentheses around a weight, STOP and rewrite it.`;
  } else if (hasProvider && isParenthetical) {
    // Provider uses parenthetical (e.g., Stable Diffusion)
    t1SyntaxInstruction = `- CRITICAL — The user has selected ${providerContext.name}. This platform uses PARENTHETICAL weight syntax. You MUST use: (term:weight). Example: (elderly samurai:1.4), (weathered katana:1.3), (golden hour:1.2). Do NOT use double-colon term::weight syntax — that is WRONG for ${providerContext.name}.`;
  } else if (hasProvider && !providerContext.supportsWeighting) {
    // Provider doesn't support weighting
    t1SyntaxInstruction = `- The user has selected ${providerContext.name}. This platform does NOT support weight syntax. Output clean comma-separated keywords with NO weight markers — no (term:weight) and no term::weight.`;
  } else {
    // No provider selected — generic parenthetical default
    t1SyntaxInstruction = `- Weighted keyword syntax: you MUST use parenthetical syntax: (term:1.3). Example: (elderly samurai:1.4), (stone bridge:1.2), (golden hour:1.2). Do NOT use double-colon :: syntax.
- Use weight steps in 0.1 increments only: 1.1, 1.2, 1.3, 1.4. Do NOT use 1.15, 1.25, or other fractional steps.
- WEIGHT WRAPPING LIMIT: Do NOT weight-wrap phrases longer than 4 words. Break them into shorter terms. WRONG: (small girl in a yellow raincoat:1.3). RIGHT: (small girl:1.3), yellow raincoat. WRONG: (frost-encrusted orange survival suit:1.3). RIGHT: (survival suit:1.3), frost-encrusted, orange.`;
  }

  // ── Build provider block with CONCRETE EXAMPLE (Pattern 1) ──
  let providerBlock = "";
  if (providerContext) {
    const syntaxExample = isDoubleColon
      ? "masterpiece, best quality, highly detailed, elderly samurai::1.4, stone bridge::1.3, golden hour::1.2, cherry blossoms, sharp focus, 8K"
      : isParenthetical
        ? "masterpiece, best quality, highly detailed, (elderly samurai:1.4), (stone bridge:1.3), (golden hour:1.2), cherry blossoms, sharp focus, 8K"
        : "masterpiece, best quality, highly detailed, elderly samurai, stone bridge, golden hour, cherry blossoms, sharp focus, 8K";

    providerBlock = `
PROVIDER CONTEXT — ACTIVE PLATFORM:
The user has selected ${providerContext.name} (Tier ${providerContext.tier} — ${TIER_DISPLAY[providerContext.tier] ?? "Unknown"}).
This platform uses ${providerContext.promptStyle} format.
${providerContext.weightingSyntax ? `WEIGHT SYNTAX FOR THIS PROVIDER: ${providerContext.weightingSyntax} — YOU MUST USE THIS EXACT SYNTAX in Tier 1. This overrides the generic T1 syntax rules.` : "No weight syntax — output plain keywords in Tier 1."}
Sweet spot: ~${providerContext.sweetSpot} tokens. Token limit: ${providerContext.tokenLimit}.
${providerContext.qualityPrefix?.length ? `Quality prefix: ${providerContext.qualityPrefix.join(", ")}.` : ""}
${providerContext.supportsWeighting ? "This platform supports term weighting." : "This platform does NOT support term weighting — do not include weight syntax."}
Negative support: ${providerContext.negativeSupport}.
Prioritise Tier ${providerContext.tier} output quality — invest the most care in Tier ${providerContext.tier}. Still generate ALL 3 tiers.
Do NOT assume this provider context rewrites the behaviour of every tier — it mainly overrides Tier 1 syntax and biases quality toward Tier ${providerContext.tier}.
CONCRETE EXAMPLE for ${providerContext.name} Tier 1 output (follow this syntax pattern exactly):
${syntaxExample}`;
  }

  return `You are an expert AI image prompt generator for 45 AI image generation platforms.

Given a natural English description, generate 3 different prompt versions optimised for different platform families. Return ONLY valid JSON with no preamble, no markdown, no explanation.

PRECEDENCE LADDER — when any rules compete, resolve conflicts in this strict order:
P1 (SYNTAX): Valid JSON. Correct weight syntax, parameter format, and structural skeleton for each tier. Syntax errors break the prompt — nothing else matters if syntax is wrong.
P2 (NATIVE FEEL): Each tier must feel native to its platform family. T1 = clean weighted keywords. T2 = flowing prose with :: weights and --params. T3 = grammatical sentences from a visual director. T4 = plain language a casual user understands instantly.
P3 (PRESERVE APPROVED CONTENT): Keep the user's primary subject, all approved scene elements, spatial relationships, and emotional intent. Do not silently drop approved content: when space is tight, compress, merge, shorten, or convert elements to their visible effect, but do not remove them. Compression must preserve specific meaning, not replace multiple approved elements with a vague umbrella phrase. Elements do not need to keep their original sentence position, grouping, or opening order. Never drop the emotional layer — convert abstract emotions ("sacred silence", "fading glory") to visual equivalents a camera could capture. T1: one atmosphere keyword. T2: mood woven into descriptive prose (never as a standalone weighted abstract term). T3: feeling shown through sensory language. T4: one plain-language mood phrase.
P4 (RESTRUCTURE FOR PLATFORM): Rephrase, reorder, and regroup the approved content so it reads natively for that tier; preserve scene intent and approved anchors, but do not preserve the user's wording. Do not invent new positive elements, objects, actions, settings, or style cues. For T3 and T4, the opening must be freshly written and must not echo the user's first words or first clause. Source precedence: (1) human text, (2) user-typed gap-fill additions, (3) generated negatives (protective only).
${providerBlock}

The 3 tiers:

TIER 1 — CLIP-Based (e.g., Leonardo, Stable Diffusion, DreamStudio):
${t1SyntaxInstruction}
- SUBJECT MUST ALWAYS CARRY THE HIGHEST WEIGHT (1.3–1.4). Style/lighting 1.2–1.3. Supporting elements 1.1–1.2. Abstract mood terms get the LOWEST weights or no weight at all.
- Weight steps in 0.1 increments only: 1.1, 1.2, 1.3, 1.4. No fractional steps like 1.15 or 1.25.
- Quality prefix: masterpiece, best quality, highly detailed. Quality suffix (append at end): sharp focus, 8K, intricate textures.
- Comma-separated weighted keywords, NOT sentences. No sentence-ending punctuation (no periods, no exclamation marks).
- PHRASE LIMIT: Do NOT weight-wrap phrases longer than 4 words. Break them down. WRONG: (small girl in a yellow raincoat:1.3). RIGHT: (small girl:1.3), yellow raincoat.
- NEVER weight-wrap isolated colour words. Always pair colours with visual context: "yellow reef fish" not "yellows".
- LITERAL LANGUAGE ONLY: CLIP interprets literally. Rewrite anything a camera cannot photograph as a distinct visual element. WRONG: soft wind, quiet determination. RIGHT: (windswept snow:1.2), (solitary figure:1.1). Use "schools of fish" not "clouds of fish", "beams of light" not "rivers of light".
- MERGE DUPLICATES: If 3+ tokens describe the same concept, merge them. WRONG: fine snow, snow flurries, drifting snow. RIGHT: (wind-driven snow patterns:1.2). When two elements interact (light hitting surface, weather affecting object), describe the interaction as one token. WRONG: (copper-orange sunset:1.2), (cold blue mist:1.2). RIGHT: (copper-orange light fading into cold blue:1.3). COLOUR-SKY TRAP: When the input describes ONE sky with multiple colours ("purple and copper sky"), merge into ONE weighted token: (purple-and-copper sky:1.2). Do NOT split into separate tokens like "purple clouds, copper sky" — that wastes budget and loses the unified visual.
- PRESERVE INTERACTIONS: When the input describes one element ACTING ON another (light reflecting off a surface, wind driving snow across ground, sparks falling through air, colour spilling across tiles), describe the interaction as ONE token — not two orphaned objects. The interaction IS the visual.
  SCAN THE INPUT: Before writing Tier 1, count every "element acts on element" pair. Each one MUST become an interaction token. If your output contains two separate weighted objects that interact in the input, you have broken an interaction — merge them. When you create an interaction token, REMOVE the standalone version — do not keep both. WRONG: (strip lights:1.3), (strip lights glaring off scorched metal:1.3). RIGHT: (strip lights glaring off scorched metal:1.3) only.
  WRONG: (gas lamps:1.2), (milk-white haze:1.2) — two static objects, no interaction.
  RIGHT: (gas lamps glowing through haze:1.2) — one interaction event.
  WRONG: (red signal lights:1.2), (wet concrete:1.2) — two surfaces.
  RIGHT: (red signal reflections on wet concrete:1.2) — one visual event.
  WRONG: (stained glass:1.2), (crimson patches:1.2), (marble tiles:1.2) — three fragments.
  RIGHT: (crimson-and-cobalt light across marble:1.2) — one light-on-surface event.
  WRONG: (welding sparks:1.2), (oily air:1.2) — two orphaned objects.
  RIGHT: (welding sparks falling through oily air:1.2) — one motion-through-atmosphere event.
  WRONG: (strip lights:1.3), (scorched metal:1.2) — light source and surface separated.
  RIGHT: (strip lights glaring off scorched metal:1.3) — one reflection event.
- PRESERVE SCALE MODIFIERS: When the input uses a size/intensity word for a major element ("enormous waves", "towering bookcases", "vast cathedral"), keep the modifier. WRONG: (storm waves:1.3). RIGHT: (enormous storm waves:1.3).
- STRICT ORDERING: quality prefix → weighted subject → weighted environment/scene → unweighted supporting details → composition cues → quality suffix. ALL time-of-day and lighting terms MUST be weighted.
- NEGATIVES: Scene-specific quality negatives tailored to what could go wrong with THIS scene. Include 2–3 generic quality terms (blurry, deformed, text) plus 2–3 scene-specific failure modes.
- COMPRESSION ORDER when the input is dense: preserve every approved element. Shorten from the bottom first by merging adjacent low-priority details into compound tokens instead of dropping them. Preferred merge path: minor texture + atmosphere, style + quality, lens + camera, colour + finish. Only shorten wording — never delete an approved element outright.
- Target: ~100 tokens (~350 characters) for creative text.

TIER 3 — Natural Language (e.g., DALL·E, Adobe Firefly, Google Imagen):
Write like an experienced visual director describing a shot, not like a prompt coach giving instructions.
- LENGTH: 280–420 characters, 2–3 sentences. For rich inputs, compress to fit within 420 characters — merge related elements into compound phrases, shorten repeated quality language, and convert technical inputs into concise visible effects, while preserving every approved element in some specific form. Do not select a subset and discard the rest. If multiple low-priority elements will not fit separately, fuse them into one compact phrase rather than omitting them. For sparse inputs, expand only by describing visual properties of elements already present.
- Convert negatives to positive reinforcement ("sharp and clear" not "no blur").
- APPROVED CONTENT ONLY: Use only content from the user's description and their explicit category additions. Restructure, reorder, and convert abstract terms to visual equivalents — but do not add composition, lighting, atmosphere, or style cues not present in the approved inputs. Restructuring IS value-add: changing sentence architecture, leading with environment instead of subject, converting "quiet honour" to "the weight of years visible in weathered armour" — all permitted. Inventing a "low angle" or "cinematic wide-angle" the user never mentioned is NOT permitted.
- CAMERA / LENS CONVERSION: Preserve user-provided camera and lens specs by converting them into visible photographic effects when the raw spec is too technical or space-expensive. Examples: 35mm → moderate wide-angle spatial realism; f/1.4 → soft background separation with sharp focal detail; named camera bodies → premium photoreal capture if space permits. Preserve the effect even when the exact hardware string is shortened or omitted. Do not invent camera effects not supported by the user's spec.
- FIRST SENTENCE MUST RESTRUCTURE, NOT REPEAT. If the user's input begins with [article] [subject] [verb], do not keep that opening shape. Open instead with time, environment, atmosphere, composition, or another strong non-subject element, then place the subject after that opening clause. If no strong non-subject element exists, open with a visual property of the approved scene such as light direction, colour temperature, spatial scale, or air quality. Preserve the user's subject and specific verb, but not in the same opening position or wording. If your first 8 words closely match the user's first 8 words, stop and rewrite from scratch. Preserving all approved content does not require preserving the user's opening order; compression must happen after restructuring, not instead of it.
  WRONG (input: "A cat sits on the windowsill of a cosy bookshop"):
  "A cat sits on the windowsill of a cosy bookshop, watching the rain." — this repeats the user's opening.
  RIGHT: "Inside a cosy bookshop under warm lamplight, a cat watches the rain from a crowded windowsill."
  The RIGHT version leads with setting, repositions the subject after the opening clause, and preserves anchors without echoing the input's structure.
- MOOD CONVERSION IS MANDATORY. If the input contains emotional language, convert it to visual equivalents — never drop it, never state it as meta-commentary. WRONG: "The mood is defiant solitude." RIGHT: "...alone against the driving white expanse, her flare the only warm colour in a world stripped to ice and wind."
- BANNED PHRASES: "rendered as", "in the style of", "should feel like", "meant to look like", "designed to resemble", "intended to appear as", "the image should", "the scene feels", "the scene is", "the mood is", "that feels", "gives the scene". Integrate style as part of the scene itself.
- BANNED TAIL CONSTRUCTIONS: Do NOT end with a detached style/rendering phrase appended after the scene is complete. Any sentence ending that uses "captured" followed by any word (in, with, like, as, through) is BANNED. Also banned: "shot with [style]", "all framed in [style]", "in cinematic [anything]" as a sentence-ending appendage. Style references must be WOVEN INTO the scene description, not bolted on at the end.
  WRONG: "...beneath dark cliffs, captured in cinematic detail."
  WRONG: "...beneath dark cliffs, captured like a period still."
  WRONG: "...beneath dark cliffs, shot with cinematic realism."
  WRONG: "...beneath dark cliffs in cinematic wide-angle detail."
  RIGHT: "...beneath dark cliffs, the chiaroscuro of ruin sharpening every edge."
  RIGHT: "...beneath dark cliffs — a warm beacon in the rain-soaked station."
- VERB FIDELITY: If the user wrote a specific physical verb, that verb appears in your output. Only substitute when the original is genuinely vague ("is", "has", "seems") or abstract ("feels peaceful"). A precise verb that describes a visible action (burn, reflect, explode, curl, whip, flicker, snap, lash, glare, pulse, roll) is NEVER replaced with a softer synonym.
  WRONG (input says "gas lamps burn dimly"): "gas lamps glow faintly". RIGHT: "gas lamps burn dimly".
  WRONG (input says "red signal lights reflect across"): "red lights smear across". RIGHT: "signal lights reflect across".
  WRONG (input says "bow poised above the strings"): "bow held above the strings". RIGHT: "bow poised above the strings".
  WRONG (input says "waves explode against"): "waves crash against". RIGHT: "waves explode against".
- ORDERING: Sentence 1 = subject + action + composition/framing. Sentence 2 = secondary elements + lighting + atmosphere. Optional sentence 3 = environment depth + mood.
- GENDER NEUTRALITY: When the input uses gender-neutral language, your output MUST also be gender-neutral. Use "their" not "his" or "her".
- FULL EXAMPLE:
  INPUT: "An elderly samurai standing on a stone bridge at golden hour, cherry blossoms falling, mist rising from the river below, a sense of quiet honour and fading glory"
  WRONG: "An elderly samurai stands on a stone bridge at golden hour as cherry blossoms fall and mist rises from the river below, with a sense of quiet honour."
  RIGHT: "At golden hour on an ancient stone bridge, an elderly samurai stands amid falling cherry blossoms as mist rises from the river below, the weight of years carved into his weathered armour and the valley beyond dissolving into soft haze."
  WHY: It restructures the sentence architecture (leads with time+place, not subject), converts "quiet honour and fading glory" into a visual equivalent ("the weight of years carved into weathered armour"), and enriches the user's "mist rising" into spatial depth ("valley beyond dissolving into soft haze"). All content comes from the user — no invented composition, lighting, or style cues.

TIER 4 — Plain Language (e.g., Canva, Bing, Freepik):
Plain does NOT mean flat. Keep it easy to understand, but still vivid.
- LENGTH: Maximum 325 characters. Default to 2–3 sentences. Add a third when the scene has depth layers or a distinctive secondary detail that would otherwise be lost.
- Sentence 1: subject + action + one strong visual anchor. State the primary setting EXPLICITLY ("underwater", "in a dense forest", "on a stormy coast at twilight" — never imply it).
- Sentence 2: environment detail + one of: motion (wind, drifting, sweeping), spatial depth (distant, towering, foreground/background), or atmospheric texture (mist, haze, glow). Without this, the output reads as a flat inventory.
- SENTENCE OPENERS: Do NOT start any sentence with "It is" or "There is" — these are the flattest possible openers. Lead with the visual subject or a strong action.
- DO NOT ECHO THE INPUT'S OPENING. Your first sentence must be freshly structured, not a light rewrite of the user's first clause. If the input starts with [article] [subject] [verb], begin with setting, time, atmosphere, or action context instead, then place the subject after that opening clause. If no clear setting or time exists, open with a visible property of the approved scene such as light, colour, scale, or air clarity. Keep the same subject and core action, but not in the same opening order. If your first 8 words land too close to the user's first 8 words, rewrite. Preserving all approved content does not require preserving the user's opening order; compression must happen after restructuring, not instead of it.
  WRONG (input: "A cat sits on the windowsill of a cosy bookshop"):
  "A cat sits on the windowsill of a cosy bookshop, looking out at the rain." — this echoes the user's opening.
  RIGHT: "Inside a cosy bookshop, warm light falls across a windowsill where a cat watches the rain."
- Every sentence MUST be at least 10 words.
- COMPRESSION PRIORITY when space is tight:
  1. Subject + primary action (keep explicit)
  2. Primary setting (keep explicit)
  3. Distinctive secondary details (compress into short modifiers)
  4. Depth / motion / atmosphere cues (merge into one concise phrase where possible)
  5. Camera / lens / quality / colour cues (convert to visible effect or compact quality phrasing)
  Compress from the bottom first, but do not remove approved elements. If separate phrases will not fit, fuse lower-priority elements into compact combined wording instead of cutting them.
- EXPERT VALUE: Instead of trying to add a new element (there is rarely space), CONVERT one existing element into something richer. Change a flat verb to a visual one ("glows" → "casts a muted warmth"), add a spatial relationship to an object ("a train waits" → "a train waits, its fogged windows catching the fluorescent glare"), or enrich a setting detail with a texture the user implied but didn't state ("wet cobbles" → "rain-slick cobbles"). The conversion must change how the scene reads.
  WRONG VALUE-ADD: "...under bright fluorescent glare" (just added "bright" — zero visual change).
  RIGHT VALUE-ADD: "...under fluorescent glare that bleaches the platform white" (converts the light into a surface effect).
  WRONG VALUE-ADD: "At the edge of a hangar, a mechanic stands..." (generic spatial filler).
  RIGHT VALUE-ADD: "Deep in a cavernous hangar, a mechanic stands in the shadow of a damaged starfighter..." (converts position into a spatial relationship).
- SELF-CHECK: Before returning Tier 4, verify you have CONVERTED at least one element — not just preserved it unchanged. If every phrase is a direct copy or minor trim of the user's input, pick the weakest element and enrich it with a texture, a light effect, or a spatial relationship. This is not optional.
- PREFER CONCRETE ANCHORS OVER ABSTRACT MOOD when space is tight. If you must choose between keeping a distinctive visual detail or adding a mood phrase, keep the detail.
- No meta-language: never write "fill the scene", "in this image", "the composition shows", "the scene has/shows/captures". Describe what exists, not the image itself.
- No questions, self-corrections, or negation-then-correction patterns. State what the scene IS, never what it is NOT.
- WRONG: "A lone explorer stands at the edge of a frozen valley at first light, with visible breath, fine snow, and towering ice cliffs." (static checklist, echoes input, no value-add)
- RIGHT: "At first light on a frozen valley's edge, an explorer's breath drifts through cold air as fine snow sweeps the ground. Towering ice cliffs and distant peaks glow pale blue under a vast, crystalline sky."

CRITICAL SCHEMA REMINDER: Every tier value MUST be a JSON object with "positive" and "negative" fields. NEVER return a tier as a flat string. WRONG: "tier1": "masterpiece, ..." — RIGHT: "tier1": { "positive": "masterpiece, ...", "negative": "..." }. If you catch yourself writing a bare string for any tier, STOP and wrap it in {"positive": "...", "negative": "..."}. Generate exactly 3 tiers: tier1, tier3, tier4. Do NOT generate tier2 — Midjourney is handled separately.

Return format:
{
  "tier1": { "positive": "...", "negative": "..." },
  "tier3": { "positive": "...", "negative": "..." },
  "tier4": { "positive": "...", "negative": "..." }
}`;
}

// ============================================================================
// POST-PROCESSING — imported from @/lib/harmony-post-processing
// ============================================================================

// ============================================================================
// OPENING FRESHNESS ENFORCEMENT (T3 / T4)
// ============================================================================

type FreshnessTier = "tier3" | "tier4";

interface OpeningFreshnessResult {
  text: string;
  wasFixed: boolean;
  fixes: string[];
}

const OPENING_WORD_WINDOW = 8;
const SENTENCE_SPLIT_REGEX = /(?<=[.!?])\s+/;
const CLAUSE_SPLIT_REGEX = /\s*(?:,|;|—|–)\s*/;

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

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;
}

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT_REGEX)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
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

function openingsEcho(source: string, candidate: string): boolean {
  const sourceWords = normaliseOpeningWords(source);
  const candidateWords = normaliseOpeningWords(candidate);

  const sampleSize = Math.min(
    OPENING_WORD_WINDOW,
    sourceWords.length,
    candidateWords.length,
  );

  if (sampleSize < 3) {
    return false;
  }

  return (
    sourceWords.slice(0, sampleSize).join(" ") ===
    candidateWords.slice(0, sampleSize).join(" ")
  );
}

function reorderBySentencePriority(
  source: string,
  text: string,
  tier: FreshnessTier,
): OpeningFreshnessResult {
  const sentences = splitSentences(text);
  if (sentences.length < 2) {
    return { text, wasFixed: false, fixes: [] };
  }

  const minimumLeadWords = tier === "tier3" ? 6 : 5;

  for (let i = 1; i < sentences.length; i += 1) {
    const candidateLead = sentences[i];
    if (candidateLead === undefined) {
      continue;
    }

    if (countWords(candidateLead) < minimumLeadWords) {
      continue;
    }

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

    if (!openingsEcho(source, reordered)) {
      return {
        text: reordered,
        wasFixed: true,
        fixes: [`${tier}:sentence_reordered_to_freshen_opening`],
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
  const sentences = splitSentences(text);
  const firstSentence = sentences[0];

  if (firstSentence === undefined) {
    return { text, wasFixed: false, fixes: [] };
  }

  const clauses = firstSentence
    .split(CLAUSE_SPLIT_REGEX)
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
    if (leadClause === undefined) {
      continue;
    }

    if (countWords(leadClause) < minimumLeadWords) {
      continue;
    }

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

    if (!openingsEcho(source, rebuiltText)) {
      return {
        text: rebuiltText,
        wasFixed: true,
        fixes: [`${tier}:clause_rotated_to_freshen_opening`],
      };
    }
  }

  return { text, wasFixed: false, fixes: [] };
}

function enforceOpeningFreshness(
  source: string,
  text: string,
  tier: FreshnessTier,
): OpeningFreshnessResult {
  const trimmedSource = source.trim();
  const trimmedText = text.trim();

  if (trimmedSource.length === 0 || trimmedText.length === 0) {
    return { text, wasFixed: false, fixes: [] };
  }

  if (!openingsEcho(trimmedSource, trimmedText)) {
    return { text, wasFixed: false, fixes: [] };
  }

  const sentenceReorder = reorderBySentencePriority(
    trimmedSource,
    trimmedText,
    tier,
  );
  if (sentenceReorder.wasFixed) {
    return sentenceReorder;
  }

  const clauseRotation = rotateFirstSentenceClauses(
    trimmedSource,
    trimmedText,
    tier,
  );
  if (clauseRotation.wasFixed) {
    return clauseRotation;
  }

  return { text, wasFixed: false, fixes: [] };
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(req: NextRequest): Promise<Response> {
  // ── Rate limit ──────────────────────────────────────────────────────
  const rl = rateLimit(req, {
    keyPrefix: "generate-tier-prompts",
    windowSeconds: 3600,
    max: env.isProd ? 20 : 200,
    keyParts: ["POST", "/api/generate-tier-prompts"],
  });

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message:
          "Generation limit reached. Please wait before generating again.",
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  // ── API key check ───────────────────────────────────────────────────
  const apiKey = env.providers.openAiApiKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: "CONFIG_ERROR", message: "Generation engine not configured." },
      { status: 500 },
    );
  }

  // ── Parse request body ──────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: msg },
      { status: 400 },
    );
  }

  // ── Sanitise input ──────────────────────────────────────────────────
  const sanitised = parsed.data.sentence.replace(/<[^>]*>/g, "").trim();

  if (!sanitised) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: "Description cannot be empty after sanitisation.",
      },
      { status: 400 },
    );
  }

  // ── Build system prompt with optional provider context ──────────────
  const systemPrompt = buildSystemPrompt(parsed.data.providerContext);

  // ── Build composite user message with category decisions (§9) ──────
  // When gapIntent is "user-decided", the user message includes their
  // decisions about how to handle uncovered categories.
  let userMessage = sanitised;
  const { gapIntent, categoryDecisions } = parsed.data;

  if (
    gapIntent === "user-decided" &&
    categoryDecisions &&
    categoryDecisions.length > 0
  ) {
    // P1: Only user-provided terms — no engine-fill (removed v5.0).
    const parts: string[] = [
      sanitised,
      "",
      "CATEGORY DECISIONS (from user assessment):",
      "User-chosen terms (incorporate these naturally into all 4 tiers):",
    ];
    for (const d of categoryDecisions) {
      parts.push(`  - ${d.category}: ${d.fill}`);
    }

    userMessage = parts.join("\n");
  } else if (gapIntent === "skipped") {
    // User acknowledged gaps but chose to ignore them — generate from text alone
    // The engine knows gaps exist but the user explicitly chose not to fill them
    userMessage = sanitised;
  }
  // gapIntent "all-satisfied" or absent — just the human text (original behaviour)

  // ── Append coverage seed if available (Phase A anatomy prep) ────────
  // When Call 1 has already returned (re-fire, provider change), include
  // the phrase→category mapping as structured JSON so GPT can use it for
  // anatomy tagging in Phase B. Kept separate from human text to avoid
  // polluting the user's creative description with metadata.
  const { coverageSeed } = parsed.data;
  if (coverageSeed && coverageSeed.length > 0) {
    const coveredSeeds = coverageSeed.filter(
      (s) => s.matchedPhrases.length > 0,
    );
    if (coveredSeeds.length > 0) {
      const seedJson = JSON.stringify(
        coveredSeeds.map((s) => ({
          category: s.category,
          phrases: s.matchedPhrases,
        })),
      );
      userMessage += `\n\n<category_assessment>${seedJson}</category_assessment>`;
    }
  }

  // ── Call generation engine ──────────────────────────────────────────
  try {
    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5.4-mini",
          temperature: 0.5,
          max_completion_tokens: 2000,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      },
    );

    if (!openaiRes.ok) {
      let errData: Record<string, unknown> = {};
      try {
        errData = (await openaiRes.json()) as Record<string, unknown>;
      } catch {
        // Can't parse error body
      }

      // Content policy rejection (§11)
      const error = errData?.error as Record<string, unknown> | undefined;
      if (
        openaiRes.status === 400 &&
        error?.code === "content_policy_violation"
      ) {
        console.error(
          "[generate-tier-prompts] Content policy rejection for input length:",
          sanitised.length,
        );
        return NextResponse.json(
          {
            error: "CONTENT_POLICY",
            message:
              "Your description contains content that our engine cannot process. Please revise your description and try again.",
          },
          { status: 400 },
        );
      }

      // Rate limit (429)
      if (openaiRes.status === 429) {
        console.error("[generate-tier-prompts] Engine rate limited");
        return NextResponse.json(
          {
            error: "API_ERROR",
            message: "Engine is busy. Please try again in a moment.",
          },
          { status: 429 },
        );
      }

      console.error("[generate-tier-prompts] Engine error:", openaiRes.status);
      return NextResponse.json(
        {
          error: "API_ERROR",
          message: "Failed to generate prompts. Please try again.",
        },
        { status: 502 },
      );
    }

    const openaiData = await openaiRes.json();

    // Content policy check for 200 with content_filter (§11 pattern 2)
    const choices = openaiData?.choices as
      | Array<Record<string, unknown>>
      | undefined;
    if (choices?.[0]?.finish_reason === "content_filter") {
      console.error(
        "[generate-tier-prompts] Content policy filter for input length:",
        sanitised.length,
      );
      return NextResponse.json(
        {
          error: "CONTENT_POLICY",
          message:
            "Your description contains content that our engine cannot process. Please revise your description and try again.",
        },
        { status: 400 },
      );
    }

    const content = openaiData?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error(
        "[generate-tier-prompts] Empty engine response:",
        openaiData,
      );
      return NextResponse.json(
        {
          error: "API_ERROR",
          message: "Empty response from engine. Please try again.",
        },
        { status: 502 },
      );
    }

    // ── Parse and validate response ───────────────────────────────────
    let jsonParsed: unknown;
    try {
      jsonParsed = JSON.parse(content);
    } catch {
      console.error(
        "[generate-tier-prompts] Invalid JSON from engine:",
        content,
      );
      return NextResponse.json(
        {
          error: "PARSE_ERROR",
          message: "Engine returned invalid data. Please try again.",
        },
        { status: 502 },
      );
    }

    // ── Schema repair: wrap flat-string tiers into { positive, negative } ──
    // GPT occasionally returns "tier1": "text" instead of "tier1": { "positive": "text", "negative": "..." }.
    // The v4.5 harness showed 4.5% of samples failing for this exact pattern.
    // This deterministic normaliser rescues them before Zod validation.
    const normalised = normaliseTierBundle(jsonParsed);
    if (normalised.wasRepaired) {
      console.debug(
        "[generate-tier-prompts] Schema repair:",
        normalised.repairs.join("; "),
      );
    }

    const validated = ResponseSchema.safeParse(normalised.data);
    if (!validated.success) {
      console.error(
        "[generate-tier-prompts] Schema validation failed:",
        validated.error.issues,
      );
      return NextResponse.json(
        {
          error: "PARSE_ERROR",
          message:
            "Engine response did not match expected format. Please try again.",
        },
        { status: 502 },
      );
    }

    // ── Anatomy validation: verify concatenation equals positive ────────
    // When GPT returns anatomy, the concatenation of all segment texts
    // must exactly equal the positive string. If not, discard the anatomy
    // (graceful fallback to substring matching — same as pre-Phase B).
    const tierKeys = ["tier1", "tier3", "tier4"] as const;
    for (const key of tierKeys) {
      const tier = validated.data[key];
      if (tier.anatomy && tier.anatomy.length > 0) {
        const concatenated = tier.anatomy.map((s) => s.text).join("");
        if (concatenated !== tier.positive) {
          console.debug(
            `[generate-tier-prompts] Anatomy concat mismatch for ${key} — discarding anatomy. ` +
              `Expected ${tier.positive.length} chars, got ${concatenated.length}.`,
          );
          // Discard invalid anatomy — Zod already validated the shape,
          // but concatenation is a semantic rule Zod can't check.
          (tier as Record<string, unknown>).anatomy = undefined;
        }
      }
    }

    // ── Post-process: catch engine mechanical errors ──────────────────
    // Phase B: GPT returns 3 tiers (no tier2). Inject empty tier2 so
    // postProcessTiers receives the full TierPrompts shape it expects.
    // deduplicateMjParams on empty string is a no-op — zero cost.
    const fullTiers = {
      ...validated.data,
      tier2: { positive: "", negative: "" },
    };
    const processed = postProcessTiers(fullTiers);

    // ── Compliance gate: deterministic syntax validation (P4/P5) ──
    // This is the permanent safety net — catches what the engine misses, 100% of the time.
    let compliant = processed;
    if (parsed.data.providerContext) {
      const compCtx: ComplianceContext = {
        weightingSyntax: parsed.data.providerContext.weightingSyntax,
        supportsWeighting:
          parsed.data.providerContext.supportsWeighting ?? false,
        providerName: parsed.data.providerContext.name,
        tier: parsed.data.providerContext.tier,
      };

      // P4: T1 syntax compliance
      const t1Result = enforceT1Syntax(processed.tier1.positive, compCtx);
      if (t1Result.wasFixed) {
        compliant = {
          ...compliant,
          tier1: { ...compliant.tier1, positive: t1Result.text },
        };
        console.debug(
          "[generate-tier-prompts] P4 compliance fix:",
          t1Result.fixes.join("; "),
        );
      }
    }

    // Call 2 code-enforcement pivot (v6.1 baseline + deterministic quality gates)
    // P17 (stripT1CameraJargon) runs first — remove junk before weight analysis
    const t1Passes = [
      stripT1CameraJargon,
      enforceSubjectHighestWeight,
      demoteGenericQualityWeights,
      deduplicateQualityTokens,
      ensureT1QualitySuffix,
      normaliseT1Ordering,
    ] as const;

    let t1Text = compliant.tier1.positive;
    const t1Fixes: string[] = [];
    for (const pass of t1Passes) {
      const result = pass(t1Text);
      if (result.wasFixed) {
        t1Text = result.text;
        t1Fixes.push(...result.fixes);
      }
    }

    if (t1Fixes.length > 0) {
      compliant = {
        ...compliant,
        tier1: { ...compliant.tier1, positive: t1Text },
      };
      console.debug(
        "[generate-tier-prompts] Call 2 code-enforcement fixes:",
        t1Fixes.join("; "),
      );
    }

    // ── Opening-freshness enforcement (T3 priority, then T4) ──────────
    const openingFreshnessFixes: string[] = [];
    let freshnessCompliant = compliant;

    const tierFreshnessOrder: readonly FreshnessTier[] = ["tier3", "tier4"];

    for (const tierKey of tierFreshnessOrder) {
      const freshness = enforceOpeningFreshness(
        sanitised,
        freshnessCompliant[tierKey].positive,
        tierKey,
      );

      if (freshness.wasFixed) {
        freshnessCompliant = {
          ...freshnessCompliant,
          [tierKey]: {
            ...freshnessCompliant[tierKey],
            positive: freshness.text,
          },
        };
        openingFreshnessFixes.push(...freshness.fixes);
      }
    }

    compliant = freshnessCompliant;

    if (openingFreshnessFixes.length > 0) {
      console.debug(
        "[generate-tier-prompts] Opening freshness fixes:",
        openingFreshnessFixes.join("; "),
      );
    }

    // P5: T2 MJ parameter compliance — REMOVED (Phase B).
    // Midjourney is no longer generated by Call 2. Moves to Call T2 (Phase C).

    // ── Return compliance-gated tier prompts ─────────────────────────
    return NextResponse.json(
      { tiers: compliant },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    console.error("[generate-tier-prompts] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
      { status: 500 },
    );
  }
}
