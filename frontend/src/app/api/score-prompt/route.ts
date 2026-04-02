// src/app/api/score-prompt/route.ts
// ============================================================================
// POST /api/score-prompt — AI Prompt Scoring (Call 4)
// ============================================================================
// Scores an optimised prompt against 5 axes and returns 2-3 actionable
// improvement directives. Does NOT rewrite the prompt — tells the user
// what to fix. Auto-fires after Call 3 for Pro users.
//
// Authority: docs/authority/call4-chatgpt-review-v4.md
// Pattern: matches /api/optimise-prompt (same rate-limit, env, Zod, error handling)
// Scope: Prompt Lab (/studio/playground) ONLY — Pro Promagen feature
// Existing features preserved: Yes (new file, no modifications).
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
// REQUEST SCHEMA — Strict types matching SSOT
// ============================================================================

const ScoreRequestSchema = z.object({
  // Core prompt data
  optimisedPrompt: z.string().min(1),
  humanText: z.string().min(1),
  assembledPrompt: z.string().min(1),
  negativePrompt: z.string().optional(),

  // Platform context (from platform-config.json SSOT)
  platformId: z.string().min(1),
  platformName: z.string().min(1),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  promptStyle: z.enum(['keywords', 'natural']),
  maxChars: z.number().positive(),
  idealMin: z.number().nonnegative(),
  idealMax: z.number().positive(),
  negativeSupport: z.enum(['separate', 'inline', 'none']),

  // Call 3 output context
  call3Changes: z.array(z.string()),
  call3Mode: z.enum([
    'reorder_only',
    'format_only',
    'gpt_rewrite',
    'pass_through',
    'mj_deterministic',
  ]),

  // Call 1 category richness — 12 known scoring categories
  categoryRichness: z.object({
    subject: z.number().optional(),
    action: z.number().optional(),
    style: z.number().optional(),
    environment: z.number().optional(),
    composition: z.number().optional(),
    camera: z.number().optional(),
    lighting: z.number().optional(),
    colour: z.number().optional(),
    atmosphere: z.number().optional(),
    materials: z.number().optional(),
    fidelity: z.number().optional(),
    negative: z.number().optional(),
  }),
});

// ============================================================================
// RESPONSE SCHEMA
// ============================================================================

const ScoreResponseSchema = z.object({
  axes: z.object({
    anchorPreservation: z.number().min(0).max(30),
    platformFit: z.number().min(0).max(25),
    visualSpecificity: z.number().min(0).max(20),
    economyClarity: z.number().min(0).max(15),
    negativeQuality: z.number().min(0).max(10).nullable(),
  }),
  directives: z.array(z.string()).min(1).max(4),
  summary: z.string().min(1),
});

// ============================================================================
// SYSTEM PROMPT — Scoring rubric with tier-adjusted rules
// ============================================================================

