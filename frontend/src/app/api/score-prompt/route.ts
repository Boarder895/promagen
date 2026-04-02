// src/app/api/score-prompt/route.ts
// ============================================================================
// POST /api/score-prompt — AI Prompt Scoring (Call 4) v1.3.0
// ============================================================================
// Scores an optimised prompt against 5 axes and returns 0-3 actionable
// improvement directives. Does NOT rewrite the prompt — tells the user
// what to fix. Auto-fires after Call 3 for Pro users.
//
// v1.3.0 (2 Apr 2026):
// - Fixed broken calibration examples (removed contradictory lighthouse directive,
//   corrected inline-negative example so negative scoring is coherent).
// - Added relational schema validation: idealMin <= idealMax <= maxChars.
// - Tightened categoryRichness to bounded non-negative integers.
// - Rate limiting now keys by user via keyPrefix scoping.
// - Added explicit inline-negative handling guidance in scoring prompt.
// - Added explicit max_completion_tokens cap for tighter cost control.
// - Improved OpenAI non-200 content-policy handling.
// - Moved dynamic request data into a dedicated user message.
// - Existing features preserved: Yes.
//
// v1.2.0 (2 Apr 2026):
// - Server-side Pro auth enforcement (Clerk publicMetadata.tier === 'paid').
// - Max-length guards on all string fields (abuse/cost protection).
// - Content-filter + finish_reason handling on GPT response.
// - Tighter ceiling clamps: 3→85, 2→89, 1→93, 0→97.
// - Score is deliberately integer (Math.round) — no decimal precision.
//
// v1.1.0 (2 Apr 2026): Calibration examples, consistency rules, clamps.
// v1.0.0 (1 Apr 2026): Initial implementation.
//
// Authority: docs/authority/call4-chatgpt-review-v4.md
// Pattern: matches /api/indices auth pattern (auth() + clerkClient).
// Scope: Prompt Lab (/studio/playground) ONLY — Pro Promagen feature.
// ============================================================================

import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth, clerkClient } from "@clerk/nextjs/server";

import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_OPTIMISED_PROMPT_CHARS = 2000;
const MAX_ASSEMBLED_PROMPT_CHARS = 2000;
const MAX_HUMAN_TEXT_CHARS = 1000;
const MAX_NEGATIVE_PROMPT_CHARS = 500;
const MAX_PLATFORM_ID_CHARS = 50;
const MAX_PLATFORM_NAME_CHARS = 100;
const MAX_CALL3_CHANGES = 10;
const MAX_CALL3_CHANGE_CHARS = 200;
const MAX_PLATFORM_LIMIT = 10000;
const MAX_CATEGORY_RICHNESS = 10;
const OPENAI_MAX_COMPLETION_TOKENS = 450;

// ============================================================================
// REQUEST SCHEMA — Strict types + max-length guards + relational validation
// ============================================================================

const CategoryRichnessValueSchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_CATEGORY_RICHNESS)
  .optional();

