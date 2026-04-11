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
import { extractAnchors, analyseOptimisationNeed, reorderSubjectFirst } from "@/lib/optimise-prompts/preflight";
import type { Call3Mode } from "@/lib/optimise-prompts/preflight";
import { runMjDeterministic } from "@/lib/optimise-prompts/midjourney-deterministic";
import { checkRegression, defaultRegressionOptions, checkMjDeterministicRegression } from "@/lib/optimise-prompts/regression-guard";
import { computeAPS } from "@/lib/optimise-prompts/aps-gate";
import { getDNA } from "@/data/platform-dna";
import { runDeterministicTransforms } from "@/lib/call-3-transforms";

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
  /** Call 3 routing mode — controls whether GPT is called */
  call3Mode: z.enum(["reorder_only", "format_only", "gpt_rewrite", "pass_through", "mj_deterministic"]).optional(),
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
  /**
   * Part 12: Admin-only system prompt override for patch testing.
   * Only honoured when X-Builder-Quality-Key is valid.
   * Substitutes the builder file's system prompt while preserving
   * the full routing, compliance, and post-processing path.
   */
  systemPromptOverride: z.string().max(10000).optional(),
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
  // ── Builder quality key bypass ────────────────────────────────────
  // Batch runner sends X-Builder-Quality-Key to bypass rate limiting.
  // User-facing requests (no key) still rate-limited as before.
  const builderKey = env.builderQualityKey;
  const requestKey = req.headers.get("X-Builder-Quality-Key");
  const isBatchRunner = Boolean(builderKey && requestKey && requestKey === builderKey);

  // ── Rate limit (skip for authenticated batch runner) ──────────────
  if (!isBatchRunner) {
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
  const { systemPrompt: resolvedSystemPrompt, groupCompliance, temperature: builderTemperature } = resolveGroupPrompt(
    parsed.data.providerId,
    parsed.data.providerContext,
  );

  // ── Part 12: Admin-only system prompt override for patch testing ────
  // Only honoured when X-Builder-Quality-Key is valid (admin/script context).
  // Substitutes the builder's system prompt while preserving the full
  // routing, compliance gate, and post-processing pipeline.
  // Security: ignored without valid admin auth. Never available to normal users.
  const systemPrompt = (isBatchRunner && parsed.data.systemPromptOverride)
    ? parsed.data.systemPromptOverride
    : resolvedSystemPrompt;

  // ── Detect prose-based groups for temperature selection ───────────────
  const providerGroup = getProviderGroup(parsed.data.providerId);
  // Prose groups get temperature 0.4 (more creative rewriting).
  // CLIP/keyword groups get temperature 0.2 (tighter syntax control).
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

  // ── Preflight decision engine ──────────────────────────────────────
  // Runs BEFORE GPT. Decides whether GPT is needed or a deterministic
  // transform suffices. Most Tier 4 platforms skip GPT entirely.
  // DNA profile takes priority over legacy call3Mode (Phase 5).
  const { maxChars } = parsed.data.providerContext;
  const hardCeiling = maxChars ?? 5000;
  const call3Mode = (parsed.data.providerContext.call3Mode ?? 'gpt_rewrite') as Call3Mode;
  const anchors = extractAnchors(sanitisedPrompt);
  const dna = getDNA(parsed.data.providerId);
  const decision = analyseOptimisationNeed(sanitisedPrompt, call3Mode, hardCeiling, anchors, dna);

  // ── Deterministic fast path (no GPT) ───────────────────────────────
  if (decision === 'PASS_THROUGH' || decision === 'REORDER_ONLY' || decision === 'FORMAT_ONLY' || decision === 'MJ_DETERMINISTIC_ONLY' || decision === 'DNA_DETERMINISTIC') {
    let optimised = sanitisedPrompt;
    const changes: string[] = [];

    // DNA_DETERMINISTIC: run the full transform catalogue from DNA profile
    if (decision === 'DNA_DETERMINISTIC' && dna) {
      const pipelineResult = runDeterministicTransforms(sanitisedPrompt, dna, anchors);
      optimised = pipelineResult.text;
      changes.push(...pipelineResult.changes);

      if (pipelineResult.transformsModified.length > 0) {
        console.debug(
          `[optimise-prompt] DNA deterministic: ${dna.id} — modified: ${pipelineResult.transformsModified.join(', ')} | executed: ${pipelineResult.transformsExecuted.length} | skipped: ${pipelineResult.transformsSkipped.length}`,
        );
      }
    }
    // MJ_DETERMINISTIC_ONLY: parse, validate, normalise Midjourney structure
    else if (decision === 'MJ_DETERMINISTIC_ONLY') {
      const mj = runMjDeterministic(sanitisedPrompt);
      optimised = mj.result.text;
      changes.push(...mj.result.changes);

      // Surface validation warnings (thin clauses, etc.)
      if (mj.validation.warnings.length > 0) {
        changes.push(...mj.validation.warnings);
      }

      // Lightweight MJ regression check (belt-and-braces)
      // Checks: clause count, weights, params, --no, no parenthetical leaks
      const mjRegression = checkMjDeterministicRegression(sanitisedPrompt, optimised);
      if (!mjRegression.passed) {
        console.warn("[optimise-prompt] MJ deterministic regression:", mjRegression.regressions.join('; '));
        optimised = sanitisedPrompt;
        changes.length = 0;
        changes.push(`MJ deterministic regression: ${mjRegression.regressions.join('; ')}`);
        changes.push('The Algorithms declared the assembled prompt to also be the Optimised Prompt');
      }
    }
    // REORDER_ONLY: deterministic subject-front-load
    else if (decision === 'REORDER_ONLY') {
      const reorderResult = reorderSubjectFirst(sanitisedPrompt);
      if (reorderResult) {
        optimised = reorderResult.reordered;
        changes.push(...reorderResult.changes);
      } else {
        // Reorder not confident — pass through unchanged
        changes.push('Subject reorder not applicable — returned unchanged');
      }
    } else if (decision === 'PASS_THROUGH') {
      changes.push('Prompt already optimised for platform — no changes needed');
    } else {
      changes.push('Format-only cleanup applied');
    }

    // Run group compliance gate (syntax cleanup, maxChars enforcement)
    if (groupCompliance) {
      const gateResult = groupCompliance(optimised);
      if (gateResult.wasFixed) {
        optimised = gateResult.text;
        changes.push(...gateResult.fixes);
      }
    }

    // Negative contradiction guard (same as GPT path)
    // Not applicable for deterministic path — no negative generated

    return NextResponse.json(
      {
        result: {
          optimised,
          negative: undefined,
          changes,
          charCount: optimised.length,
          tokenEstimate: Math.round(optimised.length / 4),
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  // ── GPT path (decision === 'GPT_REWRITE' or 'COMPRESS_ONLY') ──────

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
  const { idealMin } = parsed.data.providerContext;
  const zone: 'ENRICH' | 'REFINE' | 'COMPRESS' =
    promptLength < idealMin ? 'ENRICH'
    : promptLength <= hardCeiling ? 'REFINE'
    : 'COMPRESS';

  const zoneDescriptions: Record<string, string> = {
    ENRICH: 'Room to add detail — expand thin clauses with richer visual language.',
    REFINE: 'Restructure for this platform. Front-load the subject, upgrade weak verbs, tighten phrasing. Length may go up or down — the goal is a better prompt, not a longer or shorter one.',
    COMPRESS: `Must fit within the platform limit of ${hardCeiling} chars. Tighten phrasing, remove filler, preserve all visual anchors.`,
  };

  // GPT sees platform name + limit + zone strategy. No idealMin/idealMax range.
  const zoneBlock = `\n\nOPTIMISATION CONTEXT:\nPlatform: ${parsed.data.providerContext.name}. Reference draft: ${promptLength} chars. Platform limit: ${hardCeiling} chars.\nStrategy: ${zone} — ${zoneDescriptions[zone]}`;

  // ── Build user message ──────────────────────────────────────────────
  // Clean separation: Call 2 owns content decisions. Call 3 owns
  // platform presentation. GPT sees ONLY the assembled prompt + zone.
  // The original human sentence is never passed to Call 3 — if Call 2
  // made anchor decisions, Call 3 respects them and restructures for
  // the platform rather than second-guessing Call 2's output.
  const userMessage = `PROMPT TO OPTIMISE FOR ${parsed.data.providerContext.name.toUpperCase()}:\n${sanitisedPrompt}${zoneBlock}`;

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
          temperature: builderTemperature ?? (isProseGroup ? 0.4 : 0.2),
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

    // Step 2: Syntax enforcement — tier-aware
    //
    // All 40 known platforms have their own group compliance gate (Step 1)
    // that handles platform-specific syntax. The generic enforceT1Syntax
    // only runs as a fallback for unknown platforms (no group gate).
    //
    // Previously this ran on ALL platforms and destroyed valid Midjourney
    // ::weight syntax because platform-config was missing supportsWeighting.
    if (!groupCompliance) {
      // Unknown platform — no group gate ran, so generic safety net is needed
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
          "[optimise-prompt] Generic compliance fix:",
          syntaxResult.fixes.join("; "),
        );
      }
    }

    // Step 2.5: T2 Midjourney weight validator — fail hard, not silently degrade
    //
    // If the assembled prompt had ::weight clauses and the optimised output
    // lost them all, the output is worse than the input. Reject GPT's output
    // and return the assembled prompt with only the group gate applied.
    const inputHadWeights = /\w::[\d.]+/.test(sanitisedPrompt);
    const outputHasWeights = /\w::[\d.]+/.test(result.optimised);
    if (inputHadWeights && !outputHasWeights) {
      console.warn(
        "[optimise-prompt] T2 weight regression detected — input had ::weights, output lost them. Falling back to assembled prompt.",
      );
      result.optimised = sanitisedPrompt;
      result.charCount = sanitisedPrompt.length;
      result.changes = ["Weight regression detected — the Algorithms declared the assembled prompt to also be the Optimised Prompt"];
    }

    // Step 3: Quality gates — "no worse than input"
    //
    // Two-layer defence:
    //   Layer 1: APS gate (primary) — anchor preservation score + 3 vetoes
    //   Layer 2: Regression guard (secondary) — 8 heuristic checks
    //
    // APS gate catches anchor loss, invented content, and prose quality
    // degradation. Regression guard catches edge cases the APS misses
    // (verb substitution, sentence count drift, weight loss on T1/T2).
    //
    // Architecture: call-3-quality-architecture-v0.2.0.md §6

    // ── Layer 1: APS gate (primary quality gate) ─────────────────────
    const apsResult = computeAPS(sanitisedPrompt, result.optimised, anchors);

    if (apsResult.verdict === 'REJECT' || apsResult.verdict === 'RETRY') {
      // REJECT or RETRY → fallback to assembled prompt
      // Phase 8 will add retry logic for RETRY verdict on retry-enabled platforms.
      // Until then, RETRY is treated as REJECT (fallback).
      const reason = apsResult.anyVetoFired
        ? `APS gate: score=${apsResult.score.toFixed(2)} verdict=${apsResult.scoreVerdict}, ` +
          `vetoed: ${[
            apsResult.criticalAnchorVeto ? 'critical_anchor_loss' : '',
            apsResult.inventedContentVeto ? 'invented_content' : '',
            apsResult.proseQualityVeto ? 'prose_quality' : '',
          ].filter(Boolean).join(', ')}`
        : `APS gate: score=${apsResult.score.toFixed(2)} verdict=${apsResult.verdict}`;

      console.warn("[optimise-prompt] APS gate rejected:", reason);

      if (apsResult.droppedAnchors.length > 0) {
        console.debug(
          "[optimise-prompt] Dropped anchors:",
          apsResult.droppedAnchors.map((a) => `${a.anchor} (${a.severity})`).join(", "),
        );
      }

      let fallback = sanitisedPrompt;
      const fallbackChanges = [
        reason,
        'Returned assembled prompt — the Algorithms declared the assembled prompt to also be the Optimised Prompt',
      ];

      if (groupCompliance) {
        const gateResult = groupCompliance(fallback);
        if (gateResult.wasFixed) {
          fallback = gateResult.text;
          fallbackChanges.push(...gateResult.fixes);
        }
      }

      result.optimised = fallback;
      result.charCount = fallback.length;
      result.changes = fallbackChanges;
    }

    // ── Layer 2: Regression guard (secondary safety net) ─────────────
    // Only runs if APS gate accepted — no double-fallback.
    if (apsResult.verdict === 'ACCEPT' || apsResult.verdict === 'ACCEPT_WITH_WARNING') {
      const regressionOpts = defaultRegressionOptions(
        parsed.data.providerContext.tier,
        call3Mode,
        parsed.data.providerContext.supportsWeighting ?? false,
      );
      const regressionCheck = checkRegression(
        sanitisedPrompt,
        result.optimised,
        regressionOpts,
      );

      if (!regressionCheck.passed) {
        console.warn(
          "[optimise-prompt] Regression guard failed:",
          regressionCheck.regressions.join("; "),
        );

        // Fall back to assembled prompt — deterministic fixes only
        let fallback = sanitisedPrompt;
        const fallbackChanges = [
          `Regression guard: ${regressionCheck.regressions.join('; ')}`,
          'Returned assembled prompt — the Algorithms declared the assembled prompt to also be the Optimised Prompt',
        ];

        // Still run group compliance on the fallback (syntax cleanup)
        if (groupCompliance) {
          const gateResult = groupCompliance(fallback);
          if (gateResult.wasFixed) {
            fallback = gateResult.text;
            fallbackChanges.push(...gateResult.fixes);
          }
        }

        result.optimised = fallback;
        result.charCount = fallback.length;
        result.changes = fallbackChanges;
      }

      // ── Prose quality diagnostics (always log, pass or fail) ──────────
      const pq = regressionCheck.proseQuality;
      if (pq.findings.length > 0) {
        console.debug(
          `[optimise-prompt] Prose quality: composition=${pq.compositionHardFail ? 'HARD_FAIL' : pq.findings.filter(f => f.detector === 'composition').length + ' findings'} textbook=${pq.textbookScore}pts redundant=${pq.redundantCount} passed=${regressionCheck.passed}`,
        );
      }

      // ── APS warning diagnostics (accepted but with concerns) ──────────
      if (apsResult.verdict === 'ACCEPT_WITH_WARNING') {
        console.debug(
          `[optimise-prompt] APS accepted with warning: score=${apsResult.score.toFixed(2)}, ` +
          `dropped=${apsResult.droppedAnchors.map((a) => a.anchor).join(', ')}`,
        );
      }
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
