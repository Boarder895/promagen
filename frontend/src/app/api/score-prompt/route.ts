// src/app/api/score-prompt/route.ts
// ============================================================================
// POST /api/score-prompt — Builder Quality Scoring v2.0.0
// ============================================================================
// Internal builder quality regression tool. Scores optimised prompts with
// diagnostic voice (identifies builder problems, not user errors), three-level
// anchor audit (exact/approximate/dropped per §3.2), and severity weighting.
//
// v2.0.0 (3 Apr 2026):
// - MAJOR: Scoring reframed from user-facing to builder diagnostics.
//   System prompt uses diagnostic voice throughout.
//   Directives diagnose builder failures, not user mistakes.
//   Anchor audit added: three-level classification (exact/approximate/dropped)
//   with 5 strict sub-rules (A–E) from §3.2.
//   Expected anchors accepted in request body.
//   anchorAudit array returned in response.
//   Calibration examples rewritten for diagnostic framing.
//   Token cap raised to 900 for anchor audit output.
//   Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §3.2, §5
//
// v1.4.0 (3 Apr 2026):
// - Route hardened: X-Builder-Quality-Key header required on all requests.
//
// v1.3.0 (2 Apr 2026): Relational validation, calibration, rate limit.
// v1.2.0 (2 Apr 2026): Max-length guards, ceiling clamps.
// v1.1.0 (2 Apr 2026): Calibration examples, consistency rules.
// v1.0.0 (1 Apr 2026): Initial implementation.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0
// Scope: Internal batch runner only. No user-facing consumer.
// Existing features preserved: Yes
// ============================================================================

import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";

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
const OPENAI_MAX_COMPLETION_TOKENS = 1200;

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

    // Expected anchors for anchor audit (from test scene definition)
    expectedAnchors: z
      .array(
        z.object({
          term: z.string().trim().min(1).max(200),
          severity: z.enum(["critical", "important", "optional"]),
        }),
      )
      .max(30)
      .optional(),
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
  summary: z.string().trim().min(1).max(300),
  anchorAudit: z
    .array(
      z.object({
        anchor: z.string(),
        severity: z.enum(["critical", "important", "optional"]),
        status: z.enum(["exact", "approximate", "dropped"]),
        note: z.string().optional(),
      }),
    )
    .optional(),
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
CALIBRATION EXAMPLES — Diagnostic framing. These are builder assessments, not user feedback.

EXAMPLE 1 — T1 CLIP platform (Stability AI), negativeSupport: separate
Human input: "A fox shrine in autumn with red torii gates and falling maple leaves"
Optimised prompt: "(red torii gates:1.3), (fox shrine:1.2), autumn scene, (falling maple leaves:1.1), golden hour lighting, detailed architecture, japanese style, cinematic composition, 8k uhd"
Expected anchors: fox shrine (critical), torii gates (critical), red (important), autumn (important), maple leaves (important), falling (optional)
Expected score: 76
Expected anchorAudit: [
  {"anchor":"fox shrine","severity":"critical","status":"exact"},
  {"anchor":"torii gates","severity":"critical","status":"exact"},
  {"anchor":"red","severity":"important","status":"exact"},
  {"anchor":"autumn","severity":"important","status":"approximate","note":"Call 3 flattened 'autumn' to generic 'autumn scene' — lost the specificity of foliage colour and atmosphere"},
  {"anchor":"maple leaves","severity":"important","status":"exact"},
  {"anchor":"falling","severity":"optional","status":"exact"}
]
Expected directives (2):
- "Call 3 padded with filler tokens 'cinematic composition, 8k uhd' — these waste CLIP weight budget without adding visual information"
- "Call 3 flattened 'autumn' to 'autumn scene' — the assembled prompt's seasonal detail was more specific"
Why this score: Good CLIP syntax, core anchors preserved. Builder added filler tokens that waste budget. Negative prompt is generic boilerplate (not the builder's fault if that's the platform default, but still scores low on negativeQuality).