const ScoreRequestSchema = z
  .object({
    // Core prompt data — bounded to prevent cost inflation
    optimisedPrompt: z.string().trim().min(1).max(MAX_OPTIMISED_PROMPT_CHARS),
    humanText: z.string().trim().min(1).max(MAX_HUMAN_TEXT_CHARS),
    assembledPrompt: z.string().trim().min(1).max(MAX_ASSEMBLED_PROMPT_CHARS),
    negativePrompt: z.string().trim().max(MAX_NEGATIVE_PROMPT_CHARS).optional(),

    // Platform context (from platform-config.json SSOT)
    platformId: z.string().trim().min(1).max(MAX_PLATFORM_ID_CHARS),
    platformName: z.string().trim().min(1).max(MAX_PLATFORM_NAME_CHARS),
    tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    promptStyle: z.enum(["keywords", "natural"]),
    maxChars: z.number().int().positive().max(MAX_PLATFORM_LIMIT),
    idealMin: z.number().int().nonnegative().max(MAX_PLATFORM_LIMIT),
    idealMax: z.number().int().positive().max(MAX_PLATFORM_LIMIT),
    negativeSupport: z.enum(["separate", "inline", "none"]),

    // Call 3 output context
    call3Changes: z
      .array(z.string().trim().max(MAX_CALL3_CHANGE_CHARS))
      .max(MAX_CALL3_CHANGES),
    call3Mode: z.enum([
      "reorder_only",
      "format_only",
      "gpt_rewrite",
      "pass_through",
      "mj_deterministic",
    ]),

    // Call 1 category richness — 12 known scoring categories
    categoryRichness: z.object({
      subject: CategoryRichnessValueSchema,
      action: CategoryRichnessValueSchema,
      style: CategoryRichnessValueSchema,
      environment: CategoryRichnessValueSchema,
      composition: CategoryRichnessValueSchema,
      camera: CategoryRichnessValueSchema,
      lighting: CategoryRichnessValueSchema,
      colour: CategoryRichnessValueSchema,
      atmosphere: CategoryRichnessValueSchema,
      materials: CategoryRichnessValueSchema,
      fidelity: CategoryRichnessValueSchema,
      negative: CategoryRichnessValueSchema,
    }),
  })
  .superRefine((data, ctx) => {
    if (data.idealMin > data.idealMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["idealMin"],
        message: "idealMin must be less than or equal to idealMax",
      });
    }

    if (data.idealMax > data.maxChars) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["idealMax"],
        message: "idealMax must be less than or equal to maxChars",
      });
    }

    if (
      data.negativeSupport === "none" &&
      data.negativePrompt &&
      data.negativePrompt.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["negativePrompt"],
        message:
          'negativePrompt must be omitted when negativeSupport is "none"',
      });
    }
  });

type ScoreRequest = z.infer<typeof ScoreRequestSchema>;

// ============================================================================
// RESPONSE SCHEMA — Directives 0-3 (banded by score)
// ============================================================================

const ScoreResponseSchema = z.object({
  axes: z.object({
    anchorPreservation: z.number().min(0).max(30),
    platformFit: z.number().min(0).max(25),
    visualSpecificity: z.number().min(0).max(20),
    economyClarity: z.number().min(0).max(15),
    negativeQuality: z.number().min(0).max(10).nullable(),
  }),
  directives: z.array(z.string().trim().min(1).max(300)).min(0).max(3),
  summary: z.string().trim().min(1).max(220),
});

// ============================================================================
// CEILING CLAMPS — Deterministic safety net
// ============================================================================

function applyDirectiveCeilingClamp(
  rawScore: number,
  directiveCount: number,
): number {
  if (directiveCount >= 3 && rawScore > 85) return 85;
  if (directiveCount === 2 && rawScore > 89) return 89;
  if (directiveCount === 1 && rawScore > 93) return 93;
  if (directiveCount === 0 && rawScore > 97) return 97;
  return rawScore;
}

// ============================================================================
// CALIBRATION EXAMPLES — Corrected and internally consistent
// ============================================================================

