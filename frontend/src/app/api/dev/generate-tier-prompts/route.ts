// src/app/api/dev/generate-tier-prompts/route.ts
// ============================================================================
// POST /api/dev/generate-tier-prompts — Call 2 Quality Harness dev endpoint
// ============================================================================
// Mirrors the production Call 2 pipeline at /api/generate-tier-prompts but
// returns ALL FOUR route stages as separate fields so the harness can see
// what the model produced BEFORE post-processing and compliance rescued it.
//
// This is the foundational observation point for the entire harness. Without
// it, there is no way to distinguish "the model got it right" from "cleanup
// rescued the model". Rescue dependency, mutation testing, and the failure-
// mode inventory all depend on this endpoint.
//
// The production route at /api/generate-tier-prompts is NEVER MODIFIED.
// This endpoint imports the same harmony modules production uses, so the
// final stage (D) is byte-identical to what production would return for
// the same input.
//
// ── SAFETY GATES ────────────────────────────────────────────────────────────
// 1. Returns 404 in Production environment regardless of any header.
// 2. Returns 404 if CALL2_HARNESS_DEV_AUTH env var is unset.
// 3. Returns 404 if X-Dev-Auth header is missing or wrong (404 not 401 — does
//    not announce its existence to a probe).
// 4. Rate-limited (generous limit, dev-only traffic shape).
//
// ── PIPELINE STAGES ─────────────────────────────────────────────────────────
// Stage A — raw model output, parsed JSON only, no post-processing
// Stage B — Stage A + postProcessTiers() (T2 negative dedup, T4 cleanups)
// Stage C — Stage B + enforceT1Syntax() (if providerContext) + enforceMjParameters()
// Stage D — final shape ready to return (currently == Stage C; reserved as a
//           separate field so future compliance gates can be inserted between
//           C and D without changing the response shape)
//
// Authority: call-2-harness-build-plan-v1.md Phase A,
//            call-2-quality-architecture-v0.3.1.md §3, §11, §13
// ============================================================================

import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import {
  // Phase B: enforceMjParameters removed — T2 no longer generated
  enforceT1Syntax,
} from '@/lib/harmony-compliance';
import type { ComplianceContext } from '@/lib/harmony-compliance';
import { postProcessTiers } from '@/lib/harmony-post-processing';
import { normaliseTierBundle } from '@/lib/call-2-normalise-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ============================================================================
// REQUEST SCHEMA
// ============================================================================

// Mirror of the production ProviderContextSchema. Kept locally so the dev
// endpoint never needs to import from the production route file (which
// would create a coupling we explicitly want to avoid).
const ProviderContextSchema = z.object({
  tier: z.number().int().min(1).max(4),
  name: z.string().max(100),
  promptStyle: z.string().max(50),
  sweetSpot: z.number().int().min(10).max(2000),
  tokenLimit: z.number().int().min(10).max(5000),
  qualityPrefix: z.array(z.string().max(50)).max(10).optional(),
  weightingSyntax: z.string().max(50).optional(),
  supportsWeighting: z.boolean().optional(),
  negativeSupport: z.enum(['separate', 'inline', 'none', 'converted']),
});

const RequestSchema = z.object({
  /**
   * The full Call 2 system prompt as a string. The harness builds this itself
   * (or, for mutation testing, deliberately mutates it) and passes it in.
   * The dev endpoint does NOT call buildSystemPrompt() — that function is
   * private to the production route and we never touch the production route.
   */
  systemPrompt: z.string().min(1).max(50_000),

  /**
   * The user message — typically a scene input (e.g. the lighthouse keeper).
   * Sanitised the same way the production route sanitises sentences.
   */
  userMessage: z.string().min(1).max(5_000),

  /**
   * Optional model override. Defaults to the production model.
   * Allowed values are restricted to the family in current use.
   */
  model: z.string().max(100).optional(),

  /**
   * Optional sampling overrides. Default to production values.
   */
  temperature: z.number().min(0).max(2).optional(),
  maxCompletionTokens: z.number().int().min(100).max(8000).optional(),

  /**
   * Optional provider context — drives the compliance gate (Stage C).
   * Without it, Stage C skips enforceT1Syntax() (production also skips it without provider).
   */
  providerContext: ProviderContextSchema.nullable().optional(),
});

// ============================================================================
// RESPONSE SCHEMA (matches production TierPrompts shape)
// ============================================================================

const TierOutputSchema = z.object({
  positive: z.string().max(2000),
  negative: z.string().max(500),
  anatomy: z.array(z.object({
    text: z.string().max(500),
    category: z.enum([
      'subject', 'action', 'style', 'environment', 'composition', 'camera',
      'lighting', 'colour', 'atmosphere', 'materials', 'fidelity', 'negative', 'structural',
    ]),
    source: z.enum(['human', 'user_addition', 'generated_negative', 'structural']),
    locked: z.boolean(),
  })).max(50).optional(),
});

