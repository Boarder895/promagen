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

import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { enforceT1Syntax, enforceNegativeContradiction } from "@/lib/harmony-compliance";
import type { ComplianceContext } from "@/lib/harmony-compliance";
import { resolveGroupPrompt } from "@/lib/optimise-prompts";
import { getProviderGroup } from "@/lib/optimise-prompts/platform-groups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

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
  negativeSupport: z.enum(["separate", "inline", "none", "converted"]),
  /** Platform-specific category priority order */
  categoryOrder: z.array(z.string().max(30)).max(15).optional(),
  /** Platform-specific trait for system prompt (from platform-formats.json) */
  groupKnowledge: z.string().max(300).optional(),
});

const RequestSchema = z.object({
  /** The assembled prompt text to optimise */
  promptText: z
    .string()
    .min(1, "Prompt text cannot be empty")
    .max(5000, "Maximum 5,000 characters"),
  /** The user's original human description (for reference, preserving intent) */
  originalSentence: z.string().max(1000).optional(),
  /** Selected provider ID */
  providerId: z.string().min(1, "Provider ID is required").max(50),
  /** Provider's platform format data */
  providerContext: ProviderContextSchema,
});

// ============================================================================
// RESPONSE SCHEMA
// ============================================================================

const ResponseSchema = z
  .object({
    /** The optimised prompt text — accepts both UK and US spelling */
    optimised: z.string().max(5000).optional(),
    optimized: z.string().max(5000).optional(),
    /** The optimised negative prompt (if applicable) */
    negative: z.string().max(5000).optional(),
    /** Brief descriptions of changes made — no length limits (display-only metadata) */
    changes: z.array(z.string()).optional().default([]),
    /** Character count — optional metadata, overridden server-side anyway */
    charCount: z.coerce.number().optional().default(0),
    /** Estimated token count — optional metadata, never consumed */
    tokenEstimate: z.coerce.number().optional().default(0),
  })
  .passthrough()
  .transform((data) => ({
    optimised: data.optimised || data.optimized || '',
    negative: data.negative,
    changes: data.changes ?? [],
    charCount: Math.round(data.charCount ?? 0),
    tokenEstimate: Math.round(data.tokenEstimate ?? 0),
  }));