const CALIBRATION_EXAMPLES = `
CALIBRATION EXAMPLES — Study these carefully. They define the scoring scale.
A polished benchmark prompt with 2-3 meaningful improvements lands in the 75-85 range, not 90+. Scores above 90 are rare and require near-perfection. Scores above 95 should almost never occur.

EXAMPLE 1 — T1 CLIP platform (Stability AI), negativeSupport: separate
Human input: "A fox shrine in autumn with red torii gates and falling maple leaves"
Optimised prompt: "(red torii gates:1.3), (fox shrine:1.2), autumn scene, (falling maple leaves:1.1), golden hour lighting, detailed architecture, japanese style, cinematic composition, 8k uhd"
Negative prompt: "ugly, bad quality, blurry, deformed"
Expected score: 76
Expected axes: { anchorPreservation: 23, platformFit: 21, visualSpecificity: 14, economyClarity: 11, negativeQuality: 3 }
Expected directives (2):
- "Replace generic negative 'ugly, bad quality, blurry, deformed' with specific exclusions like 'chromatic aberration, jpeg artifacts, text overlay, watermark'"
- "Add spatial depth to 'autumn scene' — specify foreground/background relationship, e.g. 'fallen leaves carpeting stone steps in foreground, shrine receding through torii gates'"
Why this score: Good CLIP weight syntax and anchor preservation, but the negative prompt is generic boilerplate and 'autumn scene' is vague where the user specified concrete seasonal detail. The weight values are reasonable but 'cinematic composition' and '8k uhd' are filler tokens that waste budget.

EXAMPLE 2 — T2 Midjourney platform, negativeSupport: inline
Human input: "A cyberpunk courier on a motorcycle weaving through neon-lit rain"
Optimised prompt: "cyberpunk courier on motorcycle::2 weaving through neon-lit rain::1.5 reflections on wet asphalt::1 --ar 16:9 --v 6 --style raw --no text, watermark, duplicate rider"
Expected score: 82
Expected axes: { anchorPreservation: 26, platformFit: 23, visualSpecificity: 14, economyClarity: 12, negativeQuality: 7 }
Expected directives (2):
- "Add material texture to 'motorcycle' — specify chrome, matte black, or carbon fibre to give the renderer concrete surface data"
- "The phrase 'neon-lit rain' lacks colour specificity — add explicit neon colours like 'magenta and cyan reflections' to anchor the palette"
Why this score: Correct Midjourney syntax with explicit inline negatives and good anchor preservation. Loses points on visual specificity because 'motorcycle' and 'neon-lit rain' could carry more concrete detail. Strong prompt, but not exceptional.

EXAMPLE 3 — T3 Natural Language platform (DALL·E 3), negativeSupport: none
Human input: "A weathered lighthouse keeper standing on a rain-lashed gallery deck watching a storm"
Optimised prompt: "A weathered lighthouse keeper grips the iron railing of a rain-lashed gallery deck, staring into enormous storm waves crashing against jagged rocks below. Salt spray rises into a purple and copper twilight while the lighthouse beam cuts a pale gold arc through sheets of driving rain. A distant fishing village glows with warm amber windows against dark cliffs, all with the crisp contrast of a cinematic seascape painting."
Expected score: 83
Expected axes: { anchorPreservation: 27, platformFit: 23, visualSpecificity: 16, economyClarity: 10, negativeQuality: null }
Expected directives (2):
- "Replace 'crisp contrast of a cinematic seascape painting' with a concrete visual detail such as 'wet iron rail glinting in the beam' — the current phrase is stylistic, not visual"
- "Trim 'enormous' from 'enormous storm waves' or replace it with a more concrete wave detail such as 'white-capped storm waves' to reduce abstract emphasis"
Why this score: Strong natural-language prose, most anchors preserved with enrichment. The ending style phrase is abstract rather than visual, and some adjectives remain slightly inflated. Good benchmark prompt, still not close to 90.

EXAMPLE 4 — T4 Plain Language platform (Canva), negativeSupport: none
Human input: "A cosy bookshop with a cat sleeping in the window on a rainy afternoon"
Optimised prompt: "A cosy independent bookshop interior with warm golden lighting. A tabby cat sleeps curled on a velvet window cushion. Rain streaks down the glass pane outside. Stacked books and a steaming mug of tea sit on the wooden sill beside the cat. Soft afternoon light filters through the raindrops."
Expected score: 78
Expected axes: { anchorPreservation: 25, platformFit: 20, visualSpecificity: 15, economyClarity: 11, negativeQuality: null }
Expected directives (2):
- "Remove 'independent' from 'cosy independent bookshop' — it adds no visual information and wastes tokens on a plain-language platform where brevity matters"
- "'Soft afternoon light filters through the raindrops' overlaps with 'rain streaks down the glass pane' — merge them to avoid redundant atmosphere"
Why this score: Good plain-language readability with no jargon, all user anchors present. Loses points because 'independent' is semantically empty for image generation, and there is visible redundancy between the last two sentences. The visual specificity is decent but still improvable.
`;

// ============================================================================
// SYSTEM PROMPT — Stable rules only
// ============================================================================

