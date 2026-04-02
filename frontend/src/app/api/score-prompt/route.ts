// src/app/api/score-prompt/route.ts
// ============================================================================
// POST /api/score-prompt — AI Prompt Scoring (Call 4) v1.2.0
// ============================================================================
// Scores an optimised prompt against 5 axes and returns 0-3 actionable
// improvement directives. Does NOT rewrite the prompt — tells the user
// what to fix. Auto-fires after Call 3 for Pro users.
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
// Existing features preserved: Yes (route-only change).
// ============================================================================

import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

// ============================================================================
// REQUEST SCHEMA — Strict types + max-length guards
// ============================================================================
// Max lengths protect against inflated token cost from oversized payloads.
// Largest platform maxChars is 1250, so 2000 gives generous headroom.

const ScoreRequestSchema = z.object({
  // Core prompt data — bounded to prevent cost inflation
  optimisedPrompt: z.string().min(1).max(2000),
  humanText: z.string().min(1).max(1000),
  assembledPrompt: z.string().min(1).max(2000),
  negativePrompt: z.string().max(500).optional(),

  // Platform context (from platform-config.json SSOT)
  platformId: z.string().min(1).max(50),
  platformName: z.string().min(1).max(100),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  promptStyle: z.enum(['keywords', 'natural']),
  maxChars: z.number().positive().max(10000),
  idealMin: z.number().nonnegative().max(10000),
  idealMax: z.number().positive().max(10000),
  negativeSupport: z.enum(['separate', 'inline', 'none']),

  // Call 3 output context
  call3Changes: z.array(z.string().max(200)).max(10),
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
  directives: z.array(z.string()).min(0).max(3),
  summary: z.string().min(1),
});

// ============================================================================
// CEILING CLAMPS — Deterministic safety net (tightened v1.2.0)
// ============================================================================
// Tighter than v1.1.0: a prompt with directives is not near-perfect.
// These are hard ceilings — GPT can score lower, never higher.

function applyDirectiveCeilingClamp(rawScore: number, directiveCount: number): number {
  // 3 directives = significant headroom → ceiling 85
  if (directiveCount >= 3 && rawScore > 85) return 85;
  // 2 directives = meaningful improvement possible → ceiling 89
  if (directiveCount === 2 && rawScore > 89) return 89;
  // 1 directive = strong but not near-perfect → ceiling 93
  if (directiveCount === 1 && rawScore > 93) return 93;
  // 0 directives = genuinely near-flawless → ceiling 97
  if (directiveCount === 0 && rawScore > 97) return 97;
  return rawScore;
}

// ============================================================================
// CALIBRATION EXAMPLES — One per tier family
// ============================================================================
// Real prompts with honest scores. Anchors GPT's understanding of the scale.
// A polished benchmark prompt with improvements typically lands 75-85.

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
Why this score: Good CLIP weight syntax and anchor preservation, but the negative prompt is generic boilerplate (3/10) and 'autumn scene' is vague where the user specified concrete seasonal detail. The weight values are reasonable but 'cinematic composition' and '8k uhd' are filler tokens that waste budget.

EXAMPLE 2 — T2 Midjourney platform, negativeSupport: inline
Human input: "A cyberpunk courier on a motorcycle weaving through neon-lit rain"
Optimised prompt: "cyberpunk courier on motorcycle::2 weaving through neon-lit rain::1.5 reflections on wet asphalt::1 --ar 16:9 --v 6 --style raw"
Expected score: 80
Expected axes: { anchorPreservation: 26, platformFit: 22, visualSpecificity: 14, economyClarity: 12, negativeQuality: null }
Expected directives (2):
- "Add material texture to 'motorcycle' — specify chrome, matte black, carbon fibre to give the renderer concrete surface data"
- "The atmosphere clause is implicit in 'neon-lit rain' but lacks colour specificity — add explicit neon colours like 'magenta and cyan neon reflections' to anchor the palette"
Why this score: Correct MJ syntax with appropriate weight hierarchy, all user anchors preserved. Loses points on visual specificity — 'motorcycle' and 'neon-lit rain' could carry much more concrete detail. Economy is good but not tight.

EXAMPLE 3 — T3 Natural Language platform (DALL-E 3), negativeSupport: none
Human input: "A weathered lighthouse keeper standing on a rain-lashed gallery deck watching a storm"
Optimised prompt: "A weathered lighthouse keeper grips the iron railing of a rain-lashed gallery deck, staring into enormous storm waves crashing against jagged rocks below. Salt spray rises into a purple and copper twilight while the lighthouse beam cuts a pale gold arc through sheets of driving rain. A distant fishing village glows with warm amber windows against dark cliffs, all with the crisp contrast of a cinematic seascape painting."
Expected score: 83
Expected axes: { anchorPreservation: 27, platformFit: 23, visualSpecificity: 16, economyClarity: 10, negativeQuality: null }
Expected directives (2):
- "Front-load 'lighthouse keeper' before the atmosphere clause — the subject should anchor attention at the start, not compete with environmental detail"
- "'crisp contrast of a cinematic seascape painting' is a style instruction, not a visual anchor — replace with a concrete material or texture detail like 'oil-slick puddles on the gallery deck reflecting the beam'"
Why this score: Strong natural language prose, most anchors preserved with enrichment. The subject gets slightly buried under atmosphere, and the style tag at the end is abstract rather than visual. Economy could be tighter — 'enormous' and 'sheets of' are filler.

