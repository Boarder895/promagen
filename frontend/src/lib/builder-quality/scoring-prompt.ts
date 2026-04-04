// src/lib/builder-quality/scoring-prompt.ts
// ============================================================================
// SHARED SCORING RUBRIC — Single Source of Truth
// ============================================================================
//
// Both the GPT scoring route (/api/score-prompt) and the Claude scorer
// (claude-scorer.ts) import from this file. The rubric text lives here
// and NOWHERE ELSE.
//
// If you need to change the scoring rubric, calibration examples, or
// anchor audit rules, change them HERE. Both models will pick up the
// change automatically.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §3.2, §5
// Build plan: part-9-build-plan v1.1.0, Sub-Delivery 9a
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file, extracted from route.ts).
// ============================================================================

// =============================================================================
// TYPES — Scoring Input (shared between GPT route and Claude scorer)
// =============================================================================

export interface ScoringInput {
  optimisedPrompt: string;
  humanText: string;
  assembledPrompt: string;
  negativePrompt?: string;
  platformId: string;
  platformName: string;
  tier: number;
  promptStyle: string;
  maxChars: number;
  idealMin: number;
  idealMax: number;
  negativeSupport: string;
  call3Changes: string[];
  call3Mode: string;
  categoryRichness: Record<string, number | undefined>;
  expectedAnchors?: { term: string; severity: string }[];
}

export interface ScoringResult {
  score: number;
  axes: {
    anchorPreservation: number;
    platformFit: number;
    visualSpecificity: number;
    economyClarity: number;
    negativeQuality: number | null;
  };
  directives: string[];
  summary: string;
  anchorAudit?: {
    anchor: string;
    severity: string;
    status: string;
    note?: string;
  }[];
}

// =============================================================================
// CALIBRATION EXAMPLES
// =============================================================================

export const SCORING_CALIBRATION_EXAMPLES = `
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

// =============================================================================
// SYSTEM PROMPT BUILDER
// =============================================================================

export function buildScoringSystemPrompt(): string {
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

${SCORING_CALIBRATION_EXAMPLES}

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

// =============================================================================
// USER MESSAGE BUILDER
// =============================================================================

export function buildScoringUserMessage(input: ScoringInput): string {
  const tierDesc =
    input.tier === 1
      ? 'CLIP-weighted'
      : input.tier === 2
        ? 'Midjourney-native'
        : input.tier === 3
          ? 'Natural language'
          : 'Plain language';

  const richCategories = Object.entries(input.categoryRichness)
    .filter(([, value]) => typeof value === 'number' && value > 0)
    .map(([key, value]) => `${key}: ${value} terms`)
    .join(', ');

  const lines: string[] = [
    `PLATFORM: ${input.platformName} (${input.platformId})`,
    `TIER: T${input.tier} — ${tierDesc}`,
    `PROMPT STYLE: ${input.promptStyle}`,
    `CHARACTER LIMITS: idealMin=${input.idealMin}, idealMax=${input.idealMax}, maxChars=${input.maxChars}`,
    `NEGATIVE SUPPORT: ${input.negativeSupport}`,
    `CALL 3 MODE: ${input.call3Mode}`,
    `CALL 3 CHANGES: ${input.call3Changes.length > 0 ? input.call3Changes.join('; ') : 'none'}`,
    `CATEGORY RICHNESS: ${richCategories || 'none detected'}`,
    '',
    'ORIGINAL HUMAN INPUT:',
    input.humanText,
    '',
    'ASSEMBLED PROMPT (pre-optimisation):',
    input.assembledPrompt,
    '',
    'OPTIMISED PROMPT (score this):',
    input.optimisedPrompt,
  ];

  if (input.negativeSupport === 'separate') {
    lines.push(
      '',
      'SEPARATE NEGATIVE PROMPT:',
      input.negativePrompt || '(none provided)',
    );
  } else if (input.negativeSupport === 'inline') {
    lines.push(
      '',
      'INLINE NEGATIVE NOTE:',
      'If explicit exclusions are present, they will be embedded in the optimised prompt itself.',
    );
  } else {
    lines.push('', 'NEGATIVE NOTE:', 'This platform does not support negatives.');
  }

  // Expected anchors for anchor audit
  if (input.expectedAnchors && input.expectedAnchors.length > 0) {
    lines.push('', 'EXPECTED ANCHORS (classify each in anchorAudit):');
    for (const anchor of input.expectedAnchors) {
      lines.push(`  - "${anchor.term}" [${anchor.severity}]`);
    }
    lines.push(
      '',
      'For each anchor above, return an entry in anchorAudit with status: exact, approximate, or dropped.',
      'Follow the §3.2 matching policy and sub-rules A-E strictly. When in doubt, classify as dropped.',
    );
  }

  return lines.join('\n');
}