function buildSystemPrompt(): string {
  return `You are a strict, conservative prompt quality scorer for AI image generation platforms.

CRITICAL SCORING PHILOSOPHY:
- A score of 90+ is EXCEPTIONAL and rare. It means the prompt is nearly flawless.
- A score of 80-89 is STRONG. This is where most well-crafted prompts belong.
- A score of 70-79 is GOOD. Solid work with clear room for improvement.
- A score below 70 means significant problems.
- You should almost never score above 90. If you find yourself doing so, look harder for flaws.

TASK:
Score the optimised prompt against 5 axes and return JSON only.

SCORING RUBRIC:

1. ANCHOR PRESERVATION (0-30 points)
Compare the user's original input → assembled → optimised.
Are the user's key visual anchors STILL PRESENT in the optimised prompt?
- 28-30: Every single user anchor preserved with zero loss — rare, requires exact match
- 24-27: All anchors present, minor rephrasing that preserves meaning
- 18-23: Most anchors present but some rephrased loosely or reordered poorly
- 10-17: Noticeable anchor loss — user's specific details dropped or generalised
- 0-9: Most anchors lost or unrecognisable
Use category richness to weight importance — if the user invested 3 terms in lighting, losing 2 is a bigger penalty.
Scoring 28+ requires that EVERY specific noun, colour, material, and spatial relationship from the user's input survives intact. This is rare.

2. PLATFORM-NATIVE FIT (0-25 points)
For T1/T2, syntax matters.
For T3/T4, style and clarity matter.
- 24-25: Flawless fit for the platform. Rare.
- 18-23: Strong fit with minor issues
- 12-17: Mixed fit with noticeable weaknesses
- 5-11: Poor fit with major problems
- 0-4: Wrong approach entirely

3. VISUAL SPECIFICITY (0-20 points)
Count concrete visual anchors: materials, colours, light directions, spatial relationships, textures, atmospheric effects.
- 19-20: Exceptional — every element has material, colour, and spatial grounding. Rare.
- 15-18: Rich concrete imagery with 1-2 vague areas
- 10-14: Decent specificity but multiple elements lack visual concreteness
- 5-9: Mostly vague or generic descriptions
- 0-4: Almost no concrete visual detail
Words like "beautiful", "stunning", "amazing", "gorgeous" score ZERO — they carry no visual information.

4. ECONOMY & CLARITY (0-15 points)
Judge against idealMin / idealMax / maxChars.
- 14-15: Every single word earns its place, zero redundancy, within sweet spot. Rare.
- 11-13: Tight with one or two minor redundancies
- 7-10: Noticeable waste — duplicated modifiers, filler words, or unnecessary length
- 3-6: Significant bloat or unclear structure
- 0-2: Chaotic or incomprehensible

5. NEGATIVE QUALITY (0-10 points | null when unsupported)
When negatives are supported:
- 9-10: Platform-specific, concrete exclusions. Rare.
- 6-8: Mostly specific with one or two generic terms
- 3-5: Mix of specific and generic, or missing important exclusions
- 1-2: Mostly generic boilerplate
- 0: No negatives when supported, or contradictions with the positive prompt
Generic negatives like "ugly, bad quality, deformed, blurry" should NEVER score above 3.
When negatives are unsupported: return null.

INLINE NEGATIVE HANDLING:
If the platform uses inline negatives, score them ONLY when explicit exclusions are visibly present in the optimised prompt itself (for example: "--no text, watermark" or "without text overlay").
Do not invent negatives that are not present.
If inline negative support exists but no explicit exclusions appear, score negative quality as 0.

SCORE ↔ DIRECTIVE CONSISTENCY RULES (MANDATORY):
Your score and directive count MUST be internally consistent.

- Score 92-100: Return 0 or 1 directive ONLY. Near-flawless. Almost never appropriate.
- Score 80-91: Return 1 or 2 directives. Strong prompt with clear improvements.
- Score 70-79: Return 2 or 3 directives. Good prompt with meaningful headroom.
- Score below 70: Return 3 directives. Significant issues.

HARD LIMITS:
- If you return 3 directives, your score MUST be 85 or below.
- If you return 2 directives, your score MUST be 89 or below.
- If you return 1 directive, your score MUST be 93 or below.
- Only 0 directives allows 94+, and only when genuinely near-perfect.

PROCESS:
1. Score the axes first.
2. Sum them honestly.
3. Decide directive count that matches the score.
4. Never inflate axes and then add contradictory directives.

DIRECTIVE RULES:
- Each directive MUST reference a specific phrase from the prompt
- Phrase-level references only — NEVER word positions or indices
- Each directive must be actionable
- Bad: "Make it more descriptive"
- Bad: "Add more lighting detail"
- Good: "Replace generic negative 'ugly, bad quality' with 'chromatic aberration, motion blur, text overlay'"
- Good: "Trim 'enormous storm waves' to a more concrete phrase such as 'white-capped storm waves'"

${CALIBRATION_EXAMPLES}

RESPONSE FORMAT (JSON only, no markdown, no backticks, no commentary):
{
  "axes": {
    "anchorPreservation": <0-30>,
    "platformFit": <0-25>,
    "visualSpecificity": <0-20>,
    "economyClarity": <0-15>,
    "negativeQuality": <0-10 or null>
  },
  "directives": [<0-3 directives matching score band>],
  "summary": "<one sentence overall assessment>"
}`;
}