EXAMPLE 2 — T3 Natural Language platform (DALL-E 3), negativeSupport: none
Human input: "A weathered lighthouse keeper standing on a rain-lashed gallery deck watching a storm"
Optimised prompt: "A weathered lighthouse keeper grips the iron railing of a rain-lashed gallery deck, staring into enormous storm waves crashing against jagged rocks below. Salt spray rises into a purple and copper twilight while the lighthouse beam cuts a pale gold arc through sheets of driving rain."
Expected anchors: lighthouse keeper (critical), gallery deck (critical), rain-lashed (important), storm (important)
Expected score: 84
Expected anchorAudit: [
  {"anchor":"lighthouse keeper","severity":"critical","status":"exact"},
  {"anchor":"gallery deck","severity":"critical","status":"exact"},
  {"anchor":"rain-lashed","severity":"important","status":"exact"},
  {"anchor":"storm","severity":"important","status":"exact"}
]
Expected directives (1):
- "Call 3 added 'enormous' before 'storm waves' — the enrichment is acceptable but slightly inflated. Consider whether the builder's adjective choices add concrete visual data or just emphasis"
Why this score: Strong NL prose, all anchors preserved with enrichment. Minor inflation from builder, but no anchor loss.
`;

// ============================================================================
// SYSTEM PROMPT — Builder diagnostic voice (§5.2)
// ============================================================================

function buildSystemPrompt(): string {
  return `You are an internal builder quality diagnostic tool for Promagen's Call 3 prompt optimisation engine.

YOUR ROLE:
You assess whether Call 3 (the platform-specific optimisation step) preserved the user's visual anchors and improved the prompt. Your audience is the developer reviewing builder performance — NOT the user.

DIAGNOSTIC VOICE:
- Directives diagnose what Call 3 did wrong: "Call 3 dropped 'cinematic' from the user's anchor" — NOT "Restore the original colour"
- You are identifying builder failures, not giving the user feedback
- Reference "Call 3", "the builder", or "the optimiser" — never "you" or "the user should"

CRITICAL SCORING PHILOSOPHY:
- 90+ is EXCEPTIONAL and rare. Nearly flawless builder output.
- 80-89 is STRONG. Most well-built platform prompts land here.
- 70-79 is GOOD. Clear room for builder improvement.
- Below 70 means significant builder problems.

SCORING RUBRIC:

1. ANCHOR PRESERVATION (0-30 points)
Compare human input → assembled → optimised. Did Call 3 preserve the user's key visual anchors?
- 28-30: Every anchor preserved exactly — rare
- 24-27: All anchors present, minor rephrasing preserving meaning
- 18-23: Most present but some rephrased loosely
- 10-17: Noticeable anchor loss by the builder
- 0-9: Most anchors lost

2. PLATFORM-NATIVE FIT (0-25 points)
T1/T2: syntax correctness. T3/T4: style and clarity.
- 24-25: Flawless fit. Rare.
- 18-23: Strong fit with minor issues
- 12-17: Mixed
- 0-11: Poor

3. VISUAL SPECIFICITY (0-20 points)
Materials, colours, light directions, spatial relationships, textures, atmospheric effects.
- 19-20: Exceptional. Rare.
- 15-18: Rich with 1-2 vague areas
- 10-14: Decent but gaps
- 0-9: Mostly vague

4. ECONOMY & CLARITY (0-15 points)
Judged against idealMin / idealMax / maxChars.
- 14-15: Zero redundancy. Rare.
- 11-13: Tight with minor waste
- 7-10: Noticeable bloat
- 0-6: Significant problems

5. NEGATIVE QUALITY (0-10 points | null when unsupported)
- 9-10: Platform-specific exclusions. Rare.
- 6-8: Mostly specific
- 3-5: Mix of specific and generic
- 0-2: Generic boilerplate
Unsupported: null.

ANCHOR AUDIT:
When expectedAnchors are provided, you MUST return an anchorAudit array classifying each anchor.

Classification rules (§3.2):
- EXACT: Literal match (case-insensitive) or minor punctuation difference
- APPROXIMATE: Recognised synonym preserving visual meaning, morphological variant, reordered phrase keeping all content words, compressed equivalent keeping the specific noun
- DROPPED: Generic abstraction, colour generalisation, noun class substitution, complete omission, meaning inversion, flattened to category label