function buildSystemPrompt(req: z.infer<typeof ScoreRequestSchema>): string {
  const negApplicable = req.negativeSupport !== 'none';
  const tierDesc =
    req.tier === 1
      ? 'CLIP-weighted (syntax-heavy: parenthesised weights, comma-separated tags)'
      : req.tier === 2
        ? 'Midjourney-native (syntax-heavy: ::weight notation, -- parameters)'
        : req.tier === 3
          ? 'Natural language (style/clarity-heavy: scene-description prose, no syntax tokens)'
          : 'Plain language (readability-heavy: simple, direct, no jargon)';

  const richCategories = Object.entries(req.categoryRichness)
    .filter(([, v]) => v && v > 0)
    .map(([k, v]) => `${k}: ${v} terms`)
    .join(', ');

  return `You are a prompt quality scorer for AI image generation platforms.

TASK: Score the optimised prompt against 5 axes. Return JSON only.

PLATFORM CONTEXT:
- Platform: ${req.platformName} (${req.platformId})
- Tier: T${req.tier} — ${tierDesc}
- Prompt style: ${req.promptStyle}
- Character limits: idealMin=${req.idealMin}, idealMax=${req.idealMax}, maxChars=${req.maxChars}
- Negative support: ${req.negativeSupport}
- Call 3 mode: ${req.call3Mode}
- Call 3 changes: ${req.call3Changes.length > 0 ? req.call3Changes.join('; ') : 'none'}

USER'S ORIGINAL INPUT:
"${req.humanText}"

Category richness from analysis: ${richCategories || 'none detected'}

ASSEMBLED PROMPT (pre-optimisation):
"${req.assembledPrompt}"

OPTIMISED PROMPT (to score):
"${req.optimisedPrompt}"
${req.negativePrompt ? `\nNEGATIVE PROMPT:\n"${req.negativePrompt}"` : ''}

SCORING RUBRIC (score each axis independently):

1. ANCHOR PRESERVATION (0-30 points)
Compare the user's original input → assembled → optimised.
Are the user's key visual anchors STILL PRESENT in the optimised prompt?
- 30: All original anchors preserved exactly
- 20-29: Most anchors preserved, minor rephrasing
- 10-19: Some anchors dropped or significantly altered
- 0-9: Most anchors lost or unrecognisable
Use the category richness to weight importance — if the user invested 3 terms in lighting, losing 2 of them is a bigger penalty.

2. PLATFORM-NATIVE FIT (0-25 points)
${req.tier <= 2
    ? `This is T${req.tier} (${req.promptStyle}) — SYNTAX matters.
- 25: Perfect syntax for this platform (correct weights, parameters, formatting)
- 15-24: Mostly correct syntax, minor issues
- 5-14: Significant syntax errors that would degrade output
- 0-4: Wrong syntax entirely (e.g., natural language on a CLIP platform)`
    : `This is T${req.tier} (${req.promptStyle}) — STYLE and CLARITY matter, not syntax.
- 25: Natural, clear scene description. No syntax tokens. Reads like a well-written brief.
- 15-24: Mostly natural, minor awkwardness or stray tokens
- 5-14: Stilted, overly technical, or contains syntax tokens that confuse this platform
- 0-4: Wrong style entirely (e.g., weight syntax on a natural language platform)`}

3. VISUAL SPECIFICITY (0-20 points)
Count concrete visual anchors: materials, colours, light directions, spatial relationships, textures, atmospheric effects.
- 20: Rich, concrete imagery throughout
- 10-19: Good specificity with some vague areas
- 5-9: Mostly vague or generic descriptions
- 0-4: Almost no concrete visual detail

4. ECONOMY & CLARITY (0-15 points)
Judge against idealMin=${req.idealMin}, idealMax=${req.idealMax}, maxChars=${req.maxChars}.
- 15: Every word earns its place, within sweet spot
- 10-14: Tight with minor redundancy
- 5-9: Noticeable waste (duplicated modifiers, filler words)
- 0-4: Bloated or chaotic

5. NEGATIVE QUALITY (0-10 points)${negApplicable
    ? `
Score the quality of exclusions.
- 10: Specific, platform-relevant exclusions (e.g., "chromatic aberration, motion blur")
- 5-9: Mix of specific and generic
- 1-4: Mostly generic ("ugly, bad, deformed")
- 0: No negative provided when platform supports it, or negatives contradict positive prompt`
    : `
This platform does not support negatives. Return null for this axis.`}

DIRECTIVES RULES:
- Return exactly 2-3 improvement directives
- Each directive MUST reference a specific phrase from the prompt (Ctrl+F-able)
- Phrase-level references only — NEVER word positions
- Each directive must be actionable — the user should know exactly what to change
- Bad: "Make it more descriptive" — REJECTED
- Good: "Front-load 'lighthouse keeper' before the atmosphere clause for stronger attention"

RESPONSE FORMAT (JSON only, no markdown):
{
  "axes": {
    "anchorPreservation": <0-30>,
    "platformFit": <0-25>,
    "visualSpecificity": <0-20>,
    "economyClarity": <0-15>,
    "negativeQuality": <0-10 or null>
  },
  "directives": ["<directive 1>", "<directive 2>"],
  "summary": "<one sentence overall assessment>"
}`;
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  // ── Rate limit (30/hour in prod) ─────────────────────────────────
  const rl = rateLimit(req, {
    keyPrefix: 'score-prompt',
    windowSeconds: 3600,
    max: env.isProd ? 30 : 200,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many score requests. Try again later.', retryAfterSeconds: rl.retryAfterSeconds },
      { status: 429 },
    );
  }

  // ── Parse & validate request ─────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ScoreRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // ── API key check ────────────────────────────────────────────────
  const apiKey = env.providers.openAiApiKey;
  if (!apiKey) {
    console.error('[score-prompt] OPENAI_API_KEY not configured');
    return NextResponse.json({ error: 'Scoring engine not configured' }, { status: 503 });
  }

  // ── Build system prompt ──────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(parsed.data);

  // ── Call GPT ─────────────────────────────────────────────────────
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
          model: 'gpt-5.4-mini',
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Score this prompt.' },
          ],
        }),
      },
    );

    if (!openaiRes.ok) {
      const errText = await openaiRes.text().catch(() => 'Unknown error');
      console.error(`[score-prompt] OpenAI ${openaiRes.status}:`, errText);
      return NextResponse.json(
        { error: 'Scoring engine error' },
        { status: openaiRes.status >= 500 ? 502 : openaiRes.status },
      );
    }

    const openaiData = await openaiRes.json();
    const content = openaiData?.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[score-prompt] Empty engine response:', openaiData);
      return NextResponse.json({ error: 'Empty scoring response' }, { status: 502 });
    }

    // ── Parse & validate response ────────────────────────────────
    let rawScore: unknown;
    try {
      rawScore = JSON.parse(content);
    } catch {
      console.error('[score-prompt] Failed to parse response JSON:', content);
      return NextResponse.json({ error: 'Invalid scoring response format' }, { status: 502 });
    }

    const validated = ScoreResponseSchema.safeParse(rawScore);
    if (!validated.success) {
      console.error('[score-prompt] Response validation failed:', validated.error.flatten());
      return NextResponse.json({ error: 'Scoring response did not match expected schema' }, { status: 502 });
    }

    // ── Compute normalised headline score ────────────────────────
    const { axes, directives, summary } = validated.data;
    const rawTotal =
      axes.anchorPreservation +
      axes.platformFit +
      axes.visualSpecificity +
      axes.economyClarity +
      (axes.negativeQuality ?? 0);

    const maxPossible = axes.negativeQuality !== null ? 100 : 90;
    const score = Math.round((rawTotal / maxPossible) * 100);

    return NextResponse.json({
      score: Math.min(100, Math.max(0, score)),
      axes,
      directives,
      summary,
    });
  } catch (err) {
    console.error('[score-prompt] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal scoring error' }, { status: 500 });
  }
}
