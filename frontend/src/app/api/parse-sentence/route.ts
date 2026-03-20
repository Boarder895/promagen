// src/app/api/parse-sentence/route.ts
// ============================================================================
// POST /api/parse-sentence — Human Sentence Conversion
// ============================================================================
// ONE API call to GPT-4o-mini. Parse only. No optimisation.
// Returns structured 12-category JSON from a natural English sentence.
// The existing assemblePrompt() pipeline handles all optimisation.
//
// Authority: human-sentence-conversion.md
// One Brain rule: API parses, engine optimises. Never merge them.
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
// SYSTEM PROMPT — categorise only, never optimise
// ============================================================================

const SYSTEM_PROMPT = `You are a prompt categorisation engine for AI image generation.

Given a natural English description of an image, extract terms into exactly these 12 categories. Return ONLY valid JSON with no preamble, no markdown, no explanation.

Categories:
- subject: The main subject(s) of the image (people, animals, objects)
- action: What the subject is doing
- style: Artistic style (e.g., cinematic, watercolour, anime, photorealistic)
- environment: The setting or location
- composition: Framing and layout (e.g., close-up, wide shot, rule of thirds)
- camera: Lens and camera specifics (e.g., 35mm, telephoto, shallow depth of field)
- lighting: Light source and quality (e.g., golden hour, neon, candlelight)
- colour: Dominant colours or colour palette
- atmosphere: Mood and atmospheric conditions (e.g., misty, peaceful, dramatic)
- materials: Textures and surface qualities (e.g., glass, marble, wet concrete)
- fidelity: Quality descriptors (e.g., highly detailed, 8K, masterpiece)
- negative: Things to exclude from the image

Rules:
1. Extract only what is explicitly described or strongly implied. Do not invent.
2. Use short phrases (1-4 words per term), not full sentences.
3. A category may have multiple terms — return as an array.
4. If a category has no relevant content, return an empty array.
5. Do not include fidelity or negative terms unless the user explicitly mentions quality or exclusions.
6. Preserve the user's creative intent — do not reinterpret or "improve" their words.

Return format:
{
  "subject": ["term", ...],
  "action": ["term", ...],
  "style": ["term", ...],
  "environment": ["term", ...],
  "composition": ["term", ...],
  "camera": ["term", ...],
  "lighting": ["term", ...],
  "colour": ["term", ...],
  "atmosphere": ["term", ...],
  "materials": ["term", ...],
  "fidelity": ["term", ...],
  "negative": ["term", ...]
}`;

// ============================================================================
// REQUEST / RESPONSE SCHEMAS
// ============================================================================

const RequestSchema = z.object({
  sentence: z
    .string()
    .min(1, 'Sentence cannot be empty')
    .max(1000, 'Maximum 1,000 characters'),
});

const CategoryArraySchema = z.array(z.string().max(100)).max(10);

const ParseResponseSchema = z.object({
  subject: CategoryArraySchema,
  action: CategoryArraySchema,
  style: CategoryArraySchema,
  environment: CategoryArraySchema,
  composition: CategoryArraySchema,
  camera: CategoryArraySchema,
  lighting: CategoryArraySchema,
  colour: CategoryArraySchema,
  atmosphere: CategoryArraySchema,
  materials: CategoryArraySchema,
  fidelity: CategoryArraySchema,
  negative: CategoryArraySchema,
}).strip();

export type ParsedCategories = z.infer<typeof ParseResponseSchema>;

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(req: NextRequest): Promise<Response> {
  // ── Rate limit ──────────────────────────────────────────────────────
  const rl = rateLimit(req, {
    keyPrefix: 'parse-sentence',
    windowSeconds: 3600, // 1 hour window
    max: env.isProd ? 20 : 200, // 20/hour in prod, generous in dev
    keyParts: ['POST', '/api/parse-sentence'],
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Conversion limit reached. Please wait or use the dropdowns directly.' },
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

  // ── Strip HTML/script tags (sanitisation) ───────────────────────────
  const sanitised = parsed.data.sentence
    .replace(/<[^>]*>/g, '')
    .trim();

  if (!sanitised) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Sentence cannot be empty after sanitisation.' },
      { status: 400 },
    );
  }

  // ── Call OpenAI GPT-4o-mini ─────────────────────────────────────────
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: sanitised },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => 'Unknown error');
      console.error('[parse-sentence] OpenAI error:', openaiRes.status, errText);
      return NextResponse.json(
        { error: 'API_ERROR', message: 'Failed to parse your description. Please try again.' },
        { status: 502 },
      );
    }

    const openaiData = await openaiRes.json();
    const content = openaiData?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      console.error('[parse-sentence] Empty OpenAI response:', openaiData);
      return NextResponse.json(
        { error: 'API_ERROR', message: 'Empty response from AI. Please try again.' },
        { status: 502 },
      );
    }

    // ── Parse and validate response ───────────────────────────────────
    let jsonParsed: unknown;
    try {
      jsonParsed = JSON.parse(content);
    } catch {
      console.error('[parse-sentence] Invalid JSON from OpenAI:', content);
      return NextResponse.json(
        { error: 'PARSE_ERROR', message: 'AI returned invalid data. Please try again.' },
        { status: 502 },
      );
    }

    const validated = ParseResponseSchema.safeParse(jsonParsed);
    if (!validated.success) {
      console.error('[parse-sentence] Schema validation failed:', validated.error.issues);
      return NextResponse.json(
        { error: 'PARSE_ERROR', message: 'AI response did not match expected format. Please try again.' },
        { status: 502 },
      );
    }

    // ── Return validated categories ───────────────────────────────────
    return NextResponse.json(
      { categories: validated.data },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (err) {
    console.error('[parse-sentence] Unexpected error:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
      { status: 500 },
    );
  }
}