export type OptimiseResult = z.infer<typeof ResponseSchema>;

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(req: NextRequest): Promise<Response> {
  // ── Rate limit ──────────────────────────────────────────────────────
  const rl = rateLimit(req, {
    keyPrefix: "optimise-prompt",
    windowSeconds: 3600,
    max: env.isProd ? 30 : 200,
    keyParts: ["POST", "/api/optimise-prompt"],
  });

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message:
          "Optimisation limit reached. Please wait before optimising again.",
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  // ── API key check ───────────────────────────────────────────────────
  const apiKey = env.providers.openAiApiKey;
  if (!apiKey) {
    return NextResponse.json(
      { error: "CONFIG_ERROR", message: "Generation engine not configured." },
      { status: 500 },
    );
  }

  // ── Parse request body ──────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: msg },
      { status: 400 },
    );
  }

  // ── Sanitise inputs ─────────────────────────────────────────────────
  const sanitisedPrompt = parsed.data.promptText.replace(/<[^>]*>/g, "").trim();
  const sanitisedOriginal = parsed.data.originalSentence
    ? parsed.data.originalSentence.replace(/<[^>]*>/g, "").trim()
    : undefined;

  if (!sanitisedPrompt) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: "Prompt text cannot be empty after sanitisation.",
      },
      { status: 400 },
    );
  }

  // ── Build system prompt (group-specific or generic fallback) ────────
  const { systemPrompt, groupCompliance } = resolveGroupPrompt(
    parsed.data.providerId,
    parsed.data.providerContext,
  );

  // ── Detect prose-based groups for primary-input flipping ─────────────
  const providerGroup = getProviderGroup(parsed.data.providerId);
  // These groups read PROSE, not CLIP tags. The original human sentence
  // is the better primary input — the assembled T1 prompt has already
  // lost anchors through compression. Flipping prevents GPT's
  // "optimise = compress" instinct.
  // Legacy group names that are prose-based (kept for safety)
  const legacyProseGroups = new Set([
    "recraft",
    "ideogram",
    "dalle-api",
    "flux-architecture",
  ]);
  // All nl-* dedicated builders are prose. All *-dedicated video builders are prose.
  // SD CLIP builders (stability-dedicated, etc.) are NOT prose — they use keyword syntax.
  const sdClipDedicated = new Set([
    "stability-dedicated",
    "dreamlike-dedicated",
    "dreamstudio-dedicated",
    "fotor-dedicated",
    "lexica-dedicated",
  ]);
  const isProseGroup =
    legacyProseGroups.has(providerGroup ?? "") ||
    (providerGroup?.startsWith("nl-") ?? false) ||
    (providerGroup?.endsWith("-dedicated") && !sdClipDedicated.has(providerGroup ?? "")) ||
    false;

  // ── Compute optimisation zone (api-3.md §3) ──────────────────────────
  // Zone is determined by the reference draft length relative to the
  // platform's limits. Injected into the user message, NOT the system
  // prompt — the zone is variable per call, the system prompt is the
  // platform's fixed rules.
  //
  // Key design decision: if the prompt is below maxChars, the platform
  // accepts it. Don't cut — restructure and reorder. COMPRESS only
  // fires when the prompt exceeds the platform hard limit.
  const promptLength = sanitisedPrompt.length;
  // idealMin: used for ENRICH detection only (never shown to GPT)
  // idealMax: NOT used in route — stays in config for Call 2 / standard builder
  // maxChars: the only number GPT sees (platform hard limit)
  const { idealMin, maxChars } = parsed.data.providerContext;
  const hardCeiling = maxChars ?? 5000;
  const zone: 'ENRICH' | 'REFINE' | 'COMPRESS' =
    promptLength < idealMin ? 'ENRICH'
    : promptLength <= hardCeiling ? 'REFINE'
    : 'COMPRESS';

  const zoneDescriptions: Record<string, string> = {
    ENRICH: sanitisedOriginal
      ? 'Room to add detail — pull missing anchors from the scene description.'
      : 'Room to add detail — expand thin clauses with richer visual language.',
    REFINE: 'Restructure, front-load the subject, strengthen word choices. Do NOT shorten — preserve all visual anchors and keep roughly the same length.',
    COMPRESS: `Must fit within the platform limit of ${hardCeiling} chars. Tighten phrasing, remove filler, preserve all visual anchors.`,
  };

  // GPT sees platform limit + zone strategy only. No idealMin/idealMax range.
  const zoneBlock = `\n\nOPTIMISATION CONTEXT:\nReference draft: ${promptLength} chars. Platform limit: ${hardCeiling} chars.\nStrategy: ${zone} — ${zoneDescriptions[zone]}`;

  // ── Build user message ──────────────────────────────────────────────
  // Prose groups: flip the framing — original sentence is the PRIMARY input
  // ("write the best version of this scene"), assembled is reference material.
  // This prevents GPT from compressing an already-compressed input.
  // CLIP groups: assembled prompt is primary (it has correct syntax/weights).
  // Zone block is appended to ALL user messages (prose and CLIP).
  let userMessage: string;
  if (isProseGroup && sanitisedOriginal) {
    userMessage = `SCENE DESCRIPTION TO OPTIMISE FOR ${parsed.data.providerContext.name.toUpperCase()}:\n${sanitisedOriginal}\n\nREFERENCE DRAFT (use as structural starting point, but enrich with ALL details from the scene description above):\n${sanitisedPrompt}${zoneBlock}`;
  } else if (sanitisedOriginal) {
    userMessage = `ASSEMBLED PROMPT TO OPTIMISE:\n${sanitisedPrompt}\n\nORIGINAL USER DESCRIPTION (for intent reference):\n${sanitisedOriginal}${zoneBlock}`;
  } else {
    userMessage = `ASSEMBLED PROMPT TO OPTIMISE:\n${sanitisedPrompt}${zoneBlock}`;
  }

  // ── Call generation engine ──────────────────────────────────────────
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
          temperature: isProseGroup ? 0.4 : 0.2,
          max_completion_tokens: 1200,
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
      console.error(
        "[optimise-prompt] Engine error:",
        openaiRes.status,
        errText,
      );
      return NextResponse.json(
        {
          error: "API_ERROR",
          message: "Optimisation failed. Please try again.",
        },
        { status: 502 },
      );
    }

    const openaiData = await openaiRes.json();
    const content = openaiData?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      console.error("[optimise-prompt] Empty engine response:", openaiData);
      return NextResponse.json(
        {
          error: "API_ERROR",
          message: "Empty response from engine. Please try again.",
        },
        { status: 502 },
      );
    }

    // ── Parse and validate response ───────────────────────────────────
    let jsonParsed: unknown;
    try {
      jsonParsed = JSON.parse(content);
    } catch {
      console.error("[optimise-prompt] Invalid JSON from engine:", content);
      return NextResponse.json(
        {
          error: "PARSE_ERROR",
          message: "Engine returned invalid data. Please try again.",
        },
        { status: 502 },
      );
    }

    const validated = ResponseSchema.safeParse(jsonParsed);
    if (!validated.success) {
      console.error(
        "[optimise-prompt] Schema validation failed:",
        validated.error.issues,
        "\nGPT returned:",
        JSON.stringify(jsonParsed).slice(0, 500),
      );
      return NextResponse.json(
        {
          error: "PARSE_ERROR",
          message:
            "Engine response did not match expected format. Please try again.",
        },
        { status: 502 },
      );
    }

    // ── Compliance gate: group-specific, then generic syntax enforcement ──
    const result = { ...validated.data };

    // Safety: reject if optimised text is empty after normalisation
    if (!result.optimised || result.optimised.trim().length === 0) {
      console.error("[optimise-prompt] Empty optimised text after normalisation. GPT returned:", JSON.stringify(jsonParsed).slice(0, 500));
      return NextResponse.json(
        {
          error: "EMPTY_RESULT",
          message: "Engine returned an empty prompt. Please try again.",
        },
        { status: 502 },
      );
    }

    // Step 1: Group-specific compliance (if the builder declared one)
    if (groupCompliance) {
      const groupResult = groupCompliance(result.optimised);
      if (groupResult.wasFixed) {
        result.optimised = groupResult.text;
        result.charCount = groupResult.text.length;
        result.changes = [...result.changes, ...groupResult.fixes];
        console.debug(
          "[optimise-prompt] Group compliance fix:",
          groupResult.fixes.join("; "),
        );
      }
    }

    // Step 1.5: Negative-positive contradiction guard
    // Strips terms from the negative that also appear in the positive.
    // A term in both confuses the CLIP encoder.
    if (result.negative) {
      const contradictionResult = enforceNegativeContradiction(
        result.optimised,
        result.negative,
      );
      if (contradictionResult.wasFixed) {
        result.negative = contradictionResult.negative;
        result.changes = [...result.changes, ...contradictionResult.fixes];
        console.debug(
          "[optimise-prompt] Contradiction fix:",
          contradictionResult.fixes.join("; "),
        );
      }
    }

    // Step 2: Generic syntax enforcement (always runs as safety net)
    const compCtx: ComplianceContext = {
      weightingSyntax: parsed.data.providerContext.weightingSyntax,
      supportsWeighting: parsed.data.providerContext.supportsWeighting ?? false,
      providerName: parsed.data.providerContext.name,
      tier: parsed.data.providerContext.tier,
    };

    const syntaxResult = enforceT1Syntax(result.optimised, compCtx);
    if (syntaxResult.wasFixed) {
      result.optimised = syntaxResult.text;
      result.charCount = syntaxResult.text.length;
      result.changes = [...result.changes, ...syntaxResult.fixes];
      console.debug(
        "[optimise-prompt] Compliance fix:",
        syntaxResult.fixes.join("; "),
      );
    }

    // ── Always measure actual charCount — GPT self-reports are unreliable ──
    result.charCount = result.optimised.length;

    // ── Return compliance-gated optimised prompt ─────────────────────
    return NextResponse.json(
      { result },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (err) {
    console.error("[optimise-prompt] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
      { status: 500 },
    );
  }
}
