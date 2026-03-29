// src/app/api/generate-tier-prompts/route.ts
// ============================================================================
// POST /api/generate-tier-prompts — AI Tier Prompt Generation (Call 2)
// ============================================================================
// Generates all 4 tier prompts directly from the user's human text
// description using the Prompt Intelligence Engine.
//
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
// message includes category decisions (engine-fill vs user-chosen terms).
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
import { enforceT1Syntax, enforceMjParameters } from "@/lib/harmony-compliance";
import type { ComplianceContext } from "@/lib/harmony-compliance";
import { postProcessTiers } from "@/lib/harmony-post-processing";

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
});

// ============================================================================
// RESPONSE SCHEMA
// ============================================================================

const TierOutputSchema = z.object({
  positive: z.string().max(2000),
  negative: z.string().max(500),
});

const ResponseSchema = z.object({
  tier1: TierOutputSchema,
  tier2: TierOutputSchema,
  tier3: TierOutputSchema,
  tier4: TierOutputSchema,
});

export type GeneratedTierPrompts = z.infer<typeof ResponseSchema>;

// ============================================================================
// TIER NAMES (for system prompt)
// ============================================================================

const TIER_DISPLAY: Record<number, string> = {
  1: "CLIP-Based",
  2: "Midjourney Family",
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
Prioritise Tier ${providerContext.tier} output quality — invest the most care in Tier ${providerContext.tier}. Still generate ALL 4 tiers.
Do NOT assume this provider context rewrites the behaviour of every tier — it mainly overrides Tier 1 syntax and biases quality toward Tier ${providerContext.tier}.
CONCRETE EXAMPLE for ${providerContext.name} Tier 1 output (follow this syntax pattern exactly):
${syntaxExample}`;
  }

  return `You are an expert AI image prompt generator for 45 AI image generation platforms.

Given a natural English description, generate 4 different prompt versions optimised for different platform families. Return ONLY valid JSON with no preamble, no markdown, no explanation.

PRECEDENCE LADDER — when any rules compete, resolve conflicts in this strict order:
P1 (SYNTAX): Valid JSON. Correct weight syntax, parameter format, and structural skeleton for each tier. Syntax errors break the prompt — nothing else matters if syntax is wrong.
P2 (NATIVE FEEL): Each tier must feel native to its platform family. T1 = clean weighted keywords. T2 = flowing prose with :: weights and --params. T3 = grammatical sentences from a visual director. T4 = plain language a casual user understands instantly.
P3 (PRESERVE ANCHORS): Keep the user's primary subject, 3 strongest scene elements, spatial relationships, and emotional intent. Never drop the emotional layer — convert abstract emotions ("sacred silence", "fading glory") to visual equivalents a camera could capture. T1: one atmosphere keyword. T2: mood woven into descriptive prose (never as a standalone weighted abstract term). T3: feeling shown through sensory language. T4: one plain-language mood phrase.
P4 (ADD EXPERT VALUE): Every tier must contain at least one element the user did NOT provide. Priority order: composition/framing cue first, then lighting technique, then atmosphere detail, then style/medium reference. Reformatting is not value-add — your addition must be something the user did not mention at all.
${providerBlock}

The 4 tiers:

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
- DROP ORDER when the input is dense (cut from the bottom first): subject > core scene nouns > lighting/time-of-day > style > composition cue > atmosphere > minor texture/garnish.
- Target: ~100 tokens (~350 characters) for creative text.

TIER 2 — Midjourney Family:
BLOCK 1 — POSITIVE PROMPT SKELETON:
- Descriptive prose with :: weighting. Minimum 3 weighted :: clauses. Subject clause carries the highest weight.
- Place :: weights at the END of complete descriptive clauses, NEVER mid-phrase. WRONG: "lone researcher::2.0 standing in the blizzard". RIGHT: "lone researcher standing in the blizzard::2.0".
- Do NOT use abstract emotional terms as standalone weighted clauses. WRONG: "quiet bittersweet atmosphere::1.2". Weave mood into descriptive prose or convert to visual equivalents.
- Include at least one art style or rendering medium reference (e.g., concept art, cinematic still, fantasy illustration).
- Include at least one composition or framing cue NOT in the user's input.
- Target: ~300 characters for creative text (before parameters). Prioritise completeness over brevity.

BLOCK 2 — NEGATIVES:
- ALL negatives MUST follow a --no flag. Without --no, Midjourney treats negatives as positive prompt — this REVERSES their meaning.
- 5–8 negatives. Scene-specific first (what could go wrong with THIS scene), then 2–3 generic quality terms (text, watermark, blurry). Do NOT default to "extra limbs, distorted anatomy" unless the scene prominently features human anatomy.
- IMPORTANT: For Tier 2, ALL negatives go INSIDE the positive field after --no. The separate "negative" JSON field for Tier 2 MUST be an empty string "". Do NOT write negatives in both places — that causes duplication.

BLOCK 3 — MANDATORY PARAMETERS:
- EVERY prompt MUST end with: --ar [ratio] --v 7 --s [value] --no [negatives].
- --ar: 16:9 landscapes, 9:16 portraits, 1:1 balanced, 3:2 standard photography.
- --s: 500 default, 750 for highly stylistic scenes.
- If ANY of --ar, --v, --s, or --no is missing, the prompt is structurally incomplete.
- STRICT ORDERING: weighted subject → environment/scene → style/composition → --ar --v --s → --no LAST.

BLOCK 4 — STRUCTURAL EXAMPLE (follow this pattern exactly):
  elderly samurai standing on a stone bridge at golden hour::2.0, cherry blossoms falling through warm amber light and mist rising from the river below::1.4, cinematic concept art with ukiyo-e influences::1.2, wide establishing shot, weathered armour catching the last light, serene stillness across the valley --ar 16:9 --v 7 --s 500 --no modern buildings, cars, text, watermark, blurry, extra people

SELF-CHECK — before returning Tier 2, verify: (1) 3+ weighted :: clauses present, (2) --ar, --v, --s, --no all present, (3) "--no" appears EXACTLY ONCE in the entire Tier 2 output. If "--no" appears more than once, you have duplicated the negative block — delete the duplicate immediately. Write the negatives ONCE and STOP. Do NOT continue writing after the last negative term.

TIER 3 — Natural Language (e.g., DALL·E, Adobe Firefly, Google Imagen):
Write like an experienced visual director describing a shot, not like a prompt coach giving instructions.
- LENGTH: 280–420 characters, 2–3 sentences. Select the 4–5 most impactful visual elements — do not try to preserve everything from a long input.
- Convert negatives to positive reinforcement ("sharp and clear" not "no blur").
- EXPERT VALUE PRIORITY: Add in this order: (1) composition/framing cue, (2) lighting/atmosphere detail, (3) style/medium reference woven naturally. Each must be something the user did NOT provide.
- FIRST SENTENCE MUST RESTRUCTURE, NOT REPEAT. This is the most common failure in this tier. Your opening MUST NOT begin with the same subject + location + time phrasing as the user's input. Count: if your first 8 words closely match the user's first 8 words, you are paraphrasing — STOP and rewrite from scratch. Lead with composition, time, or environment — then position the subject within it.
  WRONG (input starts "A weathered lighthouse keeper stands on the rain-soaked gallery deck"): "A weathered lighthouse keeper stands on the rain-soaked gallery deck, gripping..." — this is the user's sentence with minor edits.
  RIGHT: "From a low vantage on the storm-lashed coast, a lone figure grips the iron railing of a lighthouse gallery deck as twilight waves detonate against the rocks below..."
  The RIGHT version restructures the spatial perspective, leads with composition, and repositions the subject within a new framing. The user's words are preserved as anchors but the sentence architecture is yours.
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
  RIGHT: "An elderly samurai stands at the centre of a stone bridge in warm golden-hour light, viewed from a low angle that frames him against falling cherry blossoms and the mist-wrapped valley beyond, the weight of years carved into his weathered armour as soft haze drifts through the fading light."
  WHY: It adds "low angle" (composition), "cinematic wide-angle detail" (style), "soft atmospheric haze" (atmosphere), and "centre of the frame" (framing) — four expert additions the user did NOT provide. It converts "quiet honour and fading glory" into "the weight of years visible in his weathered armour" — visual, not abstract.

TIER 4 — Plain Language (e.g., Canva, Bing, Freepik):
Plain does NOT mean flat. Keep it easy to understand, but still vivid.
- LENGTH: Maximum 325 characters. Default to 2–3 sentences. Add a third when the scene has depth layers or a distinctive secondary detail that would otherwise be lost.
- Sentence 1: subject + action + one strong visual anchor. State the primary setting EXPLICITLY ("underwater", "in a dense forest", "on a stormy coast at twilight" — never imply it).
- Sentence 2: environment detail + one of: motion (wind, drifting, sweeping), spatial depth (distant, towering, foreground/background), or atmospheric texture (mist, haze, glow). Without this, the output reads as a flat inventory.
- SENTENCE OPENERS: Do NOT start any sentence with "It is" or "There is" — these are the flattest possible openers. Lead with the visual subject or a strong action.
- DO NOT ECHO THE INPUT'S OPENING. Your first sentence must not reproduce the user's first 8 words in the same order. Restructure: lead with environment, time, or action instead.
  WRONG (input starts "A weathered lighthouse keeper stands on the rain-soaked gallery deck at twilight"): "A weathered lighthouse keeper stands on a rain-soaked gallery deck at twilight, with storm waves crashing below." — this is the user's sentence with minor edits.
  RIGHT: "At twilight on the rain-lashed coast, a lighthouse keeper grips the gallery railing as storm waves crash below."
- Every sentence MUST be at least 10 words.
- ANCHOR TRIAGE — when space is tight, keep in this priority order, cut from the bottom:
  1. Subject + primary action (never cut)
  2. Primary setting (never cut)
  3. The ONE most distinctive secondary detail — the element that makes this scene unlike any other. If removing it would make the scene generic, it MUST survive.
  4. One depth/motion/atmosphere cue
  5. Additional secondary details
  Identify the distinctive detail BEFORE writing. Ask: "What single element would a viewer remember most after the subject?" That element must survive compression.
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

Return format:
{
  "tier1": { "positive": "...", "negative": "..." },
  "tier2": { "positive": "...prompt text... --ar 16:9 --v 7 --s 500 --no negatives here", "negative": "" },
  "tier3": { "positive": "...", "negative": "..." },
  "tier4": { "positive": "...", "negative": "..." }
}`;
}

// ============================================================================
// POST-PROCESSING — imported from @/lib/harmony-post-processing
// ============================================================================

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
    const engineFills = categoryDecisions.filter((d) => d.fill === "engine");
    const manualFills = categoryDecisions.filter((d) => d.fill !== "engine");

    const parts: string[] = [
      sanitised,
      "",
      "CATEGORY DECISIONS (from user assessment):",
    ];

    if (engineFills.length > 0) {
      parts.push(
        `Engine-fill categories (add expert-level content for these): ${engineFills.map((d) => d.category).join(", ")}`,
      );
    }

    if (manualFills.length > 0) {
      parts.push(
        "User-chosen terms (incorporate these naturally into all 4 tiers):",
      );
      for (const d of manualFills) {
        parts.push(`  - ${d.category}: ${d.fill}`);
      }
    }

    userMessage = parts.join("\n");
  } else if (gapIntent === "skipped") {
    // User acknowledged gaps but chose to ignore them — generate from text alone
    // The engine knows gaps exist but the user explicitly chose not to fill them
    userMessage = sanitised;
  }
  // gapIntent "all-satisfied" or absent — just the human text (original behaviour)

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

    const validated = ResponseSchema.safeParse(jsonParsed);
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

    // ── Post-process: catch engine mechanical errors ──────────────────
    const processed = postProcessTiers(validated.data);

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

    // P5: T2 MJ parameter compliance (always, regardless of provider)
    const t2Result = enforceMjParameters(processed.tier2.positive);
    if (t2Result.wasFixed) {
      compliant = {
        ...compliant,
        tier2: { ...compliant.tier2, positive: t2Result.text },
      };
      console.debug(
        "[generate-tier-prompts] P5 compliance fix:",
        t2Result.fixes.join("; "),
      );
    }

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
