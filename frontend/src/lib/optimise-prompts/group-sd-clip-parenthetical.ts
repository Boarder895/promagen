// src/lib/optimise-prompts/group-sd-clip-parenthetical.ts
// ============================================================================
// GROUP BUILDER: SD CLIP Parenthetical — (term:weight) syntax
// ============================================================================
// Covers 12 platforms that share the Stable Diffusion CLIP encoder with
// parenthetical weight syntax: (term:1.3)
//
// Platforms: stability, artguru, artistly, clipdrop, dreamlike, dreamstudio,
//            getimg, lexica, nightcafe, openart, playground, tensor-art
//
// Architecture knowledge baked in:
//   - CLIP tokeniser processes in 77-token chunks
//   - First chunk has disproportionate influence (front-loading matters)
//   - Parenthetical syntax: (term:weight) where weight 0.5–1.5
//   - Separate negative prompt field is standard
//   - Quality prefix/suffix conventions are platform-expected
//   - Comma-separated keywords, NOT prose sentences
//   - Orphaned verbs and articles waste token budget
//
// Per-platform overrides handled via provider context (sweet spot, limits).
// The system prompt is architecturally identical across the 12 — only the
// numbers change (e.g., Stability 350 chars vs Tensor.Art 500 chars).
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md §Group 3
// Harmony: Built from Call 2 R1–R6 learnings (harmonizing-claude-openai.md)
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import { enforceWeightCap, enforceClipKeywordCleanup } from '@/lib/harmony-compliance';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// BUILDER
// ============================================================================

