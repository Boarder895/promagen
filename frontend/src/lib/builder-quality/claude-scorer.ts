// src/lib/builder-quality/claude-scorer.ts
// ============================================================================
// CLAUDE SCORER — Anthropic API scoring client
// ============================================================================
//
// Calls Claude Haiku via direct fetch to score builder output using the
// same rubric as the GPT scorer. Returns the same ScoringResult shape
// so the batch runner can treat both models interchangeably.
//
// Uses the shared rubric from scoring-prompt.ts — rubric text is NEVER
// duplicated here. If you need to change the rubric, change it in
// scoring-prompt.ts.
//
// Error handling: returns null on any failure. The batch runner logs the
// error and continues with GPT-only data. Claude failure never fails
// the batch.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §8
// Build plan: part-9-build-plan v1.1.0, Sub-Delivery 9a
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file).
// ============================================================================

import {
  buildScoringSystemPrompt,
  buildScoringUserMessage,
  type ScoringInput,
  type ScoringResult,
} from './scoring-prompt';

// =============================================================================
// CONSTANTS
// =============================================================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1200;
const TEMPERATURE = 0.2;
const TIMEOUT_MS = 30_000;
const ANTHROPIC_VERSION = '2023-06-01';

/** Transient error codes that warrant a single retry */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

// =============================================================================
// PUBLIC API
// =============================================================================

export { CLAUDE_MODEL };

/**
 * Score a builder output using Claude Haiku.
 * Returns null on any failure — the caller should log and continue.
 */
export async function scoreWithClaude(
  input: ScoringInput,
): Promise<ScoringResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.debug('[builder-quality] Claude scorer: ANTHROPIC_API_KEY not set');
    return null;
  }

  const systemPrompt = buildScoringSystemPrompt();
  const userMessage = buildScoringUserMessage(input);

  // First attempt
  let result = await callClaude(apiKey, systemPrompt, userMessage);

  // Single retry on transient errors
  if (result === 'RETRYABLE') {
    console.debug('[builder-quality] Claude scorer: retrying after transient error...');
    await sleep(2000);
    result = await callClaude(apiKey, systemPrompt, userMessage);
  }

  if (result === 'RETRYABLE' || result === null) {
    return null;
  }

  return result;
}

// =============================================================================
// INTERNAL — API CALL
// =============================================================================

type CallResult = ScoringResult | 'RETRYABLE' | null;

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<CallResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const status = response.status;
      const body = await response.text().catch(() => '');
      console.debug(
        `[builder-quality] Claude scorer: API error ${status}: ${body.slice(0, 200)}`,
      );

      if (RETRYABLE_STATUSES.has(status)) {
        return 'RETRYABLE';
      }
      return null;
    }

    const data = await response.json();

    // Extract text from Anthropic response format
    const textBlock = data?.content?.find(
      (block: { type: string }) => block.type === 'text',
    );
    if (!textBlock?.text) {
      console.debug('[builder-quality] Claude scorer: no text block in response');
      return null;
    }

    return parseResponse(textBlock.text);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.debug('[builder-quality] Claude scorer: request timed out');
      return 'RETRYABLE';
    }

    console.debug('[builder-quality] Claude scorer: unexpected error:', error);
    return null;
  }
}

// =============================================================================
// INTERNAL — RESPONSE PARSING
// =============================================================================

function parseResponse(text: string): ScoringResult | null {
  try {
    // Strip any markdown fences if present
    const clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(clean);

    // Validate required fields
    if (
      typeof parsed.axes?.anchorPreservation !== 'number' ||
      typeof parsed.axes?.platformFit !== 'number' ||
      typeof parsed.axes?.visualSpecificity !== 'number' ||
      typeof parsed.axes?.economyClarity !== 'number' ||
      !Array.isArray(parsed.directives) ||
      typeof parsed.summary !== 'string'
    ) {
      console.debug('[builder-quality] Claude scorer: invalid response structure');
      return null;
    }

    // Compute total score from axes
    const negativeQuality =
      parsed.axes.negativeQuality !== null && parsed.axes.negativeQuality !== undefined
        ? Number(parsed.axes.negativeQuality)
        : null;

    const score =
      parsed.axes.anchorPreservation +
      parsed.axes.platformFit +
      parsed.axes.visualSpecificity +
      parsed.axes.economyClarity +
      (negativeQuality ?? 0);

    return {
      score,
      axes: {
        anchorPreservation: parsed.axes.anchorPreservation,
        platformFit: parsed.axes.platformFit,
        visualSpecificity: parsed.axes.visualSpecificity,
        economyClarity: parsed.axes.economyClarity,
        negativeQuality,
      },
      directives: parsed.directives.slice(0, 3).map(String),
      summary: String(parsed.summary).slice(0, 500),
      anchorAudit: Array.isArray(parsed.anchorAudit) ? parsed.anchorAudit : undefined,
    };
  } catch (error) {
    console.debug('[builder-quality] Claude scorer: JSON parse error:', error);
    return null;
  }
}

// =============================================================================
// INTERNAL — HELPERS
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
