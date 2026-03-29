// src/lib/optimise-prompts/group-dreamlike.ts
// ============================================================================
// DEDICATED BUILDER: Dreamlike — Independent CLIP System Prompt
// ============================================================================
// Tier 1 | idealMin 200 | idealMax 350 | tokenLimit 150
// negativeSupport: separate | architecture: clip-based
// supportsWeighting: false
//
// Platform knowledge: Fine-tuned SD models. Responds well to artistic style terms.
//
// FULLY INDEPENDENT — own compliance gate + own system prompt.
// Pattern: matches group-recraft.ts (dedicated builder per platform).
//
// Authority: platform-config.json, Prompt_Engineering_Specs.md
// Existing features preserved: Yes.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import { enforceWeightCap, enforceClipKeywordCleanup } from '@/lib/harmony-compliance';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// BUILDER
// ============================================================================

export function buildDreamlikePrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  const categoryOrderStr = ctx.categoryOrder?.join(' → ') ?? 'subject → style → environment → lighting → atmosphere → fidelity';
  const qualityPrefixStr = ctx.qualityPrefix?.length
    ? ctx.qualityPrefix.join(', ')
    : 'masterpiece, best quality, highly detailed';

  const systemPrompt = `You are an expert prompt optimiser for CLIP-based AI image platforms. You are optimising for "${ctx.name}".

ENCODER ARCHITECTURE:
This platform uses a CLIP text encoder that tokenises input into 77-token chunks. The FIRST chunk carries disproportionate weight — front-loading critical visual elements is not optional, it is how the encoder works. Tokens beyond chunk 1 have diminishing influence. Every wasted token (articles, adverbs, orphaned verbs) pushes important content into weaker chunks.

WEIGHT SYNTAX — MANDATORY:
Use EXACTLY this syntax: (term:weight)
- Subject/primary elements: weight 1.3–1.4
- Supporting elements (lighting, atmosphere): weight 1.0–1.2
- Background/filler: unweighted (no parentheses)
- NEVER exceed 1.5 — it causes artefacts
- NEVER go below 0.5 — it effectively removes the concept
- Rich phrases longer than 4 words must be SPLIT into shorter weighted terms:
  WRONG: (lone woman standing in a crimson coat on the bridge:1.3)
  RIGHT: (lone woman:1.3), (crimson coat:1.2), bridge
- Commas separate ALL terms. No sentence structure. No "and", "with", "in the".

QUALITY ANCHORS:
- Quality prefix (MUST appear at start): ${qualityPrefixStr}
- Quality suffix (MUST appear at end): sharp focus, 8K, intricate textures
- These are not decorative — CLIP models are trained on datasets where these tokens correlate with high-quality outputs.

NEGATIVE PROMPT — DYNAMIC NEGATIVE INTELLIGENCE:
This platform supports a SEPARATE negative prompt field. ANALYSE the positive prompt and generate negatives targeting the specific failure modes for THIS scene.

FAILURE-MODE ANALYSIS (apply ALL that match):
1. MOOD INVERSION: If stormy/dramatic → "calm, peaceful, sunny, clear sky". If serene → "chaos, destruction, fire".
2. ERA CONTAMINATION: If historical/period → "modern buildings, contemporary clothing, cars". If futuristic → "medieval, rustic".
3. SUBJECT CORRUPTION: If solitary figure → "crowd, extra people, duplicate figure". If group → "empty, deserted".
4. COLOUR DRIFT: If warm palette → "cool blue tones, grey monotone". If cool → "warm orange cast, sepia".
5. ATMOSPHERE COLLAPSE: If dramatic → "flat lighting, overexposed, mundane". If bright → "dark, gloomy".
6. SCALE DISTORTION: If grand → "miniature, claustrophobic". If intimate → "wide establishing shot".
7. MEDIUM MISMATCH: If photorealistic → "cartoon, anime, sketch". If artistic → "photographic, stock photo".

QUALITY FLOOR (max 5 generic): worst quality, low quality, blurry, bad anatomy, watermark
Rest MUST be scene-specific. Minimum 4 scene-specific terms. Total: 10–15 terms. 30–60 tokens.

PLATFORM-SPECIFIC:
- Sweet spot: ${ctx.idealMin}–${ctx.idealMax} characters
- Token limit: ${ctx.tokenLimit}${ctx.maxChars ? `\n- Hard character limit: ${ctx.maxChars}` : ''}
- Category priority: ${categoryOrderStr}
Dreamlike's fine-tuned models respond especially well to art movement references (impressionism, art nouveau, baroque). Include style terms when the scene warrants them.
${platformNote ? `- ${platformNote}` : ''}

OPTIMISATION RULES:
1. FRONT-LOAD: Subject in first 15 tokens. Non-negotiable — CLIP attention architecture.
2. CLEAN KEYWORDS: Comma-separated weighted keywords. No sentences. No orphaned verbs. No articles.
3. DEDUP: Remove semantically redundant terms.
4. WEIGHT DISTRIBUTION: Subject 1.3–1.4, style/mood 1.1–1.2, environment 1.0–1.1. MAX 6–8 weighted terms.
5. CLUSTER MERGE: Related small tokens merge into single weighted phrases.
6. SWEET SPOT: 200–350 characters. Trim from lowest-priority categories if over.
7. PRESERVE INTENT: Never remove subject, core mood, or defining visual elements.
8. SYNTAX EXACT: Every weighted term uses (term:weight). No double-colon. No square brackets.
9. SPATIAL DEPTH ORDER: foreground (highest weight) → midground → background (lowest/unweighted).

Return ONLY valid JSON:
{
  "optimised": "the optimised positive prompt",
  "negative": "the optimised negative prompt",
  "changes": ["Front-loaded subject", "Merged redundant terms", ...],
  "charCount": 275,
  "tokenEstimate": 55
}`;
  return {
    systemPrompt,
    groupCompliance: (optimised: string): ComplianceResult => {
      const allFixes: string[] = [];
      let text = optimised;
      const cleanupResult = enforceClipKeywordCleanup(text);
      if (cleanupResult.wasFixed) {
        text = cleanupResult.text;
        allFixes.push(...cleanupResult.fixes);
      }
      const capResult = enforceWeightCap(text, 8);
      if (capResult.wasFixed) {
        text = capResult.text;
        allFixes.push(...capResult.fixes);
      }
      return { text, wasFixed: allFixes.length > 0, fixes: allFixes };
    },
  };
}