EXAMPLE 4 — T4 Plain Language platform (Canva), negativeSupport: none
Human input: "A cosy bookshop with a cat sleeping in the window on a rainy afternoon"
Optimised prompt: "A cosy independent bookshop interior with warm golden lighting. A tabby cat sleeps curled on a velvet window cushion. Rain streaks down the glass pane outside. Stacked books and a steaming mug of tea sit on the wooden sill beside the cat. Soft afternoon light filters through the raindrops."
Expected score: 78
Expected axes: { anchorPreservation: 25, platformFit: 20, visualSpecificity: 15, economyClarity: 11, negativeQuality: null }
Expected directives (2):
- "Remove 'independent' from 'cosy independent bookshop' — it adds no visual information and wastes tokens on a plain-language platform where brevity matters"
- "'Soft afternoon light filters through the raindrops' overlaps with 'rain streaks down the glass pane' — merge into one sentence to avoid redundant atmosphere"
Why this score: Good plain-language readability with no jargon, all user anchors present. Loses points because 'independent' is semantically empty for image generation, and there is visible redundancy between the last two sentences. The visual specificity is decent but 'warm golden lighting' could be more concrete (e.g. 'a brass desk lamp casting warm light').
`;

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

  return `You are a strict, conservative prompt quality scorer for AI image generation platforms. You are deliberately harsh. Your default assumption is that every prompt has room to improve — most prompts land in the 70-85 range.

CRITICAL SCORING PHILOSOPHY:
- A score of 90+ is EXCEPTIONAL and rare. It means the prompt is nearly flawless.
- A score of 80-89 is STRONG. This is where most well-crafted prompts belong.
- A score of 70-79 is GOOD. Solid work with clear room for improvement.
- A score below 70 means significant problems.
- You should almost never score above 90. If you find yourself doing so, look harder for flaws.

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

SCORING RUBRIC (score each axis independently — be harsh, not generous):

1. ANCHOR PRESERVATION (0-30 points)
Compare the user's original input → assembled → optimised.
Are the user's key visual anchors STILL PRESENT in the optimised prompt?
- 28-30: Every single user anchor preserved with zero loss — rare, requires exact match
- 24-27: All anchors present, minor rephrasing that preserves meaning
- 18-23: Most anchors present but some rephrased loosely or reordered poorly
- 10-17: Noticeable anchor loss — user's specific details dropped or generalised
- 0-9: Most anchors lost or unrecognisable
Use the category richness to weight importance — if the user invested 3 terms in lighting, losing 2 of them is a bigger penalty.
Scoring 28+ requires that EVERY specific noun, colour, material, and spatial relationship from the user's input survives intact. This is rare.

2. PLATFORM-NATIVE FIT (0-25 points)
${req.tier <= 2
    ? `This is T${req.tier} (${req.promptStyle}) — SYNTAX matters.
- 24-25: Perfect syntax for this platform — every weight, parameter, and separator correct. Rare.
- 18-23: Correct syntax structure with minor weight value issues
- 12-17: Mostly correct but with syntax errors that would visibly degrade output
- 5-11: Significant syntax errors or wrong formatting approach
- 0-4: Wrong syntax entirely (e.g., natural language on a CLIP platform)`
    : `This is T${req.tier} (${req.promptStyle}) — STYLE and CLARITY matter, not syntax.
- 24-25: Flawless natural prose — zero syntax tokens, reads like a master art brief. Rare.
- 18-23: Natural and clear with minor awkwardness or one stray technical term
- 12-17: Readable but stilted, overly technical, or contains inappropriate syntax tokens
- 5-11: Confused style — mixes prose with weight syntax or parameter tokens
- 0-4: Wrong style entirely (e.g., weight syntax on a natural language platform)`}

3. VISUAL SPECIFICITY (0-20 points)
Count concrete visual anchors: materials, colours, light directions, spatial relationships, textures, atmospheric effects.
- 19-20: Exceptional — every element has material, colour, and spatial grounding. Rare.
- 15-18: Rich concrete imagery with 1-2 vague areas
- 10-14: Decent specificity but multiple elements lack visual concreteness
- 5-9: Mostly vague or generic descriptions
- 0-4: Almost no concrete visual detail
"Beautiful", "stunning", "amazing" score ZERO — they carry no visual information. Any filler = deduction.

