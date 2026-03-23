// src/app/api/optimise-prompt/route.ts
// ============================================================================
// POST /api/optimise-prompt — AI Prompt Optimisation (Call 3)
// ============================================================================
// Takes the assembled prompt text and restructures it for the specific
// provider — not just trimming length but intelligently reordering,
// reweighting, removing filler, and strengthening quality anchors.
//
// Fires on "Optimise" click in the Prompt Lab.
// During the API call, the frontend shows the algorithm cycling animation.
//
// Authority: ai-disguise.md §6 (Call 3 — AI Prompt Optimisation)
// Pattern: matches /api/parse-sentence (same rate-limit, env, Zod, error handling)
// Scope: Prompt Lab (/studio/playground) ONLY
// One Brain rule: This does NOT replace the client-side optimizer for the standard builder.
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
// TIER NAMES (for system prompt)
// ============================================================================

const TIER_DISPLAY: Record<number, string> = {
  1: 'CLIP-Based (weighted keywords)',
  2: 'Midjourney Family (prose + parameters)',
  3: 'Natural Language (grammatical sentences)',
  4: 'Plain Language (simple, short)',
};

// ============================================================================
// REQUEST SCHEMA
// ============================================================================

const ProviderContextSchema = z.object({
  /** Provider display name */
  name: z.string().max(100),
  /** Platform tier (1–4) */
  tier: z.number().int().min(1).max(4),
  /** Prompt style: keywords | natural | plain | midjourney */
  promptStyle: z.string().max(50),
  /** Sweet spot token count */
  sweetSpot: z.number().int().min(10).max(2000),
  /** Maximum token limit */
  tokenLimit: z.number().int().min(10).max(5000),
  /** Hard character limit (null = unlimited) */
  maxChars: z.number().int().min(50).max(10000).nullable(),
  /** Sweet spot lower bound (characters) */
  idealMin: z.number().int().min(10).max(5000),
  /** Sweet spot upper bound (characters) */
  idealMax: z.number().int().min(10).max(5000),
  /** Quality prefix terms */
  qualityPrefix: z.array(z.string().max(50)).max(10).optional(),
  /** Weight syntax pattern */
  weightingSyntax: z.string().max(50).optional(),
  /** Whether the platform supports term weighting */
  supportsWeighting: z.boolean().optional(),
  /** How the platform handles negative prompts */
  negativeSupport: z.enum(['separate', 'inline', 'none', 'converted']),
  /** Platform-specific category priority order */
  categoryOrder: z.array(z.string().max(30)).max(15).optional(),
});

const RequestSchema = z.object({
  /** The assembled prompt text to optimise */
  promptText: z
    .string()
    .min(1, 'Prompt text cannot be empty')
    .max(5000, 'Maximum 5,000 characters'),
  /** The user's original human description (for reference, preserving intent) */
  originalSentence: z.string().max(1000).optional(),
  /** Selected provider ID */
  providerId: z
    .string()
    .min(1, 'Provider ID is required')
    .max(50),
  /** Provider's platform format data */
  providerContext: ProviderContextSchema,
});

// ============================================================================
// RESPONSE SCHEMA
// ============================================================================

const ResponseSchema = z.object({
  /** The optimised prompt text */
  optimised: z.string().max(5000),
  /** The optimised negative prompt (if applicable) */
  negative: z.string().max(1000).optional(),
  /** Brief descriptions of changes made (for transparency panel) */
  changes: z.array(z.string().max(200)).max(20),
  /** Character count of optimised prompt */
  charCount: z.number().int(),
  /** Estimated token count */
  tokenEstimate: z.number().int(),
}).strip();

export type OptimiseResult = z.infer<typeof ResponseSchema>;

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

