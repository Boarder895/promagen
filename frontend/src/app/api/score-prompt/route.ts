// src/app/api/score-prompt/route.ts
// ============================================================================
// POST /api/score-prompt — Builder Quality Scoring v2.1.0
// ============================================================================
// Internal builder quality regression tool. Scores optimised prompts with
// diagnostic voice (identifies builder problems, not user errors), three-level
// anchor audit (exact/approximate/dropped per §3.2), and severity weighting.
//
// v2.1.0 (4 Apr 2026):
// - Rubric extracted to shared scoring-prompt.ts (Part 9 SSOT).
//   buildScoringSystemPrompt() and buildScoringUserMessage() now imported
//   from src/lib/builder-quality/scoring-prompt.ts.
//   No changes to GPT scoring logic, validation, or response shape.
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
import {
  buildScoringSystemPrompt,
  buildScoringUserMessage,
} from "@/lib/builder-quality/scoring-prompt";

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
// RUBRIC — Imported from shared scoring-prompt.ts (Part 9, SSOT)
// ============================================================================
// buildScoringSystemPrompt() and buildScoringUserMessage() are imported
// from src/lib/builder-quality/scoring-prompt.ts. The rubric text lives
// there and NOWHERE ELSE. If you need to change the rubric, change it
// in scoring-prompt.ts — both GPT and Claude scoring use the same source.
// ============================================================================

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
  const systemPrompt = buildScoringSystemPrompt();
  const userMessage = buildScoringUserMessage(validatedRequest);

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