// ============================================================================
// USER MESSAGE — Dynamic request context only
// ============================================================================

function buildUserMessage(req: ScoreRequest): string {
  const tierDesc =
    req.tier === 1
      ? "CLIP-weighted"
      : req.tier === 2
        ? "Midjourney-native"
        : req.tier === 3
          ? "Natural language"
          : "Plain language";

  const richCategories = Object.entries(req.categoryRichness)
    .filter(([, value]) => typeof value === "number" && value > 0)
    .map(([key, value]) => `${key}: ${value} terms`)
    .join(", ");

  const lines: string[] = [
    `PLATFORM: ${req.platformName} (${req.platformId})`,
    `TIER: T${req.tier} — ${tierDesc}`,
    `PROMPT STYLE: ${req.promptStyle}`,
    `CHARACTER LIMITS: idealMin=${req.idealMin}, idealMax=${req.idealMax}, maxChars=${req.maxChars}`,
    `NEGATIVE SUPPORT: ${req.negativeSupport}`,
    `CALL 3 MODE: ${req.call3Mode}`,
    `CALL 3 CHANGES: ${req.call3Changes.length > 0 ? req.call3Changes.join("; ") : "none"}`,
    `CATEGORY RICHNESS: ${richCategories || "none detected"}`,
    "",
    "ORIGINAL HUMAN INPUT:",
    req.humanText,
    "",
    "ASSEMBLED PROMPT (pre-optimisation):",
    req.assembledPrompt,
    "",
    "OPTIMISED PROMPT (score this):",
    req.optimisedPrompt,
  ];

  if (req.negativeSupport === "separate") {
    lines.push(
      "",
      "SEPARATE NEGATIVE PROMPT:",
      req.negativePrompt || "(none provided)",
    );
  } else if (req.negativeSupport === "inline") {
    lines.push(
      "",
      "INLINE NEGATIVE NOTE:",
      "If explicit exclusions are present, they will be embedded in the optimised prompt itself. Only score negatives that are visibly present there.",
    );
  } else {
    lines.push(
      "",
      "NEGATIVE NOTE:",
      "This platform does not support negatives.",
    );
  }

  return lines.join("\n");
}

// ============================================================================
// HELPERS
// ============================================================================

