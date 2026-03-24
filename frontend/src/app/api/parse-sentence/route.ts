// src/app/api/parse-sentence/route.ts
// ============================================================================
// POST /api/parse-sentence — Human Sentence Conversion
// ============================================================================
// ONE API call to the Prompt Intelligence Engine. Parse only. No optimisation.
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

Categories (with examples of what belongs in each):
- subject: The main focus of the image — people, animals, objects, landscapes, architecture, scenes, or abstract concepts. For landscape/cityscape prompts without a person, use the dominant visual element (e.g., "rolling hills", "neon skyline", "windswept meadow").
- action: What the subject is doing or the scene's motion (e.g., "walking", "swaying in wind", "gently bowing", "cascading down").
- style: Artistic style or rendering approach (e.g., "cinematic", "photorealistic", "watercolour", "professional photography").
- environment: The setting, location, or backdrop (e.g., "urban alley", "Japanese garden", "open countryside", "sanctuary grounds").
- composition: Framing, layout, and depth (e.g., "wide shot", "rule of thirds", "moderate depth of field", "foreground bokeh").
- camera: Lens, camera model, and technical specs (e.g., "35mm lens", "Sony A7R V", "telephoto", "high angle").
- lighting: Light source, direction, and quality (e.g., "golden hour", "diffused light", "high-angle light", "neon glow", "candlelight").
- colour: Dominant colours, palette, or tonal character (e.g., "vibrant colours", "warm amber tones", "muted earth palette", "teal and orange").
- atmosphere: Mood, weather effects, and atmospheric conditions (e.g., "misty", "dramatic", "humid summer night", "drifting fog").
- materials: Textures, surfaces, and physical qualities (e.g., "wet gravel", "glistening paths", "glass", "marble", "long grass").
- fidelity: Quality descriptors, resolution, and technical quality terms (e.g., "highly detailed", "8K", "sharp focus", "high resolution", "masterpiece", "intricate textures").
- negative: Things to exclude (e.g., "no people", "no text", "no watermark"). Only populate if exclusions are mentioned.

Rules:
1. Be thorough — extract everything described or strongly implied into the correct category. Aim to populate 10–12 categories for rich descriptions.
2. Use short phrases (1–4 words per term), not full sentences. Break compound descriptions into separate terms.
3. A category may have multiple terms — return as an array.
4. If a category genuinely has no relevant content, return an empty array.
5. Camera specifications (lens, model, focal length, angle) go in "camera" — not composition. Depth of field and framing go in "composition".
6. Quality terms like "sharp focus", "high resolution", "8K", "detailed" ALWAYS go in "fidelity". Do not skip these.
7. Physical textures and surface materials (grass, gravel, water, concrete, fabric) go in "materials".
8. Preserve the user's creative intent — do not reinterpret or "improve" their words.
9. Do NOT invent or infer terms that are not in the input. If the user says "Courtenay Place", do not add "suburban street" unless those exact words appear. Only extract what is explicitly written.
10. Do NOT embellish terms. "shot on Leica" stays as "shot on Leica", not "vintage Leica look". "natural light" stays as "natural light", not "soft natural ambient lighting".

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

  // ── Call generation engine ────────────────────────────────────────
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        temperature: 0.15, // Low temperature for consistent extraction, slight flex for creative terms
        max_completion_tokens: 1200, // 700 truncates JSON for dense 12-category inputs near 1000 chars
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: sanitised },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => 'Unknown error');
      console.error('[parse-sentence] Engine error:', openaiRes.status, errText);
      return NextResponse.json(
        { error: 'API_ERROR', message: 'Failed to parse your description. Please try again.' },
        { status: 502 },
      );
    }

    const openaiData = await openaiRes.json();
    const content = openaiData?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      console.error('[parse-sentence] Empty engine response:', openaiData);
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
      console.error('[parse-sentence] Invalid JSON from engine:', content);
      return NextResponse.json(
        { error: 'PARSE_ERROR', message: 'Engine returned invalid data. Please try again.' },
        { status: 502 },
      );
    }

    const validated = ParseResponseSchema.safeParse(jsonParsed);
    if (!validated.success) {
      console.error('[parse-sentence] Schema validation failed:', validated.error.issues);
      return NextResponse.json(
        { error: 'PARSE_ERROR', message: 'Engine response did not match expected format. Please try again.' },
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
