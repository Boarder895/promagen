import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import {
  deduplicateQualityTokens,
  demoteGenericQualityWeights,
  enforceSubjectHighestWeight,
  enforceT1Syntax,
  ensureT1QualitySuffix,
  normaliseT1Ordering,
  stripT1CameraJargon,
} from "@/lib/harmony-compliance";
import type { ComplianceContext } from "@/lib/harmony-compliance";
import { postProcessTiers } from "@/lib/harmony-post-processing";
import { normaliseTierBundle } from "@/lib/call-2-normalise-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ============================================================================
// REQUEST SCHEMA
// ============================================================================

const ProviderContextSchema = z.object({
  tier: z.number().int().min(1).max(4),
  name: z.string().max(100),
  promptStyle: z.string().max(50),
  sweetSpot: z.number().int().min(10).max(2000),
  tokenLimit: z.number().int().min(10).max(5000),
  qualityPrefix: z.array(z.string().max(50)).max(10).optional(),
  weightingSyntax: z.string().max(50).optional(),
  supportsWeighting: z.boolean().optional(),
  negativeSupport: z.enum(["separate", "inline", "none", "converted"]),
});

const RequestSchema = z.object({
  systemPrompt: z.string().min(1).max(50_000),
  userMessage: z.string().min(1).max(5_000),
  model: z.string().max(100).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxCompletionTokens: z.number().int().min(100).max(8000).optional(),
  providerContext: ProviderContextSchema.nullable().optional(),
});

// ============================================================================
// RESPONSE SCHEMA
// ============================================================================

const TierOutputSchema = z.object({
  positive: z.string().max(2000),
  negative: z.string().max(500),
  anatomy: z
    .array(
      z.object({
        text: z.string().max(500),
        category: z.enum([
          "subject",
          "action",
          "style",
          "environment",
          "composition",
          "camera",
          "lighting",
          "colour",
          "atmosphere",
          "materials",
          "fidelity",
          "negative",
          "structural",
        ]),
        source: z.enum([
          "human",
          "user_addition",
          "generated_negative",
          "structural",
        ]),
        locked: z.boolean(),
      }),
    )
    .max(50)
    .optional(),
});

const GptResponseSchema = z.object({
  tier1: TierOutputSchema,
  tier3: TierOutputSchema,
  tier4: TierOutputSchema,
});

interface TierBundle {
  tier1: z.infer<typeof TierOutputSchema>;
  tier2: z.infer<typeof TierOutputSchema>;
  tier3: z.infer<typeof TierOutputSchema>;
  tier4: z.infer<typeof TierOutputSchema>;
}

// ============================================================================
// PRODUCTION DEFAULTS
// ============================================================================

const PROD_MODEL = "gpt-5.4-mini";
const PROD_TEMPERATURE = 0.5;
const PROD_MAX_COMPLETION_TOKENS = 2000;

// ============================================================================
// AUTH GUARD
// ============================================================================

const AUTH_BUFFER_LEN = 64;

function authHeaderMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;

  const a = Buffer.alloc(AUTH_BUFFER_LEN, 0);
  const b = Buffer.alloc(AUTH_BUFFER_LEN, 0);
  Buffer.from(provided).copy(a, 0, 0, AUTH_BUFFER_LEN);
  Buffer.from(expected).copy(b, 0, 0, AUTH_BUFFER_LEN);

  if (provided.length !== expected.length) return false;

  return timingSafeEqual(a, b);
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(req: NextRequest): Promise<Response> {
  if (env.isProd) {
    return new NextResponse(null, { status: 404 });
  }

  const expectedAuth = env.call2HarnessDevAuth;
  if (!expectedAuth || expectedAuth.length < 16) {
    return new NextResponse(null, { status: 404 });
  }

  const providedAuth = req.headers.get("x-dev-auth");
  if (!authHeaderMatches(providedAuth, expectedAuth)) {
    return new NextResponse(null, { status: 404 });
  }

  const rl = rateLimit(req, {
    keyPrefix: "dev-generate-tier-prompts",
    windowSeconds: 60,
    max: 60,
    keyParts: ["POST", "/api/dev/generate-tier-prompts"],
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Harness rate limit reached." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  const apiKey = env.providers.openAiApiKey;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "CONFIG_ERROR",
        message:
          "OpenAI API key not configured. Set OPENAI_API_KEY in .env.local.",
      },
      { status: 500 },
    );
  }

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
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: msg },
      { status: 400 },
    );
  }

  const sanitisedUserMessage = parsed.data.userMessage
    .replace(/<[^>]*>/g, "")
    .trim();

  if (!sanitisedUserMessage) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: "userMessage cannot be empty after sanitisation.",
      },
      { status: 400 },
    );
  }

  const model = parsed.data.model ?? PROD_MODEL;
  const temperature = parsed.data.temperature ?? PROD_TEMPERATURE;
  const maxCompletionTokens =
    parsed.data.maxCompletionTokens ?? PROD_MAX_COMPLETION_TOKENS;
  const providerContext = parsed.data.providerContext ?? null;

  const startMs = Date.now();
  let openaiData: unknown;

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
          model,
          temperature,
          max_completion_tokens: maxCompletionTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: parsed.data.systemPrompt },
            { role: "user", content: sanitisedUserMessage },
          ],
        }),
      },
    );

    if (!openaiRes.ok) {
      let errBody: unknown = null;
      try {
        errBody = await openaiRes.json();
      } catch {
        // ignore parse failure
      }
      return NextResponse.json(
        {
          error: "OPENAI_ERROR",
          status: openaiRes.status,
          openaiError: errBody,
        },
        { status: 502 },
      );
    }

    openaiData = await openaiRes.json();
  } catch (err) {
    return NextResponse.json(
      {
        error: "OPENAI_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Unknown fetch error",
      },
      { status: 502 },
    );
  }

  const latencyMs = Date.now() - startMs;

  const data = openaiData as Record<string, unknown>;
  const choices = data?.choices as Array<Record<string, unknown>> | undefined;
  const firstChoice = choices?.[0];
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const content = message?.content;

  if (firstChoice?.finish_reason === "content_filter") {
    return NextResponse.json(
      {
        error: "CONTENT_POLICY",
        message: "Content filter triggered by engine.",
      },
      { status: 400 },
    );
  }

  if (typeof content !== "string" || !content) {
    return NextResponse.json(
      { error: "EMPTY_RESPONSE", message: "Engine returned no content." },
      { status: 502 },
    );
  }

  const usage = (data?.usage ?? {}) as Record<string, unknown>;
  const promptTokens =
    typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : null;
  const completionTokens =
    typeof usage.completion_tokens === "number"
      ? usage.completion_tokens
      : null;
  const modelVersion = typeof data?.model === "string" ? data.model : model;

  // ── STAGE A — raw model output ────────────────────────────────────────
  let stageARaw: unknown;
  try {
    stageARaw = JSON.parse(content);
  } catch {
    return NextResponse.json(
      {
        error: "PARSE_ERROR",
        message: "Engine returned invalid JSON.",
        rawContent: content,
      },
      { status: 502 },
    );
  }

  const normalised = normaliseTierBundle(stageARaw);
  const schemaNormalised = normalised.wasRepaired;

  const stageAValidated = GptResponseSchema.safeParse(normalised.data);
  if (!stageAValidated.success) {
    return NextResponse.json(
      {
        error: "SCHEMA_ERROR",
        message: "Engine response did not match TierBundle schema.",
        issues: stageAValidated.error.issues,
        rawContent: stageARaw,
      },
      { status: 502 },
    );
  }

  const stageA: TierBundle = {
    ...stageAValidated.data,
    tier2: { positive: "", negative: "" },
  };

  // ── STAGE B — post-processing ────────────────────────────────────────
  const stageB: TierBundle = postProcessTiers(stageA, sanitisedUserMessage);

  // ── STAGE C — compliance enforcement + full T1 enforcement chain ────
  let stageC: TierBundle = stageB;

  if (providerContext) {
    const compCtx: ComplianceContext = {
      weightingSyntax: providerContext.weightingSyntax,
      supportsWeighting: providerContext.supportsWeighting ?? false,
      providerName: providerContext.name,
      tier: providerContext.tier,
    };

    const t1SyntaxResult = enforceT1Syntax(stageC.tier1.positive, compCtx);
    if (t1SyntaxResult.wasFixed) {
      stageC = {
        ...stageC,
        tier1: { ...stageC.tier1, positive: t1SyntaxResult.text },
      };
    }
  }

  const t1Passes = [
    stripT1CameraJargon,
    enforceSubjectHighestWeight,
    demoteGenericQualityWeights,
    deduplicateQualityTokens,
    ensureT1QualitySuffix,
    normaliseT1Ordering,
  ] as const;

  let stageCT1Text = stageC.tier1.positive;
  const stageCT1Fixes: string[] = [];

  for (const pass of t1Passes) {
    const result = pass(stageCT1Text);
    if (result.wasFixed) {
      stageCT1Text = result.text;
      stageCT1Fixes.push(...result.fixes);
    }
  }

  if (stageCT1Fixes.length > 0) {
    stageC = {
      ...stageC,
      tier1: { ...stageC.tier1, positive: stageCT1Text },
    };
  }

  // ── STAGE D — final returned production-equivalent shape ────────────
  const stageD: TierBundle = stageC;

  return NextResponse.json(
    {
      stage_a_raw_model: stageA,
      stage_b_post_processed: stageB,
      stage_c_compliance_enforced: stageC,
      stage_d_final: stageD,
      metadata: {
        model_version: modelVersion,
        latency_ms: latencyMs,
        tokens_used: {
          prompt: promptTokens,
          completion: completionTokens,
        },
        stages_applied: ["a", "b", "c", "d"] as const,
        provider_context_present: providerContext !== null,
        schema_normalised: schemaNormalised,
        schema_repairs: schemaNormalised ? normalised.repairs : [],
        t1_code_enforcement_fixes: stageCT1Fixes,
        opening_freshness_fixes: [] as string[],
      },
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}