function mapOpenAiErrorStatus(status: number, bodyText: string): NextResponse {
  const lower = bodyText.toLowerCase();

  if (
    status === 400 &&
    (lower.includes("content_policy_violation") ||
      lower.includes("content policy") ||
      lower.includes("safety system"))
  ) {
    return NextResponse.json(
      { error: "Scoring unavailable — content policy filter triggered" },
      { status: 422 },
    );
  }

  return NextResponse.json(
    { error: "Scoring engine error" },
    { status: status >= 500 ? 502 : status },
  );
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  // ── Auth: Pro users only ─────────────────────────────────────────
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    return NextResponse.json(
      { error: "Authentication unavailable" },
      { status: 503 },
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const tier = (user.publicMetadata as Record<string, unknown>)?.tier;
    if (tier !== "paid") {
      return NextResponse.json(
        { error: "Pro Promagen required" },
        { status: 403 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Unable to verify subscription" },
      { status: 503 },
    );
  }

  // ── Rate limit (user-scoped) ─────────────────────────────────────
  const rl = rateLimit(req, {
    keyPrefix: `score-prompt:${userId}`,
    windowSeconds: 3600,
    max: env.isProd ? 30 : 200,
  });

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "Too many score requests. Try again later.",
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  // ── Parse & validate request ─────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ScoreRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // ── API key check ────────────────────────────────────────────────
  const apiKey = env.providers.openAiApiKey;
  if (!apiKey) {
    console.error("[score-prompt] OPENAI_API_KEY not configured");
    return NextResponse.json(
      { error: "Scoring engine not configured" },
      { status: 503 },
    );
  }

  const validatedRequest = parsed.data;
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(validatedRequest);

  // ── Call GPT (temperature 0.2 for scoring consistency) ──────────
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
          temperature: 0.2,
          max_completion_tokens: OPENAI_MAX_COMPLETION_TOKENS,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
        }),
      },
    );

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => "Unknown error");
      console.error(`[score-prompt] OpenAI ${openaiRes.status}:`, errText);
      return mapOpenAiErrorStatus(openaiRes.status, errText);
    }

    const openaiData = await openaiRes.json();

    // ── Content-filter / finish-reason handling ──────────────────
    const choice = openaiData?.choices?.[0];
    if (!choice) {
      console.error("[score-prompt] No choices in response:", openaiData);
      return NextResponse.json(
        { error: "Empty scoring response" },
        { status: 502 },
      );
    }

    const finishReason = choice.finish_reason;
    if (finishReason === "content_filter") {
      console.warn("[score-prompt] Content filtered by OpenAI policy");
      return NextResponse.json(
        { error: "Scoring unavailable — content policy filter triggered" },
        { status: 422 },
      );
    }
    if (finishReason === "length") {
      console.warn(
        "[score-prompt] Response truncated (completion token cap reached)",
      );
      return NextResponse.json(
        { error: "Scoring response was truncated — try a shorter prompt" },
        { status: 502 },
      );
    }
    if (finishReason !== "stop") {
      console.warn(`[score-prompt] Unexpected finish_reason: ${finishReason}`);
      // Continue — may still be usable.
    }

    const content = choice.message?.content;
    if (!content) {
      console.error("[score-prompt] Empty message content:", openaiData);
      return NextResponse.json(
        { error: "Empty scoring response" },
        { status: 502 },
      );
    }

    // ── Parse & validate response ────────────────────────────────
    let rawScore: unknown;
    try {
      rawScore = JSON.parse(content);
    } catch {
      console.error("[score-prompt] Failed to parse response JSON:", content);
      return NextResponse.json(
        { error: "Invalid scoring response format" },
        { status: 502 },
      );
    }

    const validated = ScoreResponseSchema.safeParse(rawScore);
    if (!validated.success) {
      console.error(
        "[score-prompt] Response validation failed:",
        validated.error.flatten(),
      );
      return NextResponse.json(
        { error: "Scoring response did not match expected schema" },
        { status: 502 },
      );
    }

    // ── Compute normalised headline score (integer, deliberate) ──
    const { axes, directives, summary } = validated.data;
    const rawTotal =
      axes.anchorPreservation +
      axes.platformFit +
      axes.visualSpecificity +
      axes.economyClarity +
      (axes.negativeQuality ?? 0);

    const maxPossible = axes.negativeQuality !== null ? 100 : 90;
    let score = Math.round((rawTotal / maxPossible) * 100);
    score = Math.min(100, Math.max(0, score));

    // ── Server-side ceiling clamp ────────────────────────────────
    const clampedScore = applyDirectiveCeilingClamp(score, directives.length);

    if (clampedScore !== score) {
      console.debug(
        `[score-prompt] Ceiling clamp applied: ${score} → ${clampedScore} (${directives.length} directives)`,
      );
    }

    return NextResponse.json({
      score: clampedScore,
      axes,
      directives,
      summary,
    });
  } catch (err) {
    console.error("[score-prompt] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal scoring error" },
      { status: 500 },
    );
  }
}