function buildSystemPrompt(ctx: z.infer<typeof ProviderContextSchema>): string {
  const tierName = TIER_DISPLAY[ctx.tier] ?? 'Unknown';
  const categoryOrderStr = ctx.categoryOrder?.join(' → ') ?? 'subject → style → environment → lighting → atmosphere → fidelity';
  const weightNote = ctx.supportsWeighting
    ? `WEIGHT SYNTAX (MANDATORY): Use EXACTLY this syntax: ${ctx.weightingSyntax ?? '(term:weight)'}. Do NOT substitute parentheses for double-colon or vice versa. Distribute weights: subject highest (1.3–1.4), supporting 1.0–1.2, filler unweighted. Rich phrases longer than 4 words must NOT be weight-wrapped — break them into shorter weighted terms instead (e.g., "lone woman in crimson coat" becomes "lone woman${ctx.weightingSyntax?.includes('::') ? '::1.3' : ':1.3)'}, crimson coat${ctx.weightingSyntax?.includes('::') ? '::1.2' : ':1.2)'}").`
    : 'This platform does NOT support weight syntax — remove all weight markers.';

  const qualitySuffix = ctx.tier === 1 ? '\n- Quality suffix (append at end): sharp focus, 8K, intricate textures' : '';

  return `You are an expert prompt optimiser for the AI image generation platform "${ctx.name}".

Your job is to take an assembled prompt and optimise it specifically for ${ctx.name}, which is a Tier ${ctx.tier} platform: ${tierName}.

PLATFORM SPECIFICATIONS:
- Prompt style: ${ctx.promptStyle}
- Sweet spot: ${ctx.idealMin}–${ctx.idealMax} characters
- Token limit: ${ctx.tokenLimit}
${ctx.maxChars ? `- Hard character limit: ${ctx.maxChars}` : '- No hard character limit'}
- ${weightNote}
${ctx.qualityPrefix?.length ? `- Quality prefix: ${ctx.qualityPrefix.join(', ')}` : '- No quality prefix defined'}${qualitySuffix}
- Category impact priority: ${categoryOrderStr}
- Negative handling: ${ctx.negativeSupport}

OPTIMISATION RULES:
1. Reorder terms by platform-specific impact priority: ${categoryOrderStr}. Front-load high-impact categories.
2. Remove redundant or duplicate semantic content — "realistic textures" after "realistic texture" is waste.
3. Remove orphaned verb fragments — "stands", "leaving", "reflecting quietly" are sentence debris in keyword prompts.
4. Remove filler tokens that dilute model attention — adverbs, unnecessary articles, vague modifiers.
5. Strengthen quality anchors appropriate to this platform. For CLIP platforms: ensure quality prefix AND quality suffix are present.
6. Ensure the final prompt is within the sweet spot (${ctx.idealMin}–${ctx.idealMax} characters). This is the PRIMARY optimisation target.
7. For CLIP/keyword platforms (Tier 1): output must be clean comma-separated weighted keywords — NO sentence fragments, NO orphaned verbs, NO "a" or "the" articles. Use ONLY the weight syntax specified above.
8. For Midjourney (Tier 2): ensure --ar, --v, --s, --no parameters are correctly formatted and placed at the end. Creative text should be descriptive prose, not keyword soup.
9. For natural language platforms (Tier 3): ensure grammatical coherence — complete sentences, proper transitions. Convert any negative terms to positive reinforcement.
10. For plain platforms (Tier 4): keep it short, simple, and impactful. Maximum 2 sentences. Remove all technical jargon.
11. PRESERVE the user's core creative intent — optimise structure and efficiency, not meaning. Never remove the subject, core mood, or defining visual elements.
12. List every change made in the "changes" array — the user sees this in the transparency panel.
13. CRITICAL: The output weight syntax MUST match exactly: ${ctx.weightingSyntax ?? '(term:weight)'}. Wrong syntax = broken prompt on this platform.

Return ONLY valid JSON:
{
  "optimised": "the optimised prompt text",
  "negative": "the optimised negative prompt (if applicable, empty string if not)",
  "changes": ["Reordered subject to front position", "Removed redundant 'realistic' duplicate", ...],
  "charCount": 285,
  "tokenEstimate": 72
}`;
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(req: NextRequest): Promise<Response> {
  // ── Rate limit ──────────────────────────────────────────────────────
  const rl = rateLimit(req, {
    keyPrefix: 'optimise-prompt',
    windowSeconds: 3600,
    max: env.isProd ? 30 : 200,
    keyParts: ['POST', '/api/optimise-prompt'],
  });

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: 'RATE_LIMITED',
        message: 'Optimisation limit reached. Please wait before optimising again.',
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

  // ── Sanitise inputs ─────────────────────────────────────────────────
  const sanitisedPrompt = parsed.data.promptText
    .replace(/<[^>]*>/g, '')
    .trim();
  const sanitisedOriginal = parsed.data.originalSentence
    ? parsed.data.originalSentence.replace(/<[^>]*>/g, '').trim()
    : undefined;

  if (!sanitisedPrompt) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Prompt text cannot be empty after sanitisation.' },
      { status: 400 },
    );
  }

  // ── Build system prompt ─────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(parsed.data.providerContext);

  // ── Build user message ──────────────────────────────────────────────
  const userMessage = sanitisedOriginal
    ? `ASSEMBLED PROMPT TO OPTIMISE:\n${sanitisedPrompt}\n\nORIGINAL USER DESCRIPTION (for intent reference):\n${sanitisedOriginal}`
    : `ASSEMBLED PROMPT TO OPTIMISE:\n${sanitisedPrompt}`;

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
        temperature: 0.2,
        max_completion_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => 'Unknown error');
      console.error('[optimise-prompt] OpenAI error:', openaiRes.status, errText);
      return NextResponse.json(
        { error: 'API_ERROR', message: 'Optimisation failed. Please try again.' },
        { status: 502 },
      );
    }

    const openaiData = await openaiRes.json();
    const content = openaiData?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      console.error('[optimise-prompt] Empty OpenAI response:', openaiData);
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
      console.error('[optimise-prompt] Invalid JSON from OpenAI:', content);
      return NextResponse.json(
        { error: 'PARSE_ERROR', message: 'Engine returned invalid data. Please try again.' },
        { status: 502 },
      );
    }

    const validated = ResponseSchema.safeParse(jsonParsed);
    if (!validated.success) {
      console.error('[optimise-prompt] Schema validation failed:', validated.error.issues);
      return NextResponse.json(
        { error: 'PARSE_ERROR', message: 'Engine response did not match expected format. Please try again.' },
        { status: 502 },
      );
    }

    // ── Return validated optimised prompt ─────────────────────────────
    return NextResponse.json(
      { result: validated.data },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (err) {
    console.error('[optimise-prompt] Unexpected error:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