Sub-rules:
A) If the dropped modifier is the visually distinctive part → DROPPED not approximate. "ornate black armor" → "black armor" = DROPPED.
B) If the specific identifier token is lost → DROPPED. "French New Wave" → "French art film" = DROPPED.
C) Negative anchors only count as approximate when absence is stated unambiguously. "no smoke" → "clear chimney" = DROPPED (implicit). "no smoke" → "smokeless" = APPROXIMATE.
D) Proper nouns, brand names, film stocks, camera models, titled works: EXACT or DROPPED only. No approximate. "Kodak Vision3 500T" → "Kodak film" = DROPPED.
E) Compound anchors with multiple distinctive modifiers: loss of any modifier that materially changes visual identity = DROPPED. "matte-black tactical trench coat" → "black trench coat" = DROPPED.

WHEN IN DOUBT: classify as DROPPED. False negatives are worse than false positives for a regression tool.

SCORE ↔ DIRECTIVE CONSISTENCY (MANDATORY):
- 92-100: 0-1 directive. Near-flawless. Almost never appropriate.
- 80-91: 1-2 directives.
- 70-79: 2-3 directives.
- Below 70: 3 directives.

HARD LIMITS:
- 3 directives → score MUST be ≤85
- 2 directives → score MUST be ≤89
- 1 directive → score MUST be ≤93

DIRECTIVE RULES:
- Diagnostic voice: "Call 3 dropped...", "The builder flattened...", "The optimiser added..."
- Reference specific phrases from the prompt
- Actionable for the developer fixing the builder

${CALIBRATION_EXAMPLES}

RESPONSE FORMAT (JSON only, no markdown, no backticks):
{
  "axes": {
    "anchorPreservation": <0-30>,
    "platformFit": <0-25>,
    "visualSpecificity": <0-20>,
    "economyClarity": <0-15>,
    "negativeQuality": <0-10 or null>
  },
  "directives": [<0-3 diagnostic directives>],
  "summary": "<one sentence builder diagnostic>",
  "anchorAudit": [
    {"anchor": "<term>", "severity": "<critical|important|optional>", "status": "<exact|approximate|dropped>", "note": "<optional diagnostic note>"}
  ]
}

If no expectedAnchors were provided, omit the anchorAudit field entirely.`;
}

// ============================================================================
// USER MESSAGE — Dynamic request context + expected anchors
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
      "If explicit exclusions are present, they will be embedded in the optimised prompt itself.",
    );
  } else {
    lines.push("", "NEGATIVE NOTE:", "This platform does not support negatives.");
  }

  // Expected anchors for anchor audit
  if (req.expectedAnchors && req.expectedAnchors.length > 0) {
    lines.push("", "EXPECTED ANCHORS (classify each in anchorAudit):");
    for (const anchor of req.expectedAnchors) {
      lines.push(`  - "${anchor.term}" [${anchor.severity}]`);
    }
    lines.push(
      "",
      "For each anchor above, return an entry in anchorAudit with status: exact, approximate, or dropped.",
      "Follow the §3.2 matching policy and sub-rules A-E strictly. When in doubt, classify as dropped.",
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
  // ── Auth: X-Builder-Quality-Key (§5.1) ──────────────────────────
  // All requests require a valid server-side key. The user-facing score
  // was killed (v4.2.0) — the batch runner is the sole consumer.
  const builderKey = env.builderQualityKey;
  const requestKey = req.headers.get("X-Builder-Quality-Key");

  if (!builderKey || !requestKey || requestKey !== builderKey) {
    return NextResponse.json(
      { error: "Unauthorized — valid X-Builder-Quality-Key required" },
      { status: 401 },
    );
  }

  // ── Rate limit: BYPASSED ─────────────────────────────────────────
  // All requests require X-Builder-Quality-Key (checked above).
  // Only the batch runner reaches this point — no user-facing consumer.
  // Rate limiting removed to allow full 320+ result batch runs.

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
      // Continue — response may still be usable.
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
      ...(validated.data.anchorAudit && {
        anchorAudit: validated.data.anchorAudit,
      }),
    });
  } catch (err) {
    console.error("[score-prompt] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal scoring error" },
      { status: 500 },
    );
  }
}