4. ECONOMY & CLARITY (0-15 points)
Judge against idealMin=${req.idealMin}, idealMax=${req.idealMax}, maxChars=${req.maxChars}.
- 14-15: Every single word earns its place, zero redundancy, within sweet spot. Rare.
- 11-13: Tight with one or two minor redundancies
- 7-10: Noticeable waste — duplicated modifiers, filler words, or unnecessary length
- 3-6: Significant bloat or unclear structure
- 0-2: Chaotic or incomprehensible
Filler words that score zero: "very", "really", "extremely", "beautiful", "stunning", "amazing", "gorgeous". If any appear, deduct accordingly.
Redundant modifiers (same idea said twice) = deduction. Look hard for these.

5. NEGATIVE QUALITY (0-10 points)${negApplicable
    ? `
Score the quality of exclusions.
- 9-10: Platform-specific, concrete exclusions (e.g., "chromatic aberration, motion blur, text overlay, watermark"). Rare.
- 6-8: Mostly specific with one or two generic terms
- 3-5: Mix of specific and generic, or missing important exclusions
- 1-2: Mostly generic boilerplate ("ugly, bad, deformed")
- 0: No negative provided when platform supports it, or negatives contradict positive prompt
Generic negatives like "ugly, bad quality, deformed, blurry" should NEVER score above 3.`
    : `
This platform does not support negatives. Return null for this axis.`}

SCORE ↔ DIRECTIVE CONSISTENCY RULES (MANDATORY — violations will be rejected):

Your score and directive count MUST be internally consistent. Inconsistency is a scoring failure.

- Score 92-100: Return 0 or 1 directive ONLY. Near-flawless. Almost never appropriate.
- Score 80-91: Return 1 or 2 directives. Strong prompt with clear improvements.
- Score 70-79: Return 2 or 3 directives. Good prompt with meaningful headroom.
- Score below 70: Return 3 directives. Significant issues.

HARD LIMITS:
- If you return 3 directives, your score MUST be 85 or below.
- If you return 2 directives, your score MUST be 89 or below.
- If you return 1 directive, your score MUST be 93 or below.
- Only 0 directives allows 94+, and only when genuinely near-perfect.

PROCESS: Score the axes FIRST. Sum them. THEN decide how many directives match that score. Do NOT inflate axis scores and then add directives that contradict the total.

DIRECTIVE RULES:
- Each directive MUST reference a specific phrase from the prompt (Ctrl+F-able)
- Phrase-level references only — NEVER word positions or indices
- Each directive must be actionable — the user should know exactly what to change
- Bad: "Make it more descriptive" — REJECTED (vague)
- Bad: "Add more lighting detail" — REJECTED (no phrase reference)
- Good: "Front-load 'lighthouse keeper' before the atmosphere clause for stronger subject attention"
- Good: "Replace generic negative 'ugly, bad quality' with 'chromatic aberration, motion blur, text overlay'"

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
// ROUTE HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  // ── Auth: Pro users only ─────────────────────────────────────────
  // Server-side enforcement — client-side Lab Gate is a UX gate,
  // this is the real security boundary.
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    // Clerk unavailable — reject (fail closed for paid feature)
    return NextResponse.json({ error: 'Authentication unavailable' }, { status: 503 });
  }

  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Check Pro tier via Clerk publicMetadata
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const tier = (user.publicMetadata as Record<string, unknown>)?.tier;
    if (tier !== 'paid') {
      return NextResponse.json({ error: 'Pro Promagen required' }, { status: 403 });
    }
  } catch {
    // Clerk user fetch failed — fail closed
    return NextResponse.json({ error: 'Unable to verify subscription' }, { status: 503 });
  }

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

  // ── Call GPT (temperature 0.2 for scoring consistency) ──────────
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
          temperature: 0.2,
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

    // ── Content-filter / finish-reason handling ──────────────────
    const choice = openaiData?.choices?.[0];
    if (!choice) {
      console.error('[score-prompt] No choices in response:', openaiData);
      return NextResponse.json({ error: 'Empty scoring response' }, { status: 502 });
    }

    const finishReason = choice.finish_reason;
    if (finishReason === 'content_filter') {
      console.warn('[score-prompt] Content filtered by OpenAI policy');
      return NextResponse.json(
        { error: 'Scoring unavailable — content policy filter triggered' },
        { status: 422 },
      );
    }
    if (finishReason === 'length') {
      console.warn('[score-prompt] Response truncated (max_tokens reached)');
      return NextResponse.json(
        { error: 'Scoring response was truncated — try a shorter prompt' },
        { status: 502 },
      );
    }
    if (finishReason !== 'stop') {
      console.warn(`[score-prompt] Unexpected finish_reason: ${finishReason}`);
      // Continue — may still be usable
    }

    const content = choice.message?.content;
    if (!content) {
      console.error('[score-prompt] Empty message content:', openaiData);
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
    // Deterministic safety net — if GPT ignores consistency rules,
    // the score is clamped based on directive count.
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
    console.error('[score-prompt] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal scoring error' }, { status: 500 });
  }
}