/** GPT returns 3 tiers (Phase B: T2 removed). */
const GptResponseSchema = z.object({
  tier1: TierOutputSchema,
  tier3: TierOutputSchema,
  tier4: TierOutputSchema,
});

/** Full 4-tier bundle for the harness — tier2 injected as empty after validation. */
interface TierBundle {
  tier1: z.infer<typeof TierOutputSchema>;
  tier2: z.infer<typeof TierOutputSchema>;
  tier3: z.infer<typeof TierOutputSchema>;
  tier4: z.infer<typeof TierOutputSchema>;
}

// ============================================================================
// PRODUCTION DEFAULTS — kept in sync with /api/generate-tier-prompts
// ============================================================================
//
// If production ever changes these, the harness must be updated too. The
// harness explicitly aims to match production byte-for-byte at Stage D.
//
const PROD_MODEL = 'gpt-5.4-mini';
const PROD_TEMPERATURE = 0.5;
const PROD_MAX_COMPLETION_TOKENS = 2000;

// ============================================================================
// AUTH GUARD
// ============================================================================
//
// timingSafeEqual prevents an attacker from inferring the secret a character
// at a time via response-time differences. Both buffers must be the same
// length, so we always pad to a fixed size before comparing.
//
const AUTH_BUFFER_LEN = 64;

function authHeaderMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;

  const a = Buffer.alloc(AUTH_BUFFER_LEN, 0);
  const b = Buffer.alloc(AUTH_BUFFER_LEN, 0);
  Buffer.from(provided).copy(a, 0, 0, AUTH_BUFFER_LEN);
  Buffer.from(expected).copy(b, 0, 0, AUTH_BUFFER_LEN);

  // Also enforce equal real lengths — timingSafeEqual on padded buffers alone
  // would let a short prefix that happens to match leak through.
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(a, b);
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(req: NextRequest): Promise<Response> {
  // ── Gate 1: Production environment — always 404 ───────────────────────────
  // Belt: this gate.
  // Braces: the env var should not be set in Production env on Vercel anyway.
  if (env.isProd) {
    return new NextResponse(null, { status: 404 });
  }

  // ── Gate 2: Auth secret must be configured ────────────────────────────────
  const expectedAuth = env.call2HarnessDevAuth;
  if (!expectedAuth || expectedAuth.length < 16) {
    // No secret configured = endpoint disabled. 404, not 500.
    return new NextResponse(null, { status: 404 });
  }

  // ── Gate 3: X-Dev-Auth header must match (timing-safe) ────────────────────
  const providedAuth = req.headers.get('x-dev-auth');
  if (!authHeaderMatches(providedAuth, expectedAuth)) {
    return new NextResponse(null, { status: 404 });
  }

  // ── Gate 4: Rate limit (generous; this is dev-only traffic) ───────────────
  const rl = rateLimit(req, {
    keyPrefix: 'dev-generate-tier-prompts',
    windowSeconds: 60,
    max: 60,
    keyParts: ['POST', '/api/dev/generate-tier-prompts'],
  });

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Harness rate limit reached.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSeconds) },
      },
    );
  }

  // ── OpenAI key check ──────────────────────────────────────────────────────
  const apiKey = env.providers.openAiApiKey;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'CONFIG_ERROR',
        message: 'OpenAI API key not configured. Set OPENAI_API_KEY in .env.local.',
      },
      { status: 500 },
    );
  }

  // ── Parse and validate request body ───────────────────────────────────────
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
    const msg = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: msg },
      { status: 400 },
    );
  }

  // Sanitise the user message identically to production. Production strips
  // HTML-like tags from `sentence`. We do the same to userMessage.
  const sanitisedUserMessage = parsed.data.userMessage
    .replace(/<[^>]*>/g, '')
    .trim();

  if (!sanitisedUserMessage) {
    return NextResponse.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'userMessage cannot be empty after sanitisation.',
      },
      { status: 400 },
    );
  }

  const model = parsed.data.model ?? PROD_MODEL;
  const temperature = parsed.data.temperature ?? PROD_TEMPERATURE;
  const maxCompletionTokens =
    parsed.data.maxCompletionTokens ?? PROD_MAX_COMPLETION_TOKENS;
  const providerContext = parsed.data.providerContext ?? null;

  // ── Call OpenAI (same shape as production) ────────────────────────────────
  const startMs = Date.now();
  let openaiData: unknown;

  try {
    const openaiRes = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          max_completion_tokens: maxCompletionTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: parsed.data.systemPrompt },
            { role: 'user', content: sanitisedUserMessage },
          ],
        }),
      },
    );

    if (!openaiRes.ok) {
      let errBody: unknown = null;
      try {
        errBody = await openaiRes.json();
      } catch {
        // Can't parse error body — leave as null
      }
      return NextResponse.json(
        {
          error: 'OPENAI_ERROR',
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
        error: 'OPENAI_FETCH_FAILED',
        message: err instanceof Error ? err.message : 'Unknown fetch error',
      },
      { status: 502 },
    );
  }

  const latencyMs = Date.now() - startMs;

  // ── Extract content + token usage ─────────────────────────────────────────
  const data = openaiData as Record<string, unknown>;
  const choices = data?.choices as Array<Record<string, unknown>> | undefined;
  const firstChoice = choices?.[0];
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const content = message?.content;

  if (firstChoice?.finish_reason === 'content_filter') {
    return NextResponse.json(
      { error: 'CONTENT_POLICY', message: 'Content filter triggered by engine.' },
      { status: 400 },
    );
  }

  if (typeof content !== 'string' || !content) {
    return NextResponse.json(
      { error: 'EMPTY_RESPONSE', message: 'Engine returned no content.' },
      { status: 502 },
    );
  }

  const usage = (data?.usage ?? {}) as Record<string, unknown>;
  const promptTokens =
    typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : null;
  const completionTokens =
    typeof usage.completion_tokens === 'number'
      ? usage.completion_tokens
      : null;
  const modelVersion = typeof data?.model === 'string' ? data.model : model;

  // ── STAGE A — raw model output (parsed JSON, no cleanup) ──────────────────
  let stageARaw: unknown;
  try {
    stageARaw = JSON.parse(content);
  } catch {
    return NextResponse.json(
      {
        error: 'PARSE_ERROR',
        message: 'Engine returned invalid JSON.',
        rawContent: content,
      },
      { status: 502 },
    );
  }

  // ── Schema repair: wrap flat-string tiers into { positive, negative } ────
  // Without this, flat-string responses are dead 502s — no scoring at all.
  // With this, they become scoreable Stage A samples. The metadata flag
  // `schema_normalised` tells the harness that repair intervened.
  const normalised = normaliseTierBundle(stageARaw);
  const schemaNormalised = normalised.wasRepaired;

  const stageAValidated = GptResponseSchema.safeParse(normalised.data);
  if (!stageAValidated.success) {
    return NextResponse.json(
      {
        error: 'SCHEMA_ERROR',
        message: 'Engine response did not match TierBundle schema.',
        issues: stageAValidated.error.issues,
        rawContent: stageARaw,
      },
      { status: 502 },
    );
  }
  // Phase B: GPT returns 3 tiers. Inject empty tier2 for full harness TierBundle.
  const stageA: TierBundle = {
    ...stageAValidated.data,
    tier2: { positive: '', negative: '' },
  };

  // ── STAGE B — post-processing ─────────────────────────────────────────────
  // postProcessTiers() is the SAME function production uses. Imported from
  // the SAME module. No reimplementation, no drift.
  const stageB: TierBundle = postProcessTiers(stageA);

  // ── STAGE C — compliance enforcement ──────────────────────────────────────
  // Phase B: only enforceT1Syntax() runs. enforceMjParameters() removed (T2 gone).
  let stageC: TierBundle = stageB;

  if (providerContext) {
    const compCtx: ComplianceContext = {
      weightingSyntax: providerContext.weightingSyntax,
      supportsWeighting: providerContext.supportsWeighting ?? false,
      providerName: providerContext.name,
      tier: providerContext.tier,
    };
    const t1Result = enforceT1Syntax(stageC.tier1.positive, compCtx);
    if (t1Result.wasFixed) {
      stageC = {
        ...stageC,
        tier1: { ...stageC.tier1, positive: t1Result.text },
      };
    }
  }

  // Phase B: enforceMjParameters() removed — T2 no longer generated by Call 2.
  // MJ compliance moves to Call T2 (Phase C).

  // ── STAGE D — final shape ─────────────────────────────────────────────────
  // Currently identical to Stage C, but kept as a separate field so future
  // compliance gates (e.g. enforceWeightCap, enforceNegativeContradiction)
  // can be inserted between C and D without changing the response shape.
  // The harness MUST treat D as "what production would return", not C.
  const stageD: TierBundle = stageC;

  // ── Return all four stages + metadata ─────────────────────────────────────
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
        stages_applied: ['a', 'b', 'c', 'd'] as const,
        provider_context_present: providerContext !== null,
        schema_normalised: schemaNormalised,
        schema_repairs: schemaNormalised ? normalised.repairs : [],
      },
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
