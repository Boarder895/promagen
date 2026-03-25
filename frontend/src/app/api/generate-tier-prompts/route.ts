// src/app/api/generate-tier-prompts/route.ts
// ============================================================================
// POST /api/generate-tier-prompts — AI Tier Prompt Generation (Call 2)
// ============================================================================
// Generates all 4 tier prompts directly from the user's human text
// description using the Prompt Intelligence Engine.
//
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

import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { enforceT1Syntax, enforceMjParameters } from '@/lib/harmony-compliance';
import type { ComplianceContext } from '@/lib/harmony-compliance';
import { postProcessTiers } from '@/lib/harmony-post-processing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
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
  negativeSupport: z.enum(['separate', 'inline', 'none', 'converted']),
});

const RequestSchema = z.object({
  /** The user's original human text description */
  sentence: z
    .string()
    .min(1, 'Description cannot be empty')
    .max(1000, 'Maximum 1,000 characters'),
  /** Selected provider ID, or null for generic tiers */
  providerId: z.string().max(50).nullable(),
  /** Provider's platform format data (sent by client to avoid server-side file reads) */
  providerContext: ProviderContextSchema.nullable(),
  // ── v4: Category decisions from Check → Assess → Decide flow ──────
  /** Why Call 2 is receiving this shape of input (§9) */
  gapIntent: z.enum(['all-satisfied', 'skipped', 'user-decided']).optional(),
  /** Decisions per uncovered category — only present when gapIntent is "user-decided" */
  categoryDecisions: z.array(z.object({
    category: z.enum([
      'subject', 'action', 'style', 'environment', 'composition', 'camera',
      'lighting', 'colour', 'atmosphere', 'materials', 'fidelity', 'negative',
    ]),
    fill: z.string().min(1).max(100),
  })).optional(),
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
  1: 'CLIP-Based',
  2: 'Midjourney Family',
  3: 'Natural Language',
  4: 'Plain Language',
};

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

function buildSystemPrompt(providerContext: z.infer<typeof ProviderContextSchema> | null): string {
  // ── Build T1 syntax instruction dynamically (Pattern 1: examples > rules) ──
  // When a provider is selected with known weight syntax, the T1 section's FIRST
  // bullet shows THAT provider's syntax with concrete examples. This is critical
  // because GPT follows the first concrete example in a section (Pattern 2).
  const isDoubleColon = providerContext?.weightingSyntax?.includes('::');
  const isParenthetical = providerContext?.weightingSyntax?.includes('(');
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
  let providerBlock = '';
  if (providerContext) {
    const syntaxExample = isDoubleColon
      ? 'masterpiece, best quality, highly detailed, elderly samurai::1.4, stone bridge::1.3, golden hour::1.2, cherry blossoms, sharp focus, 8K'
      : isParenthetical
        ? 'masterpiece, best quality, highly detailed, (elderly samurai:1.4), (stone bridge:1.3), (golden hour:1.2), cherry blossoms, sharp focus, 8K'
        : 'masterpiece, best quality, highly detailed, elderly samurai, stone bridge, golden hour, cherry blossoms, sharp focus, 8K';

    providerBlock = `
PROVIDER CONTEXT (OVERRIDES GENERIC TIER RULES):
The user has selected ${providerContext.name} (Tier ${providerContext.tier} — ${TIER_DISPLAY[providerContext.tier] ?? 'Unknown'}).
This platform uses ${providerContext.promptStyle} format.
${providerContext.weightingSyntax ? `WEIGHT SYNTAX FOR THIS PROVIDER: ${providerContext.weightingSyntax} — YOU MUST USE THIS EXACT SYNTAX.` : 'No weight syntax — output plain keywords.'}
Sweet spot: ~${providerContext.sweetSpot} tokens. Token limit: ${providerContext.tokenLimit}.
${providerContext.qualityPrefix?.length ? `Quality prefix: ${providerContext.qualityPrefix.join(', ')}.` : ''}
${providerContext.supportsWeighting ? 'This platform supports term weighting.' : 'This platform does NOT support term weighting — do not include weight syntax.'}
Negative support: ${providerContext.negativeSupport}.
Prioritise Tier ${providerContext.tier} output quality — this is the tier the user will use.
CONCRETE EXAMPLE for ${providerContext.name} Tier 1 output (follow this syntax pattern exactly):
${syntaxExample}`;
  }

  return `You are an expert AI image prompt generator for 45 AI image generation platforms.

Given a natural English description, generate 4 different prompt versions optimised for different platform families. Return ONLY valid JSON with no preamble, no markdown, no explanation.

The 4 tiers:

TIER 1 — CLIP-Based (e.g., Leonardo, Stable Diffusion, DreamStudio):
${t1SyntaxInstruction}
- Front-load subject and style with highest weights (1.3–1.4 for subject, 1.2–1.3 for style/lighting)
- SUBJECT MUST ALWAYS CARRY THE HIGHEST WEIGHT in the entire prompt. No mood, atmosphere, or secondary element may have a higher weight than the primary subject.
- Quality prefix: masterpiece, best quality, highly detailed
- Quality suffix: sharp focus, 8K, intricate textures (add at end)
- Comma-separated weighted keywords, NOT sentences
- Rich phrases longer than 4 words should NOT be weight-wrapped — break into shorter weighted terms instead. WRONG: (small girl in a yellow raincoat:1.3). RIGHT: (small girl:1.3), yellow raincoat. WRONG: (suspended inside skeletal remains of a sunken Gothic cathedral:1.3). RIGHT: (sunken Gothic cathedral:1.3), skeletal remains, suspended inside.
- MERGE related micro-elements into semantic clusters. Do NOT list the same visual concept as multiple separate tokens. WRONG: fine snow, snow flurries, soft wind, drifting snow (4 tokens for 1 concept — wastes token budget and dilutes signal). RIGHT: (wind-driven snow patterns:1.2), drifting flurries (2 tokens, semantically distinct). Each token should describe a DIFFERENT visual element, not the same element phrased slightly differently. Before finalising, scan your output for any group of 3+ tokens describing the same concept and merge them. COMMON OVERLAP TRAP — time-of-day and lighting: "first light", "early sun", "dawn glow", "morning rays" all describe the same lighting condition. Pick the ONE strongest term and weight it. WRONG: (first light:1.2), (early sun:1.2) (two tokens for one concept). RIGHT: (first light:1.2) (one token, clean). Similarly for colour pairs: "pale blue ice" and "silver highlights" describing the same surface → merge to (pale blue-silver ice:1.2). INTERACTION MERGING — when two visual elements interact (light hitting a surface, colour mixing, weather affecting an object), describe the INTERACTION as one token, not the elements separately. WRONG: (copper-orange sunset:1.2), (cold blue mist:1.2) (two separate tokens for a light interaction). RIGHT: (copper-orange light fading into cold blue:1.3) (one interaction token). WRONG: (electric blue glow:1.2), (pale green glow:1.2) (same bioluminescence split into two). RIGHT: (electric blue-green bioluminescence:1.2) (one unified visual phenomenon).
- Use weight steps in 0.1 increments only: 1.1, 1.2, 1.3, 1.4. Do NOT use 1.15, 1.25, or other fractional steps.
- NEVER weight-wrap isolated colour words (e.g., "yellows", "orange"). Always pair colours with their visual context (e.g., "yellow reef fish", "orange coral").
- CLIP interprets LITERALLY — avoid metaphorical language. Use "schools of fish" not "clouds of fish", "beams of light" not "rivers of light", "patches of coral" not "carpet of coral". Every term must describe something visually concrete. This includes sensory and abstract modifiers that a camera cannot photograph. WRONG: soft wind, subtle footsteps, quiet determination, gentle warmth. RIGHT: (windswept snow:1.2), (footprints in snow:1.1), (solitary figure:1.1), (warm amber glow:1.1). If a camera cannot photograph it as a distinct visual element, rewrite it as something it CAN photograph.
- Separate negative prompt with common quality negatives
- MANDATORY: Include at least one composition or camera term NOT in the user's input (e.g., wide scene, cinematic composition, central subject, underwater perspective, volumetric lighting). This is your expert value-add.
- STRICT ORDERING: quality prefix → weighted subject → weighted environment/scene → unweighted supporting details → composition cues → quality suffix. Follow this order exactly. ALL time-of-day and lighting terms (dawn, golden hour, first light, moonlight, overcast, etc.) MUST be weighted — they are primary visual drivers, not supporting details. WRONG: first light (naked, unweighted, lost in the middle). RIGHT: (first light:1.2) placed in the environment/scene block.
- NO sentence-ending punctuation. No periods, exclamation marks, or question marks. CLIP prompts are comma-separated keyword lists, not sentences.
- Target: ~100 tokens (~350 characters) for creative text

TIER 2 — Midjourney Family (e.g., Midjourney, BlueWillow):
- Descriptive prose with style weighting via :: syntax (e.g., cinematic::2.0)
- EVERY Midjourney prompt MUST contain at least 3 weighted :: clauses. A prompt with zero :: weights is structurally incomplete.
- SUBJECT MUST CARRY THE HIGHEST :: WEIGHT. Mood and atmosphere terms must have lower weights than the subject. Do NOT give abstract terms like "quiet magic" or "beauty" the highest weight — weight the visual subject and key visual elements highest.
- Place :: weights at the END of complete descriptive clauses, NEVER mid-phrase. WRONG: "lone researcher::2.0 standing in the blizzard" (weight placed mid-clause, breaks the description). RIGHT: "lone researcher standing in the blizzard::2.0" (weight after the complete descriptive clause). WRONG: "war mech::2.0 slumped against a wall" (clause continues after weight). RIGHT: "war mech slumped against the foundry wall::2.0" (weight closes the complete thought).
- CRITICAL — --no FLAG IS MANDATORY. ALL negative/exclusion terms MUST come after a --no flag. Without --no, Midjourney treats everything as positive prompt. Negatives placed inline WITHOUT --no will DAMAGE the image by adding the unwanted elements. This is the most common structural error — do NOT make it.
- Negatives MUST be scene-specific, not boilerplate. For an underwater scene use "--no above water, murky, foggy, dark". For a portrait use "--no cropped, out of frame". Do NOT default to "extra limbs, distorted anatomy" unless the scene features human anatomy prominently.
- MANDATORY: Include at least one art style or rendering medium reference (e.g., digital painting, concept art, fantasy illustration, underwater photography, cinematic still). This anchors the model's aesthetic interpretation.
- MANDATORY: Include at least one composition or framing cue NOT in the user's input (e.g., wide underwater view, cinematic framing, central subject, dramatic perspective).
- Do NOT use abstract emotional terms as standalone weighted clauses. WRONG: "quiet bittersweet atmosphere::1.2" (not visually renderable). RIGHT: "golden ethereal stillness::1.0" or simply weave mood into descriptive prose without weighting. Convert emotions to visual equivalents before applying :: weights.
- Rich artistic and mood descriptors work well
- STRICT ORDERING: weighted subject first → environment/scene description → style/composition cues → --ar and --v and --s parameters → --no negatives LAST. The positive description must be fully complete before any parameters begin.
- MANDATORY PARAMETERS: EVERY Midjourney prompt MUST end with --ar [ratio] --v 7 --s [value] --no [negatives]. If ANY of --ar, --v, --s, or --no is missing, the prompt is structurally incomplete. Choose --ar based on the scene: 16:9 for landscapes, 9:16 for portraits, 1:1 for balanced compositions, 3:2 for standard photography. --s 500 is default; raise to 750 for highly stylistic scenes.
- STRUCTURAL EXAMPLE (follow this pattern exactly):
  elderly samurai standing on a stone bridge at golden hour::2.0, cherry blossoms falling through warm amber light and mist rising from the river below::1.4, cinematic concept art with ukiyo-e influences::1.2, wide establishing shot, weathered armour catching the last light, serene stillness across the valley --ar 16:9 --v 7 --s 500 --no modern buildings, cars, text, watermark, blurry, extra people (negatives appear exactly ONCE — never repeat this block)
- Target: ~300 characters for creative text (before parameters). Richer inputs may need more space — prioritise completeness over brevity.
- FINAL RULE FOR THIS TIER — SELF-CHECK BEFORE FINISHING: Count how many times "--no" appears in your Tier 2 output. If it appears more than ONCE, you have duplicated the negative block — delete everything after the FIRST "--no" block's final term. There must be EXACTLY ONE "--no" in the entire Tier 2 output. WRONG: "...--no text, watermark, blurry text, watermark, blurry" (the block repeated — you wrote it twice). RIGHT: "...--no text, watermark, blurry" (written once, stopped). This is the single most common structural error. Check your output NOW before returning it.

TIER 3 — Natural Language (e.g., DALL·E, Adobe Firefly, Google Imagen):
- CRITICAL LENGTH CONSTRAINT: Your output MUST be 250–350 characters (2–4 sentences). This means you MUST compress a long input — select the 4–5 most impactful visual elements, do not try to preserve everything. Exceeding 400 characters is a structural failure.
- Full grammatical sentences describing the scene
- Describe as if telling an artist what to paint — spatial relationships, prepositions, poetry preserved
- Include lighting, atmosphere, and composition naturally within sentences
- Convert negatives to positive reinforcement ("sharp and clear" not "no blur")
- CRITICAL: Do NOT return a lightly edited version of the user's input. You are a prompt engineer, not a paraphraser. The output must demonstrate expert knowledge the user does not have.
- STRUCTURAL EXAMPLE — read carefully:
  INPUT: "An elderly samurai standing on a stone bridge at golden hour, cherry blossoms falling, mist rising from the river below, a sense of quiet honour and fading glory"
  WRONG (paraphrase — adds nothing): "An elderly samurai stands on a stone bridge at golden hour as cherry blossoms fall and mist rises from the river below, with a sense of quiet honour."
  RIGHT (engineered — adds expert value): "An elderly samurai stands at the centre of a stone bridge in warm golden-hour light, viewed from a low angle that frames him against falling cherry blossoms and the mist-wrapped valley beyond, with the weight of years visible in his weathered armour — captured in cinematic wide-angle detail with soft atmospheric haze."
  WHY THE RIGHT VERSION IS BETTER: It adds "low angle" (composition), "cinematic wide-angle detail" (style), "soft atmospheric haze" (atmosphere), and "centre of the frame" (framing) — four expert additions the user did NOT provide. It also converts "quiet honour and fading glory" into visual equivalents ("weight of years visible in his weathered armour") instead of dropping the mood.
- FIRST SENTENCE MUST RESTRUCTURE, NOT REPEAT. Your opening sentence must NOT begin with the same subject + location + time-of-day phrasing as the user's input. Restructure by leading with composition, time, or environment — then position the subject within it. WRONG opening (input says "A lone explorer at the edge of a frozen valley at first light"): "A lone explorer stands at the edge of a vast frozen valley at first light..." (this is the user's words with minor rewording — you have added nothing). RIGHT opening: "At the break of dawn, a solitary figure is framed low against towering ice cliffs at the mouth of a vast frozen valley..." (restructured: leads with time, repositions subject, adds composition cue). If your first 8 words closely match the user's first 8 words, you are paraphrasing — rewrite.
- MANDATORY: Weave an art style or medium reference naturally into the description — do NOT use explicit rendering directives. BANNED PHRASES: "rendered as", "in the style of", "should feel like", "meant to look like", "designed to resemble", "intended to appear as", "the image should", "the scene feels", "the scene is", "the mood is", "that feels". Instead, integrate style as part of the scene itself (e.g., "a luminous digital fantasy scene of..." or "with the vivid clarity of underwater photography" or "in cinematic wide-angle detail"). The style must feel like a natural part of the description, never a meta-instruction to the model. Mood and atmosphere must be SHOWN through visual description, not STATED as meta-commentary. WRONG: "The scene feels emotionally quiet" (meta-commentary about mood). WRONG: "a clarity that feels immense and resolute" (meta-commentary — "that feels" tells the reader how to feel instead of showing them). RIGHT: "...bathed in a hushed amber stillness, where the weight of time settles softly across the frame" (mood expressed through visual and sensory language). RIGHT: "under an immense, hushed clarity" (the quality IS immense — stated directly, not via "feels"). Do NOT drop mood entirely — always preserve the user's emotional intent through visual equivalents.
- MOOD CONVERSION IS MANDATORY. If the input contains emotional language ("sacred silence", "bittersweet hope", "defiant solitude", "fading glory"), you MUST convert it to visual equivalents in your output — never drop it. WRONG: drop "defiant solitude" entirely. ALSO WRONG: "The mood is defiant solitude." RIGHT: "...alone against the driving white expanse, her flare the only warm colour in a world stripped to ice and wind." Convert the feeling into something a camera could capture.
- MANDATORY: Add at least one composition or camera cue NOT in the user's input (e.g., "viewed from below looking up toward the surface", "in a wide cinematic underwater scene", "with the subject centred in the frame").
- MANDATORY: Add at least one atmospheric or lighting detail NOT in the user's input (e.g., "with luminous tropical clarity", "dappled caustic light patterns on the seabed", "god rays piercing the blue depths").
- STRICT ORDERING across 2–4 sentences: Sentence 1 = subject + primary action + composition/style. Sentence 2 = secondary visual elements + lighting. Sentence 3 (if needed) = environment + atmosphere. Keep rendering style woven in, not stated as a separate directive.
- GENDER NEUTRALITY: When the input uses gender-neutral language ("a person", "an explorer", "a figure", "someone"), your output MUST also be gender-neutral. Use "their" not "his" or "her". Only use gendered pronouns when the input explicitly specifies gender.

TIER 4 — Plain Language (e.g., Canva, Bing, Freepik):
- CRITICAL LENGTH CONSTRAINT: Maximum 250 characters total. If you exceed 250, cut the weakest sentence. This tier must be SHORT — casual users paste these directly.
- Simple, focused, short description
- Minimal technical jargon — a non-expert should understand it
- MUST be 2–3 short sentences: first sentence for the subject and action with key elements, second sentence for the environment, optional third sentence for mood/atmosphere if needed
- Keep all key visual anchors from the input — do not over-compress. Include the subject and at least 3 supporting visual elements, but do NOT list more than 5 elements in a single sentence.
- MANDATORY SCENE DEPTH: Every T4 output MUST include at least ONE of: motion (wind, flowing, drifting, sweeping), spatial depth (foreground/background layering, "distant" or "towering"), or atmospheric texture (mist, haze, glow, shimmer). Without this, the output reads as a flat inventory, not a scene. WRONG: "A lone explorer stands at the edge of a frozen valley at first light, with visible breath, fine snow, and towering ice cliffs." (static checklist of elements). RIGHT: "A lone explorer stands at the edge of a frozen valley at dawn, their breath drifting in the cold air as fine snow sweeps across the ground. Towering ice cliffs and distant peaks glow pale blue in the first light." (motion via "drifting" and "sweeps", depth via foreground breath + distant peaks, atmosphere via "glow").
- ALWAYS state the primary setting EXPLICITLY. Do not rely on implication. Write "underwater" not just "in water". Write "in a dense forest" not just "with trees". Plain language platforms need direct, unambiguous setting cues.
- NEVER include questions, self-corrections, or negation-then-correction patterns. State what the scene IS, never what it is NOT. WRONG: "Is this indoors? No, it is actually set outside in a meadow." (questions and self-correction are structurally broken — image generators cannot interpret "No, it is…"). RIGHT: "A knight stands in a sunlit meadow at dawn, holding a banner against the wind." (direct, positive statement of the scene).
- STRICT ORDERING: Sentence 1 = subject + action + 3–4 key visual elements. Sentence 2 = explicit setting + environment details. Sentence 3 (optional) = lighting/atmosphere + mood.
- Every sentence MUST be at least 10 words. Do not compress mood and setting into a bare adjective list. WRONG: "It is underwater, clear, and dreamlike." (7 words, bare adjective checklist). RIGHT: "The underwater scene glows with soft light and a calm, dreamlike atmosphere." (12 words, paints the feeling). Bare adjective lists are structurally wrong for this family — write complete descriptive sentences.
- Do not use meta-language like "fill the scene", "in this image", "the composition shows", "the scene has", "the scene shows", or "the scene captures". Describe what exists, not the image itself.
${providerBlock}

Rules:
1. PRESERVE the user's creative intent — their vision, metaphors, spatial descriptions, and poetic language. Do not paraphrase away the poetry. But DO restructure, reorder, and enhance for each platform's optimal interpretation. EMOTIONAL ATMOSPHERE IS MANDATORY: if the input implies a mood or feeling (isolation, wonder, tension, peace, determination), your output MUST include at least one visual-equivalent mood token per tier — never drop the emotional layer entirely. T1: include one atmosphere keyword (e.g., "cold stillness", "vast solitude", "hushed dawn light"). T2: weave mood into a descriptive clause (not as a standalone weighted abstract term). T3: embed the feeling through sensory language. T4: use one plain-language mood phrase (e.g., "quiet and still", "vast and lonely").
2. YOUR JOB IS TO ADD EXPERT PROMPT ENGINEERING VALUE. Every tier must contain at least one element the user did NOT provide: a composition term, a camera angle, a lighting technique, a style/medium reference, or an atmospheric detail. If you return something the user could have written themselves, you have failed. REFORMATTING IS NOT VALUE-ADD. If the user says "24mm lens" and you output "24mm lens", that is not your contribution — that is their knowledge reformatted. Your addition must be something the user did NOT mention at all: a complementary camera technique, an additional lighting effect, a spatial relationship they didn't describe.
3. Each tier must feel NATIVE to its platform family — not like a reformatted version of another tier.
4. Tier 1 must have clean, high-signal keyword assembly — no sentence fragments or orphaned verbs.
5. Tier 2 must read as natural prose that Midjourney interprets well — not keyword soup. Positive description must be FULLY COMPLETE before any --ar/--v/--s/--no parameters begin. The --no flag MUST be present before ANY negative terms.
6. Tier 3 must be grammatically complete with coherent spatial flow AND demonstrate prompt engineering expertise beyond the user's input. Style references must be woven naturally into description — NEVER use meta-instructions like "the image should feel like", "rendered as", or "meant to look like". Describe the scene, not what you want the model to do.
7. Tier 4 must be short enough that a casual user understands it instantly, but complete enough to produce a good image. The primary setting (underwater, outdoor, indoor, etc.) must be stated explicitly.
8. Negative prompts should protect against quality issues SPECIFIC to the description — do not use generic negatives. Tailor negatives to what could go wrong with THIS scene. For Tier 2: negatives MUST follow a --no flag — placing negatives inline without --no is a CRITICAL structural error that reverses their meaning.
9. WEIGHT HIERARCHY (applies to Tier 1 and Tier 2): The primary subject MUST carry the highest weight. Supporting visual elements get medium weights. Abstract mood terms (beauty, wonder, magic, peaceful) get the LOWEST weights or no weight wrapping at all. This is non-negotiable.
10. CRITICAL — Weight syntax is PROVIDER-SPECIFIC. When a provider is specified in PROVIDER CONTEXT below, you MUST use that provider's exact weight syntax. For example: Leonardo uses term::weight (double colon), Stable Diffusion uses (term:weight) (parentheses). Do NOT default to parentheses when the provider specifies double colon. WHEN NO PROVIDER IS SELECTED: Tier 1 MUST use parenthetical syntax — e.g., (term:1.3). Using :: without a provider context is WRONG.
11. Quality suffix: For Tier 1, append quality terms at the end: sharp focus, 8K, intricate textures. These are standard CLIP quality anchors.
12. CONVERT ABSTRACT EMOTIONAL TERMS TO VISUAL EQUIVALENTS. Do not use "beauty", "wonder", "quiet magic" as standalone terms — these are not visually renderable. Instead use visually concrete equivalents: "ethereal light", "dreamlike underwater glow", "serene atmosphere", "luminous tropical clarity", "tranquil ocean depth". Every term in the prompt should describe something a camera could capture.

Return format:
{
  "tier1": { "positive": "...", "negative": "..." },
  "tier2": { "positive": "...", "negative": "..." },
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
    keyPrefix: 'generate-tier-prompts',
    windowSeconds: 3600,
    max: env.isProd ? 20 : 200,
    keyParts: ['POST', '/api/generate-tier-prompts'],
  });

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: 'RATE_LIMITED',
        message: 'Generation limit reached. Please wait before generating again.',
      },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  // ── API key check ───────────────────────────────────────────────────
  const apiKey = env.providers.openAiApiKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'CONFIG_ERROR', message: 'Generation engine not configured.' },
      { status: 500 },
    );
  }

  // ── Parse request body ──────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ');
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: msg },
      { status: 400 },
    );
  }

  // ── Sanitise input ──────────────────────────────────────────────────
  const sanitised = parsed.data.sentence
    .replace(/<[^>]*>/g, '')
    .trim();

  if (!sanitised) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Description cannot be empty after sanitisation.' },
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

  if (gapIntent === 'user-decided' && categoryDecisions && categoryDecisions.length > 0) {
    const engineFills = categoryDecisions.filter((d) => d.fill === 'engine');
    const manualFills = categoryDecisions.filter((d) => d.fill !== 'engine');

    const parts: string[] = [sanitised, '', 'CATEGORY DECISIONS (from user assessment):'];

    if (engineFills.length > 0) {
      parts.push(
        `Engine-fill categories (add expert-level content for these): ${engineFills.map((d) => d.category).join(', ')}`
      );
    }

    if (manualFills.length > 0) {
      parts.push('User-chosen terms (incorporate these naturally into all 4 tiers):');
      for (const d of manualFills) {
        parts.push(`  - ${d.category}: ${d.fill}`);
      }
    }

    userMessage = parts.join('\n');
  } else if (gapIntent === 'skipped') {
    // User acknowledged gaps but chose to ignore them — generate from text alone
    // The engine knows gaps exist but the user explicitly chose not to fill them
    userMessage = sanitised;
  }
  // gapIntent "all-satisfied" or absent — just the human text (original behaviour)

  // ── Call generation engine ──────────────────────────────────────────
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        temperature: 0.5,
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!openaiRes.ok) {
      let errData: Record<string, unknown> = {};
      try {
        errData = await openaiRes.json() as Record<string, unknown>;
      } catch {
        // Can't parse error body
      }

      // Content policy rejection (§11)
      const error = errData?.error as Record<string, unknown> | undefined;
      if (openaiRes.status === 400 && error?.code === 'content_policy_violation') {
        console.error(
          '[generate-tier-prompts] Content policy rejection for input length:',
          sanitised.length,
        );
        return NextResponse.json(
          { error: 'CONTENT_POLICY', message: 'Your description contains content that our engine cannot process. Please revise your description and try again.' },
          { status: 400 },
        );
      }

      // Rate limit (429)
      if (openaiRes.status === 429) {
        console.error('[generate-tier-prompts] Engine rate limited');
        return NextResponse.json(
          { error: 'API_ERROR', message: 'Engine is busy. Please try again in a moment.' },
          { status: 429 },
        );
      }

      console.error('[generate-tier-prompts] Engine error:', openaiRes.status);
      return NextResponse.json(
        { error: 'API_ERROR', message: 'Failed to generate prompts. Please try again.' },
        { status: 502 },
      );
    }

    const openaiData = await openaiRes.json();

    // Content policy check for 200 with content_filter (§11 pattern 2)
    const choices = openaiData?.choices as Array<Record<string, unknown>> | undefined;
    if (choices?.[0]?.finish_reason === 'content_filter') {
      console.error(
        '[generate-tier-prompts] Content policy filter for input length:',
        sanitised.length,
      );
      return NextResponse.json(
        { error: 'CONTENT_POLICY', message: 'Your description contains content that our engine cannot process. Please revise your description and try again.' },
        { status: 400 },
      );
    }

    const content = openaiData?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      console.error('[generate-tier-prompts] Empty engine response:', openaiData);
      return NextResponse.json(
        { error: 'API_ERROR', message: 'Empty response from engine. Please try again.' },
        { status: 502 },
      );
    }

    // ── Parse and validate response ───────────────────────────────────
    let jsonParsed: unknown;
    try {
      jsonParsed = JSON.parse(content);
    } catch {
      console.error('[generate-tier-prompts] Invalid JSON from engine:', content);
      return NextResponse.json(
        { error: 'PARSE_ERROR', message: 'Engine returned invalid data. Please try again.' },
        { status: 502 },
      );
    }

    const validated = ResponseSchema.safeParse(jsonParsed);
    if (!validated.success) {
      console.error('[generate-tier-prompts] Schema validation failed:', validated.error.issues);
      return NextResponse.json(
        { error: 'PARSE_ERROR', message: 'Engine response did not match expected format. Please try again.' },
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
        supportsWeighting: parsed.data.providerContext.supportsWeighting ?? false,
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
        console.debug('[generate-tier-prompts] P4 compliance fix:', t1Result.fixes.join('; '));
      }
    }

    // P5: T2 MJ parameter compliance (always, regardless of provider)
    const t2Result = enforceMjParameters(processed.tier2.positive);
    if (t2Result.wasFixed) {
      compliant = {
        ...compliant,
        tier2: { ...compliant.tier2, positive: t2Result.text },
      };
      console.debug('[generate-tier-prompts] P5 compliance fix:', t2Result.fixes.join('; '));
    }

    // ── Return compliance-gated tier prompts ─────────────────────────
    return NextResponse.json(
      { tiers: compliant },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (err) {
    console.error('[generate-tier-prompts] Unexpected error:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
