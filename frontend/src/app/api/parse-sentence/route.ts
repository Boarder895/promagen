// src/app/api/parse-sentence/route.ts
// ============================================================================
// POST /api/parse-sentence — Human Sentence Conversion + Category Assessment
// ============================================================================
// TWO MODES (backward compatible):
//   mode: "extract" (default) — Original behaviour. Returns 12-category term
//     arrays for dropdown population. Used by standard builder.
//   mode: "assess" — Returns coverage map with matched phrases from user's text.
//     Used by Prompt Lab for text colouring + category coverage pills.
//
// Authority: prompt-lab.md, human-sentence-conversion.md
// One Brain rule: API parses/assesses, engine optimises. Never merge them.
// Security: No "AI", "GPT", "OpenAI", "LLM" in user-facing strings or client logs.
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
// SYSTEM PROMPTS
// ============================================================================

/**
 * EXTRACT mode — original categorisation prompt (unchanged).
 * Returns term arrays for dropdown population.
 */
const EXTRACT_SYSTEM_PROMPT = `You are a prompt categorisation engine for AI image generation.

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

/**
 * ASSESS mode — category coverage + matched phrases.
 * Returns which categories are covered and the exact phrases from the
 * user's text that address each one. Used for text colouring and gap display.
 *
 * Key difference from extract mode:
 * - Returns the user's own words (not vocabulary-matched terms)
 * - matchedPhrases are the exact substrings from the input
 * - Handles CLIP tokens and MJ parameters, not just natural English
 */
const ASSESS_SYSTEM_PROMPT = `You are a prompt analysis engine for AI image generation.

Given a natural language description of an image, determine which of these 12 categories the text covers. For each covered category, return the exact phrases from the user's text that address it.

The 12 categories:
- subject: The main focus — people, animals, objects, landscapes, architecture, abstract concepts.
- action: What the subject is doing or the scene's motion/activity.
- style: Artistic style, rendering approach, or art movement.
- environment: Setting, location, backdrop, time-of-day context.
- composition: Framing, perspective, depth of field, rule of thirds.
- camera: Lens type, camera model, focal length, shooting angle.
- lighting: Light sources, direction, quality, intensity.
- colour: Dominant colours, palette, tonal character, colour grading.
- atmosphere: Mood, weather effects, atmospheric conditions, emotional tone.
- materials: Textures, surfaces, physical qualities of objects in the scene.
- fidelity: Quality descriptors — resolution, detail level, sharpness, "masterpiece", "8K".
- negative: Explicit exclusions — "no people", "no text", "without watermarks".

Rules:
1. A category is "covered: true" if the text explicitly or clearly implies content for that category.
2. For covered categories, return the exact phrases from the user's input that address it. Use the user's own words — do NOT paraphrase, do NOT add words, do NOT reinterpret.
   WRONG: User wrote "blue hour" → matchedPhrases: ["cool blue twilight lighting"] (paraphrased)
   RIGHT: User wrote "blue hour" → matchedPhrases: ["blue hour"] (exact words from input)
3. A single phrase may be short ("8K") or multi-word ("weathered white suit standing on the roof"). Extract the meaningful chunk, not individual words.
   WRONG: "a lone astronaut in a weathered white suit" → subject matchedPhrases: ["lone", "astronaut", "white", "suit"]
   RIGHT: "a lone astronaut in a weathered white suit" → subject matchedPhrases: ["lone astronaut in a weathered white suit"]
4. A category may have multiple matched phrases. Return all of them.
   Example: lighting matchedPhrases: ["blue hour", "last orange sunset", "first city lights"]
5. For uncovered categories, return an empty matchedPhrases array.
6. Do NOT over-infer. "A dog running in a park" does NOT imply camera, lighting, composition, style, fidelity, colour, materials, or negative. Only subject, action, and environment are covered.
7. "negative" is ONLY covered if the text explicitly mentions exclusions (no/without/excluding).
8. Handle structured input: CLIP tokens like "(sunset:1.2)" and Midjourney parameters like "--ar 16:9 --v 6" count as coverage. Extract the meaningful part as the matchedPhrase.
9. Preserve user intent — analyse what they wrote, not what a good prompt "should" have.

