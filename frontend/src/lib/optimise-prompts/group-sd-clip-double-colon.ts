// src/lib/optimise-prompts/group-sd-clip-double-colon.ts
// ============================================================================
// GROUP BUILDER: SD CLIP Double-Colon — term::weight syntax
// ============================================================================
// Covers platforms that use the CLIP encoder with double-colon weight syntax.
//
// Platforms: leonardo (currently the only one — more may be added)
//
// Architecture knowledge:
//   - Same CLIP encoder fundamentals as parenthetical group
//   - Weight syntax: term::weight (NO parentheses)
//   - Leonardo calls LoRAs "Elements" — max 4, combined weight ≤1.00
//   - ~1,000-char limit (longer than most CLIP platforms)
//   - Front-loading emphasis is critical
//   - Separate negative prompt field supported
//
// Shares the same BEFORE→AFTER examples and rules as parenthetical group
// but with syntax-converted examples showing term::weight instead of (term:weight).
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md
// Harmony: Built from Wave 1 learnings (R1–R3)
// Existing features preserved: Yes (new file).
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import { enforceClipKeywordCleanup } from '@/lib/harmony-compliance';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// BUILDER
// ============================================================================

export function buildSdClipDoubleColonPrompt(
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
This platform uses a CLIP text encoder. The FIRST tokens carry disproportionate weight — front-loading critical visual elements is how the encoder works. Every wasted token pushes important content into weaker positions.

WEIGHT SYNTAX — MANDATORY:
Use EXACTLY this syntax: term::weight
- NO parentheses. The syntax is term::weight — two colons, no brackets.
- Subject/primary elements: weight 1.3–1.4
- Supporting elements (lighting, atmosphere): weight 1.0–1.2
- Background/filler: unweighted (no :: notation)
- NEVER exceed 1.5 — it causes artefacts
- NEVER go below 0.5 — it effectively removes the concept
- Rich phrases longer than 4 words must be SPLIT:
  WRONG: lone woman standing in a crimson coat on the bridge::1.3
  RIGHT: lone woman::1.3, crimson coat::1.2, bridge
- Commas separate ALL terms. No sentence structure. No "and", "with", "in the".
- CRITICAL: Do NOT use parenthetical syntax (term:weight) — that is WRONG for this platform. Every weight MUST use double-colon: term::weight

QUALITY ANCHORS:
- Quality prefix (MUST appear at start): ${qualityPrefixStr}
- Quality suffix (MUST appear at end): sharp focus, 8K, intricate textures

NEGATIVE PROMPT — DYNAMIC NEGATIVE INTELLIGENCE:
This platform supports a SEPARATE negative prompt field. Do NOT use boilerplate negatives. Instead, ANALYSE the positive prompt and generate negatives targeting the specific failure modes for THIS scene.

FAILURE-MODE ANALYSIS (apply ALL that match):
1. MOOD INVERSION: If stormy/dramatic → negative "calm, peaceful, sunny, clear sky". If serene → negative "chaos, destruction, fire".
2. ERA CONTAMINATION: If historical/period → negative "modern buildings, contemporary clothing, cars, power lines". If futuristic → negative "medieval, rustic, old-fashioned".
3. SUBJECT CORRUPTION: If solitary figure → negative "crowd, extra people, group, duplicate figure". If group → negative "empty, deserted, lonely".
4. COLOUR DRIFT: If palette is warm (copper/gold/orange) → negative "cool blue tones, green cast, grey monotone". If cool palette → negative "warm orange cast, sepia".
5. ATMOSPHERE COLLAPSE: If dramatic/moody → negative "flat lighting, mundane, overexposed, boring composition". If bright/cheerful → negative "dark, gloomy, ominous".
6. SCALE DISTORTION: If grand/epic → negative "miniature, tiny, close-up, claustrophobic". If intimate → negative "wide establishing shot, distant, aerial".
7. MEDIUM MISMATCH: If photorealistic → negative "cartoon, anime, sketch, illustration". If artistic → negative "photographic, stock photo".

QUALITY FLOOR (maximum 5 generic terms): worst quality, low quality, blurry, bad anatomy, watermark
The rest MUST be scene-specific from the failure-mode analysis above. Minimum 4 scene-specific terms.
Total negative: 10–15 terms. Does NOT duplicate positive prompt terms — wastes the negative encoder's budget.
Keep to 30–60 tokens.

PLATFORM-SPECIFIC:
- Sweet spot: ${ctx.idealMin}–${ctx.idealMax} characters
- Token limit: ${ctx.tokenLimit}${ctx.maxChars ? `\n- Hard character limit: ${ctx.maxChars}` : ''}
- Category priority: ${categoryOrderStr}${platformNote ? `\n- ${platformNote}` : ''}

OPTIMISATION RULES:
1. FRONT-LOAD: Subject and primary visual element first. Non-negotiable.
2. CLEAN KEYWORDS: Comma-separated weighted keywords. No sentence fragments. No orphaned verbs ("stands", "reflecting"). No articles ("a", "the"). No prepositions as connectors.
3. DEDUP: Remove semantically redundant terms.
4. WEIGHT DISTRIBUTION: Subject highest (1.3–1.4). Style/mood (1.1–1.2). Environment (1.0–1.1). Filler unweighted. MAXIMUM 6–8 weighted terms.
5. CLUSTER MERGE: Related small tokens MUST merge into single weighted phrases.
6. SWEET SPOT: Final prompt must be ${ctx.idealMin}–${ctx.idealMax} characters. PRIMARY target.
7. PRESERVE INTENT: Never remove the subject, core mood, or defining visual elements.
8. SYNTAX MUST BE EXACT: Every weighted term uses term::weight — double-colon, decimal weight. NO parentheses. NO square brackets.
9. SPATIAL DEPTH ORDER: Foreground subject first (highest weight) → midground → background (lowest/unweighted).

BEFORE → AFTER EXAMPLES (note the double-colon syntax throughout):

Example 1 — Weight bloat + no clustering:
BEFORE: masterpiece, best quality, highly detailed, elderly samurai::1.4, katana::1.2, Mount Fuji::1.2, cherry blossoms::1.2, falling petals::1.1, sunset light::1.2, golden hour::1.1, misty valley::1.1, stone path::1.1, weathered armor::1.2, wind blown hair::1.1, dramatic sky::1.1, ancient temple::1.1, moss covered rocks::1.0, cinematic, sharp focus, 8K
AFTER: masterpiece, best quality, highly detailed, elderly samurai::1.4, katana::1.3, Mount Fuji::1.2, cherry blossom petals::1.2, golden sunset mist::1.1, weathered armor::1.1, stone path, ancient temple, moss-covered rocks, dramatic sky, cinematic wide shot, sharp focus, 8K, intricate textures
WHY: 14 weighted → 6. Merged "sunset light" + "golden hour" + "misty valley" → "golden sunset mist". Unweighted low-value terms.

Example 2 — Colour fragments + no spatial depth:
BEFORE: masterpiece, best quality, highly detailed, lighthouse beam::1.3, purple clouds::1.1, copper sky::1.1, twilight sky::1.2, storm waves::1.3, keeper::1.4, iron railing::1.2, salt spray::1.2, driving rain::1.1, fishing village::1.1, warm orange windows::1.1, dark cliffs, jagged rocks, sharp focus, 8K
AFTER: masterpiece, best quality, highly detailed, weathered lighthouse keeper::1.4, storm-lashed coastline::1.3, lighthouse beam::1.3, purple-and-copper twilight sky::1.2, salt spray::1.1, iron railing, driving rain, jagged rocks, distant fishing village, warm orange windows, dark cliffs, cinematic wide shot, low angle, sharp focus, 8K, intricate textures
WHY: Merged sky fragments into one. Spatial depth: foreground keeper (1.4) → midground coastline+beam (1.3) → sky (1.2) → background village (unweighted). 12 weighted → 5.
NEGATIVE: worst quality, low quality, blurry, watermark, calm sea, daytime, clear sky, modern buildings, extra people, sunny weather, flat lighting, dry ground
WHY THESE NEGATIVES: Mood inversion: "calm sea, daytime, clear sky, sunny weather" — scene is stormy twilight. Subject corruption: "extra people" — keeper is solitary. Era contamination: "modern buildings" — scene is traditional coastal.

Return ONLY valid JSON:
{
  "optimised": "the optimised positive prompt",
  "negative": "the optimised negative prompt",
  "changes": ["Front-loaded subject to first position", "Converted weight syntax to double-colon", ...],
  "charCount": 285,
  "tokenEstimate": 72
}`;
  return {
    systemPrompt,
    // Group compliance chain: keyword cleanup → weight cap → syntax enforcement.
    // enforceT1Syntax in the route handles parenthetical↔double-colon conversion
    // as the final safety net, but we clean up first.
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
      // For double-colon, enforceWeightCap only catches (term:weight) syntax.
      // Need to also count term::weight patterns.
      const dcWeightPattern = /\w[\w\s-]+::\d+\.?\d*/g;
      const dcMatches = [...text.matchAll(dcWeightPattern)];
      if (dcMatches.length > 8) {
        // Sort by weight, strip lowest
        const parsed = dcMatches.map(m => {
          const parts = m[0].split('::');
          return { full: m[0], term: parts[0]!.trim(), weight: parseFloat(parts[1] ?? '1'), index: m.index! };
        }).sort((a, b) => a.weight - b.weight);

        const toStrip = parsed.slice(0, parsed.length - 8);
        // Process in reverse position order to preserve indices
        for (const item of [...toStrip].sort((a, b) => b.index - a.index)) {
          text = text.slice(0, item.index) + item.term + text.slice(item.index + item.full.length);
        }
        const strippedNames = toStrip.map(t => `${t.term} (was ::${t.weight})`);
        allFixes.push(`Capped double-colon weighted terms: ${dcMatches.length} → 8. Unweighted: ${strippedNames.join(', ')}`);
      }

      return { text, wasFixed: allFixes.length > 0, fixes: allFixes };
    },
  };
}
