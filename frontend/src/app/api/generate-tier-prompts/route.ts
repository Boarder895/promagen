// src/app/api/generate-tier-prompts/route.ts
// ============================================================================
// POST /api/generate-tier-prompts — AI Tier Prompt Generation (Call 2)
// ============================================================================
// Generates all 4 tier prompts directly from the user's human text
// description using GPT-5.4-mini. Replaces string-template generators
// for the Prompt Lab only.
//
// Fires in parallel with Call 1 (/api/parse-sentence).
// When a provider is selected, generates provider-tailored output.
// When no provider is selected, generates generic best-practice tiers.
//
// Authority: ai-disguise.md §5 (Call 2 — AI Tier Generation)
// Pattern: matches /api/parse-sentence (same rate-limit, env, Zod, error handling)
// Scope: Prompt Lab (/studio/playground) ONLY
// One Brain rule: This does NOT replace assemblePrompt() for the standard builder.
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';

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
  const providerBlock = providerContext
    ? `
PROVIDER CONTEXT (OVERRIDES GENERIC TIER RULES):
The user has selected ${providerContext.name} (Tier ${providerContext.tier} — ${TIER_DISPLAY[providerContext.tier] ?? 'Unknown'}).
This platform uses ${providerContext.promptStyle} format.
${providerContext.weightingSyntax ? `WEIGHT SYNTAX FOR THIS PROVIDER: ${providerContext.weightingSyntax} — YOU MUST USE THIS EXACT SYNTAX, not parentheses unless this IS parentheses.` : 'No weight syntax — output plain keywords.'}
Sweet spot: ~${providerContext.sweetSpot} tokens. Token limit: ${providerContext.tokenLimit}.
${providerContext.qualityPrefix?.length ? `Quality prefix: ${providerContext.qualityPrefix.join(', ')}.` : ''}
${providerContext.supportsWeighting ? 'This platform supports term weighting.' : 'This platform does NOT support term weighting — do not include weight syntax.'}
Negative support: ${providerContext.negativeSupport}.
Prioritise Tier ${providerContext.tier} output quality — this is the tier the user will use.`
    : '';

  return `You are an expert AI image prompt generator for 42 AI image generation platforms.

Given a natural English description, generate 4 different prompt versions optimised for different platform families. Return ONLY valid JSON with no preamble, no markdown, no explanation.

The 4 tiers:

TIER 1 — CLIP-Based (e.g., Leonardo, Stable Diffusion, DreamStudio):
- Weighted keyword syntax — WHEN NO PROVIDER IS SPECIFIED: you MUST use parenthetical syntax: (term:1.3). Example: (lone mermaid:1.4), (coral reef:1.2). Do NOT use double-colon :: syntax unless a specific provider below requires it.
- WHEN A PROVIDER IS SPECIFIED in PROVIDER CONTEXT below: use THAT provider's exact syntax instead (e.g., Leonardo uses term::1.3 double-colon, Stable Diffusion uses (term:1.3) parentheses).
- Front-load subject and style with highest weights (1.3–1.4 for subject, 1.2–1.3 for style/lighting)
- SUBJECT MUST ALWAYS CARRY THE HIGHEST WEIGHT in the entire prompt. No mood, atmosphere, or secondary element may have a higher weight than the primary subject.
- Quality prefix: masterpiece, best quality, highly detailed
- Quality suffix: sharp focus, 8K, intricate textures (add at end)
- Comma-separated weighted keywords, NOT sentences
- Rich phrases longer than 4 words should NOT be weight-wrapped — break into shorter weighted terms instead
- NEVER weight-wrap isolated colour words (e.g., "yellows", "orange"). Always pair colours with their visual context (e.g., "yellow reef fish", "orange coral").
- Separate negative prompt with common quality negatives
- MANDATORY: Include at least one composition or camera term NOT in the user's input (e.g., wide scene, cinematic composition, central subject, underwater perspective, volumetric lighting). This is your expert value-add.
- Target: ~100 tokens (~350 characters) for creative text

TIER 2 — Midjourney Family (e.g., Midjourney, BlueWillow):
- Descriptive prose with style weighting via :: syntax (e.g., cinematic::2.0)
- SUBJECT MUST CARRY THE HIGHEST :: WEIGHT. Mood and atmosphere terms must have lower weights than the subject. Do NOT give abstract terms like "quiet magic" or "beauty" the highest weight — weight the visual subject and key visual elements highest.
- End with parameters: --ar 16:9 --v 7 --s 500
- Negative via --no flag at end — negatives MUST be scene-specific, not boilerplate. For an underwater scene use "above water, dry, foggy, dark". For a portrait use "cropped, out of frame". Do NOT default to "extra limbs, distorted anatomy" unless the scene features human anatomy prominently.
- MANDATORY: Include at least one art style or rendering medium reference (e.g., digital painting, concept art, fantasy illustration, underwater photography, cinematic still). This anchors the model's aesthetic interpretation.
- MANDATORY: Include at least one composition or framing cue NOT in the user's input (e.g., wide underwater view, cinematic framing, central subject, dramatic perspective).
- Rich artistic and mood descriptors work well
- Target: ~200 characters for creative text (before parameters)

TIER 3 — Natural Language (e.g., DALL·E, Adobe Firefly, Google Imagen):
- Full grammatical sentences describing the scene
- Describe as if telling an artist what to paint — spatial relationships, prepositions, poetry preserved
- Include lighting, atmosphere, and composition naturally within sentences
- Convert negatives to positive reinforcement ("sharp and clear" not "no blur")
- CRITICAL: Do NOT return a lightly edited version of the user's input. You are a prompt engineer, not a paraphraser. The output must demonstrate expert knowledge the user does not have.
- MANDATORY: Add at least one art style or rendering medium reference naturally within the text (e.g., "rendered as a digital fantasy illustration", "in the style of underwater photography", "a cinematic wide-angle view").
- MANDATORY: Add at least one composition or camera cue NOT in the user's input (e.g., "viewed from below looking up toward the surface", "in a wide cinematic underwater scene", "with the subject centred in the frame").
- MANDATORY: Add at least one atmospheric or lighting detail NOT in the user's input (e.g., "with luminous tropical clarity", "dappled caustic light patterns on the seabed", "god rays piercing the blue depths").
- Target: ~250–350 characters

TIER 4 — Plain Language (e.g., Canva, Bing, Freepik):
- Simple, focused, short description
- Minimal technical jargon — a non-expert should understand it
- MUST be two sentences: first sentence for the subject and action, second sentence for the environment and mood
- Keep all key visual anchors from the input — do not over-compress. Include the setting (e.g., "underwater"), the subject, and at least 3 supporting visual elements.
- Target: ~150–200 characters
${providerBlock}

Rules:
1. PRESERVE the user's creative intent — their vision, metaphors, spatial descriptions, and poetic language. Do not paraphrase away the poetry. But DO restructure, reorder, and enhance for each platform's optimal interpretation.
2. YOUR JOB IS TO ADD EXPERT PROMPT ENGINEERING VALUE. Every tier must contain at least one element the user did NOT provide: a composition term, a camera angle, a lighting technique, a style/medium reference, or an atmospheric detail. If you return something the user could have written themselves, you have failed.
3. Each tier must feel NATIVE to its platform family — not like a reformatted version of another tier.
4. Tier 1 must have clean, high-signal keyword assembly — no sentence fragments or orphaned verbs.
5. Tier 2 must read as natural prose that Midjourney interprets well — not keyword soup.
6. Tier 3 must be grammatically complete with coherent spatial flow AND demonstrate prompt engineering expertise beyond the user's input.
7. Tier 4 must be short enough that a casual user understands it instantly, but complete enough to produce a good image.
8. Negative prompts should protect against quality issues SPECIFIC to the description — do not use generic negatives. Tailor negatives to what could go wrong with THIS scene.
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
      { error: 'CONFIG_ERROR', message: 'OpenAI API key not configured.' },
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

  // ── Call OpenAI GPT-5.4-mini ────────────────────────────────────────
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
          { role: 'user', content: sanitised },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => 'Unknown error');
      console.error('[generate-tier-prompts] OpenAI error:', openaiRes.status, errText);
      return NextResponse.json(
        { error: 'API_ERROR', message: 'Failed to generate prompts. Please try again.' },
        { status: 502 },
      );
    }

    const openaiData = await openaiRes.json();
    const content = openaiData?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      console.error('[generate-tier-prompts] Empty OpenAI response:', openaiData);
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
      console.error('[generate-tier-prompts] Invalid JSON from OpenAI:', content);
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

    // ── Return validated tier prompts ─────────────────────────────────
    return NextResponse.json(
      { tiers: validated.data },
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