Return ONLY valid JSON with no preamble, no markdown, no explanation:
{
  "coverage": {
    "subject": { "covered": true, "matchedPhrases": ["lone astronaut in a weathered white suit"] },
    "action": { "covered": true, "matchedPhrases": ["stands on the roof", "holding a glowing red umbrella"] },
    "style": { "covered": true, "matchedPhrases": ["cinematic, photorealistic"] },
    "environment": { "covered": true, "matchedPhrases": ["flooded neon lit Tokyo train station"] },
    "composition": { "covered": false, "matchedPhrases": [] },
    "camera": { "covered": false, "matchedPhrases": [] },
    "lighting": { "covered": true, "matchedPhrases": ["blue hour", "last orange sunset"] },
    "colour": { "covered": false, "matchedPhrases": [] },
    "atmosphere": { "covered": true, "matchedPhrases": ["rain falls through drifting steam"] },
    "materials": { "covered": true, "matchedPhrases": ["reflective surfaces"] },
    "fidelity": { "covered": true, "matchedPhrases": ["sharp subject focus", "8K"] },
    "negative": { "covered": false, "matchedPhrases": [] }
  },
  "coveredCount": 8,
  "totalCategories": 12,
  "allSatisfied": false
}

coveredCount must equal the number of categories where covered is true.
allSatisfied must be true only if coveredCount equals 12.`;

// ============================================================================
// REQUEST / RESPONSE SCHEMAS
// ============================================================================

const RequestSchema = z.object({
  sentence: z
    .string()
    .min(1, 'Sentence cannot be empty')
    .max(1000, 'Maximum 1,000 characters'),
  /** "extract" = term arrays (default, backward compat). "assess" = coverage map. */
  mode: z.enum(['extract', 'assess']).default('extract'),
});

// ── Extract mode response schema (original) ────────────────────────────

const CategoryArraySchema = z.array(z.string().max(100)).max(20);

const ExtractResponseSchema = z.object({
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

export type ParsedCategories = z.infer<typeof ExtractResponseSchema>;

// ── Assess mode response schema (new v4) ───────────────────────────────

const VALID_CATEGORIES = [
  'subject', 'action', 'style', 'environment', 'composition', 'camera',
  'lighting', 'colour', 'atmosphere', 'materials', 'fidelity', 'negative',
] as const;

const CategoryCoverageSchema = z.object({
  covered: z.boolean(),
  matchedPhrases: z.array(z.string().max(200)).max(20),
});

const CoverageMapSchema = z.object({
  subject: CategoryCoverageSchema,
  action: CategoryCoverageSchema,
  style: CategoryCoverageSchema,
  environment: CategoryCoverageSchema,
  composition: CategoryCoverageSchema,
  camera: CategoryCoverageSchema,
  lighting: CategoryCoverageSchema,
  colour: CategoryCoverageSchema,
  atmosphere: CategoryCoverageSchema,
  materials: CategoryCoverageSchema,
  fidelity: CategoryCoverageSchema,
  negative: CategoryCoverageSchema,
});

const AssessResponseSchema = z.object({
  coverage: CoverageMapSchema,
  coveredCount: z.number().int().min(0).max(12),
  totalCategories: z.literal(12),
  allSatisfied: z.boolean(),
}).strip().refine(
  (data) => {
    const actualCount = VALID_CATEGORIES.filter(
      (cat) => data.coverage[cat].covered
    ).length;
    return data.coveredCount === actualCount;
  },
  { message: 'coveredCount does not match actual covered categories' }
).refine(
  (data) => {
    return data.allSatisfied === (data.coveredCount === 12);
  },
  { message: 'allSatisfied does not match coveredCount' }
);

export type CoverageAssessmentResponse = z.infer<typeof AssessResponseSchema>;

// ============================================================================
// CONTENT POLICY DETECTION (§11 — applies to all routes)
// ============================================================================

/**
 * Check if the engine rejected the request due to content policy.
 * Two patterns (prompt-lab-v4-flow.md §11):
 * 1. HTTP 400 with error.code === "content_policy_violation"
 * 2. HTTP 200 with finish_reason === "content_filter"
 */
function isContentPolicyRejection(
  status: number,
  responseData: Record<string, unknown>,
): boolean {
  if (status === 400) {
    const error = responseData?.error as Record<string, unknown> | undefined;
    if (error?.code === 'content_policy_violation') return true;
  }

  if (status === 200) {
    const choices = responseData?.choices as Array<Record<string, unknown>> | undefined;
    if (choices?.[0]?.finish_reason === 'content_filter') return true;
  }

  return false;
}

/** Content policy user-facing message (§11 — neutral, no backend references) */
const CONTENT_POLICY_MESSAGE =
  'Your description contains content that our engine cannot process. Please revise your description and try again.';

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(req: NextRequest): Promise<Response> {
  // ── Rate limit ──────────────────────────────────────────────────────
  const rl = rateLimit(req, {
    keyPrefix: 'parse-sentence',
    windowSeconds: 3600,
    max: env.isProd ? 20 : 200,
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

  const { mode } = parsed.data;

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

  // ── Select system prompt and schema based on mode ───────────────────
  const systemPrompt = mode === 'assess' ? ASSESS_SYSTEM_PROMPT : EXTRACT_SYSTEM_PROMPT;
  const responseSchema = mode === 'assess' ? AssessResponseSchema : ExtractResponseSchema;

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
        temperature: 0.15,
        max_completion_tokens: mode === 'assess' ? 1200 : 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: sanitised },
        ],
      }),
    });

    // ── Content policy check (§11 — check BEFORE generic error) ───────
    if (!openaiRes.ok) {
      let errData: Record<string, unknown> = {};
      try {
        errData = await openaiRes.json() as Record<string, unknown>;
      } catch {
        // Can't parse error body — fall through to generic handler
      }

      // 1. Content policy rejection (400)
      if (isContentPolicyRejection(openaiRes.status, errData)) {
        console.error(
          '[parse-sentence] Content policy rejection for input length:',
          sanitised.length,
        );
        return NextResponse.json(
          { error: 'CONTENT_POLICY', message: CONTENT_POLICY_MESSAGE },
          { status: 400 },
        );
      }

      // 2. Rate limit (429)
      if (openaiRes.status === 429) {
        console.error('[parse-sentence] Engine rate limited');
        return NextResponse.json(
          { error: 'API_ERROR', message: 'Engine is busy. Please try again in a moment.' },
          { status: 429 },
        );
      }

      // 3. Other API errors
      console.error('[parse-sentence] Engine error:', openaiRes.status);
      return NextResponse.json(
        { error: 'API_ERROR', message: 'Failed to process your description. Please try again.' },
        { status: 502 },
      );
    }

    const openaiData = await openaiRes.json();

    // ── Content policy check for 200 with content_filter (§11) ────────
    if (isContentPolicyRejection(200, openaiData as Record<string, unknown>)) {
      console.error(
        '[parse-sentence] Content policy filter for input length:',
        sanitised.length,
      );
      return NextResponse.json(
        { error: 'CONTENT_POLICY', message: CONTENT_POLICY_MESSAGE },
        { status: 400 },
      );
    }

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

    const validated = responseSchema.safeParse(jsonParsed);
    if (!validated.success) {
      const fieldErrors = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      console.error('[parse-sentence] Schema validation failed:', fieldErrors);
      return NextResponse.json(
        { error: 'PARSE_ERROR', message: 'Engine response did not match expected format. Please try again.' },
        { status: 502 },
      );
    }

    // ── Return validated response ─────────────────────────────────────
    // Extract mode: { categories: { ... } }  (backward compat)
    // Assess mode:  { assessment: { ... } }  (new v4)
    const responseKey = mode === 'assess' ? 'assessment' : 'categories';

    return NextResponse.json(
      { [responseKey]: validated.data },
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
