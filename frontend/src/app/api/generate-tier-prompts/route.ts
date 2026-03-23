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
- Weighted keyword syntax — DEFAULT: (term:1.3). BUT if a provider is specified below, use THAT provider's exact syntax instead.
- Front-load subject and style with highest weights (1.3–1.4 for subject, 1.2–1.3 for style/lighting)
- Quality prefix: masterpiece, best quality, highly detailed
- Quality suffix: sharp focus, 8K, intricate textures (add at end)
- Comma-separated weighted keywords, NOT sentences
- Rich phrases longer than 4 words should NOT be weight-wrapped — break into shorter weighted terms instead
- Separate negative prompt with common quality negatives
- Target: ~100 tokens (~350 characters) for creative text

TIER 2 — Midjourney Family (e.g., Midjourney, BlueWillow):
- Descriptive prose with style weighting via :: syntax (e.g., cinematic::2.0)
- End with parameters: --ar 16:9 --v 6 --s 500
- Negative via --no flag at end (e.g., --no blur, watermark, text)
- Rich artistic and mood descriptors work well
- Target: ~200 characters for creative text (before parameters)

TIER 3 — Natural Language (e.g., DALL·E, Adobe Firefly, Google Imagen):
- Full grammatical sentences describing the scene
- Describe as if telling an artist what to paint — spatial relationships, prepositions, poetry preserved
- Include lighting, atmosphere, and composition naturally within sentences
- Convert negatives to positive reinforcement ("sharp and clear" not "no blur")
- Target: ~250–350 characters

TIER 4 — Plain Language (e.g., Canva, Bing, Freepik):
- Simple, focused, short description
- Minimal technical jargon — a non-expert should understand it
- One or two sentences maximum
- Target: ~100–150 characters
${providerBlock}

Rules:
1. PRESERVE the user's creative intent — their exact words, metaphors, spatial descriptions, and poetic language. Do not paraphrase away the poetry.
2. Do NOT add visual elements not present or strongly implied in the input. Quality anchors (masterpiece, detailed) are acceptable additions.
3. Each tier must feel NATIVE to its platform family — not like a reformatted version of another tier.
4. Tier 1 must have clean, high-signal keyword assembly — no sentence fragments or orphaned verbs.
5. Tier 2 must read as natural prose that Midjourney interprets well — not keyword soup.
6. Tier 3 must be grammatically complete with coherent spatial flow.
7. Tier 4 must be short enough that a casual user understands it instantly.
8. Negative prompts should protect against quality issues relevant to the description — do not use generic negatives if specific ones are more appropriate.
9. Weight distribution in Tier 1: subject gets highest weight (1.3–1.4), supporting elements get 1.0–1.2, filler gets no weight wrapping. Break long phrases (5+ words) into shorter weighted terms — e.g., "lone woman in crimson coat" becomes "lone woman::1.3, crimson coat::1.2" (or equivalent in the provider's syntax).
10. CRITICAL — Weight syntax is PROVIDER-SPECIFIC. When a provider is specified in PROVIDER CONTEXT below, you MUST use that provider's exact weight syntax. For example: Leonardo uses term::weight (double colon), Stable Diffusion uses (term:weight) (parentheses). Do NOT default to parentheses when the provider specifies double colon. When no provider is selected, default to (term:weight) parenthetical syntax.
11. Quality suffix: For Tier 1, append quality terms at the end: sharp focus, 8K, intricate textures. These are standard CLIP quality anchors.

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
        temperature: 0.3,
        max_completion_tokens: 1500,
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