export function buildSdClipParentheticalPrompt(
  providerId: string,
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
- These are not decorative — CLIP models are trained on datasets where these tokens correlate with high-quality outputs. Omitting them degrades generation quality measurably.

NEGATIVE PROMPT:
This platform supports a SEPARATE negative prompt field. Generate a negative prompt that:
- Targets the opposite of desired quality: worst quality, low quality, blurry, bad anatomy, deformed
- Includes scene-specific exclusions relevant to the user's intent
- Does NOT duplicate positive prompt terms with "no" prefix — that wastes the negative encoder's budget
- Keeps to 30–60 tokens (negative prompts have their own CLIP chunk limit)

PLATFORM-SPECIFIC:
- Sweet spot: ${ctx.idealMin}–${ctx.idealMax} characters
- Token limit: ${ctx.tokenLimit}${ctx.maxChars ? `\n- Hard character limit: ${ctx.maxChars}` : ''}
- Category priority: ${categoryOrderStr}${platformNote ? `\n- ${platformNote}` : ''}

OPTIMISATION RULES:
1. FRONT-LOAD: Subject and primary visual element in the first 15 tokens. This is non-negotiable — it is how CLIP attention works.
2. CLEAN KEYWORDS: Output must be comma-separated weighted keywords. No sentence fragments. No orphaned verbs ("stands", "reflecting", "leaving"). No articles ("a", "the", "an"). No prepositions used as connectors ("in the", "with a", "on the").
3. DEDUP: Remove semantically redundant terms. "realistic textures" after "realistic" is waste. "detailed background" after "highly detailed" is waste.
4. WEIGHT DISTRIBUTION: Subject gets highest weight (1.3–1.4). Style/mood next (1.1–1.2). Environment/setting 1.0–1.1. Filler unweighted. MAXIMUM 6–8 weighted terms. More than 8 dilutes the CLIP attention signal — the encoder treats everything as equal priority, which means nothing stands out. Unweighted terms still contribute to the image; they just don't get boosted.
5. CLUSTER MERGE: Related small tokens MUST merge into single weighted phrases. This is the most important optimisation — it reduces token count while preserving semantic intent.
6. SWEET SPOT: Final prompt must be ${ctx.idealMin}–${ctx.idealMax} characters. This is the PRIMARY target. Trim from lowest-priority categories first if over. Add quality anchors if under.
7. PRESERVE INTENT: Never remove the subject, core mood, or defining visual elements. Optimise structure and efficiency, not meaning.
8. SYNTAX MUST BE EXACT: Every weighted term uses (term:weight) — parentheses, colon, decimal weight. No double-colon. No square brackets. No curly braces.
9. SPATIAL DEPTH ORDER: Arrange terms by depth plane — foreground subject first (highest weight), midground action/environment second, background elements last (lowest weight or unweighted). This mirrors how CLIP chunk attention works: chunk 1 = foreground, chunk 2+ = depth. A prompt ordered foreground→background composes better than random term order.

BEFORE → AFTER EXAMPLES (study these — they show exactly what good optimisation looks like):

Example 1 — Weight bloat + no clustering:
BEFORE: masterpiece, best quality, highly detailed, (elderly samurai:1.4), (katana:1.2), (Mount Fuji:1.2), (cherry blossoms:1.2), (falling petals:1.1), (sunset light:1.2), (golden hour:1.1), (misty valley:1.1), (stone path:1.1), (weathered armor:1.2), (wind blown hair:1.1), (dramatic sky:1.1), (ancient temple:1.1), (moss covered rocks:1.0), cinematic, sharp focus, 8K
AFTER: masterpiece, best quality, highly detailed, (elderly samurai:1.4), (katana:1.3), (Mount Fuji:1.2), (cherry blossom petals:1.2), (golden sunset mist:1.1), (weathered armor:1.1), stone path, ancient temple, moss-covered rocks, dramatic sky, cinematic wide shot, sharp focus, 8K, intricate textures
WHY: 14 weighted terms → 6. "sunset light" + "golden hour" + "misty valley" merged into "golden sunset mist". "cherry blossoms" + "falling petals" merged. Low-value terms (stone path, temple, rocks, sky) unweighted — they still render but don't compete for CLIP attention budget.

Example 2 — Duplicate concepts + orphaned verbs:
BEFORE: masterpiece, best quality, (woman:1.3), (standing:1.1), (red dress:1.2), (flowing:1.1), (city street:1.1), (rain:1.2), (rainy night:1.1), (wet pavement:1.1), (neon reflections:1.2), (neon lights:1.1), (bokeh:1.1), cinematic
AFTER: masterpiece, best quality, highly detailed, (woman in red dress:1.4), (rain-slicked city street:1.2), (neon reflections:1.2), wet pavement, bokeh, cinematic night scene, sharp focus, 8K, intricate textures
WHY: "standing" and "flowing" are verbs — CLIP ignores them, they waste tokens. "rain" + "rainy night" deduplicated. "neon reflections" + "neon lights" deduplicated. "woman" + "red dress" merged into one weighted subject. 12 weighted → 3.

Example 3 — Colour fragments + no spatial depth:
BEFORE: masterpiece, best quality, highly detailed, (lighthouse beam:1.3), (purple clouds:1.1), (copper sky:1.1), (twilight sky:1.2), (storm waves:1.3), (keeper:1.4), (iron railing:1.2), (salt spray:1.2), (driving rain:1.1), (fishing village:1.1), (warm orange windows:1.1), dark cliffs, jagged rocks, sharp focus, 8K
AFTER: masterpiece, best quality, highly detailed, (weathered lighthouse keeper:1.4), (storm-lashed coastline:1.3), (lighthouse beam:1.3), (purple-and-copper twilight sky:1.2), (salt spray:1.1), iron railing, driving rain, jagged rocks, distant fishing village, warm orange windows, dark cliffs, cinematic wide shot, low angle, sharp focus, 8K, intricate textures
WHY: "purple clouds" + "copper sky" + "twilight sky" were three separate fragments describing ONE sky — merged into "purple-and-copper twilight sky". "storm waves" + "salt spray" + "driving rain" are related weather tokens — "storm-lashed coastline" covers the environment, individual weather details kept unweighted. Spatial depth applied: foreground keeper (1.4) → midground coastline+beam (1.3) → sky (1.2) → background village (unweighted). 12 weighted → 5.

Return ONLY valid JSON:
{
  "optimised": "the optimised positive prompt",
  "negative": "the optimised negative prompt",
  "changes": ["Front-loaded subject to first position", "Merged redundant snow terms", ...],
  "charCount": 285,
  "tokenEstimate": 72
}`;

  return {
    systemPrompt,
    // Group compliance chain: keyword cleanup (strip verbs/articles) → weight cap (max 8).
    // Both run BEFORE the generic enforceT1Syntax (which handles syntax conversion).
    groupCompliance: (optimised: string): ComplianceResult => {
      const allFixes: string[] = [];
      let text = optimised;

      // Step 1: Strip orphaned verbs and leading articles
      const cleanupResult = enforceClipKeywordCleanup(text);
      if (cleanupResult.wasFixed) {
        text = cleanupResult.text;
        allFixes.push(...cleanupResult.fixes);
      }

      // Step 2: Cap weighted terms at 8
      const capResult = enforceWeightCap(text, 8);
      if (capResult.wasFixed) {
        text = capResult.text;
        allFixes.push(...capResult.fixes);
      }

      return { text, wasFixed: allFixes.length > 0, fixes: allFixes };
    },
  };
}
