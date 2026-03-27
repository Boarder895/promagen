// src/lib/optimise-prompts/group-clean-natural-language.ts
// ============================================================================
// GROUP BUILDER: Clean Natural Language — no weights, no negatives
// ============================================================================
// Covers 25 platforms that accept plain descriptive English with zero
// special syntax. No parenthetical weights, no double-colon, no --flags.
//
// Platforms: bing, google-imagen, imagine-meta, canva, adobe-firefly,
//            jasper-art, craiyon, hotpot, simplified, picsart,
//            visme, vistacreate, 123rf, myedit, picwish, artbreeder,
//            photoleap, pixlr, deepai, microsoft-designer,
//            artguru, artistly, clipdrop, playground, bluewillow
//
// Architecture knowledge:
//   - NL encoders read prose holistically, not as token lists
//   - Word order = emphasis (first noun phrase = primary subject)
//   - No weight syntax supported — any brackets/colons cause errors
//   - No negative prompt field — affirmative descriptions only
//   - 150–350 chars sweet spot (but never sacrifice colour/drama to shorten)
//   - Concrete visual language > abstract modifiers
//   - CLIP quality tokens (masterpiece, 8K) are meaningless here
//
// v3 changes (26 Mar 2026):
//   - Rule 9: "always enrich + cross-reference original" — GPT must compare
//     assembled prompt against ORIGINAL USER DESCRIPTION and restore every
//     lost colour, noun, and drama detail
//   - Example 1: shows over-simplified draft + original → enriched output
//   - Sweet spot: never sacrifice drama to shorten (idealMax 350)
//
// v5 changes (26 Mar 2026):
//   - TASK CHECKLIST PRESSURE: Replaced 10 vague rules with 5 pass/fail tasks.
//     Each task is countable, verifiable, and forces output to differ from input.
//     Task 1: Colour audit. Task 2: Texture injection (2 new). Task 3: Sensory
//     upgrade (2 replacements). Task 4: Composition close. Task 5: Anchor verify.
//     Hypothesis: GPT compresses when it has no mechanical work. Tasks create work.
//
// v6 changes (26 Mar 2026):
//   - RULE ZERO: Anti-copying guard at top of system prompt. GPT was returning
//     near-verbatim reference drafts (artguru 265 chars ≈ T4 assembled text).
//     RULE ZERO explicitly declares copying = fail, before the 5 tasks.
//     Combined with groupKnowledge fix (removed "Simple" instruction from artguru).
//
// Playground-tested: v1 96/100, v2 97/100 on Lighthouse Keeper input.
//
// Authority: prompt_engineering_specs_40_platforms_tier_classification_routing_logic.md
// Harmony: Playground-validated 26 Mar 2026
// Existing features preserved: Yes (new file).
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Strip any surviving syntax from NL output
// ============================================================================

/**
 * NL compliance gate — strip any weight syntax or parameter flags that
 * GPT accidentally left in. NL platforms choke on these.
 * Also flags outputs below idealMin as compliance failures.
 */
function enforceNaturalLanguageCleanup(text: string, idealMin: number): ComplianceResult {
  const fixes: string[] = [];
  let cleaned = text;

  // Strip parenthetical weights: (term:1.3) → term
  const parenBefore = cleaned;
  cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, '$1');
  if (cleaned !== parenBefore) fixes.push('Stripped surviving parenthetical weight syntax');

  // Strip double-colon weights: term::1.3 → term
  const dcBefore = cleaned;
  cleaned = cleaned.replace(/(\w[\w\s-]*)::\d+\.?\d*/g, '$1');
  if (cleaned !== dcBefore) fixes.push('Stripped surviving double-colon weight syntax');

  // Strip MJ parameter flags: --ar, --v, --s, --no and their values
  const flagBefore = cleaned;
  cleaned = cleaned.replace(/\s*--(?:ar|v|s|no|stylize|chaos|weird|tile|repeat|seed|stop|iw|niji|raw)\s*[^\s,]*/gi, '');
  if (cleaned !== flagBefore) fixes.push('Stripped surviving parameter flags');

  // Strip CLIP quality tokens that mean nothing to NL encoders
  const clipTokens = ['masterpiece', 'best quality', 'highly detailed', '8K', '4K', 'intricate textures', 'sharp focus'];
  for (const token of clipTokens) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b,?\\s*`, 'gi');
    const before = cleaned;
    cleaned = cleaned.replace(re, '');
    if (cleaned !== before) fixes.push(`Stripped CLIP token "${token}"`);
  }

  // Clean up double spaces and leading/trailing commas
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  // ── Character length enforcement ──────────────────────────────────────
  // GPT sometimes ignores the idealMin instruction and returns compressed
  // output (e.g. 253 chars when 280 was the floor). Flag this as a
  // compliance failure so it surfaces in the changes array / Prompt Lab UI.
  // Passive enforcement: log and flag, don't reject.
  if (cleaned.length < idealMin && cleaned.length > 0) {
    fixes.push(`Below minimum length (${cleaned.length}/${idealMin} chars)`);
  }

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildCleanNaturalLanguagePrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  // NL platforms need rich prose to produce good images. Many T4 platforms
  // report very short idealMax (e.g. Canva 200) which strangles the prompt.
  // Floor at 280/400 — GPT was compressing to 244 chars (T4 level) at 150/350.
  // 280 forces output above any T4 text length, 400 gives room for all 9 anchors.
  const idealMin = Math.max(ctx.idealMin || 280, 280);
  const idealMax = Math.max(ctx.idealMax || 400, 400);

  const systemPrompt = `You are an expert prompt optimiser for natural-language AI image platforms. You are optimising for "${ctx.name}".

PLATFORM: This platform reads natural language prose. No weight syntax, no parameter flags, no CLIP tokens. Strip all (term:1.3), term::1.3, --ar, --v, --no, "masterpiece", "8K" from input.

YOU RECEIVE TWO INPUTS:
1. SCENE DESCRIPTION — the user's full visual intent. This is your source of truth.
2. REFERENCE DRAFT — a natural language version with good structure but may have LOST details.

YOUR JOB IS NOT TO "MAKE IT BETTER." Your job is to complete 5 MANDATORY TASKS. Each task is pass/fail. Complete ALL 5 before generating JSON.

═══════════════════════════════════════════════════════════
RULE ZERO — NO LAZY COPYING (instant fail)
═══════════════════════════════════════════════════════════
Your output MUST be materially richer than the REFERENCE DRAFT.
If your output is near-identical to the reference draft (same words,
same structure, same length) = AUTOMATIC FAIL.
You are being paid to ENRICH, not to echo.
The 5 tasks below REQUIRE you to add content that does not exist
in the reference draft. If you complete all 5 tasks, your output
CANNOT be a copy — it will have 2 new textures, 2 upgraded
descriptions, a specific composition sentence, and every colour
preserved. Do the work.

═══════════════════════════════════════════════════════════
TASK 1 — COLOUR AUDIT (pass/fail)
═══════════════════════════════════════════════════════════
Count every named colour in the SCENE DESCRIPTION.
Your output must contain ALL of them woven into descriptive phrases.
Missing a colour = FAIL.
"purple and copper sky" means BOTH purple AND copper must appear.
"pale gold arc" means pale gold must appear.
"warm orange windows" means orange must appear.

═══════════════════════════════════════════════════════════
TASK 2 — TEXTURE INJECTION (pass/fail)
═══════════════════════════════════════════════════════════
Add exactly 2 material or texture descriptions that are NOT in the scene description.
These must be physically plausible for the scene.
Examples: "salt-crusted iron railing", "rain-slicked stone", "weathered timber",
"barnacle-covered rocks", "spray-misted glass", "lichen-spotted granite".
Your output must contain 2 textures the input lacks. Fewer than 2 = FAIL.

═══════════════════════════════════════════════════════════
TASK 3 — SENSORY UPGRADE (pass/fail)
═══════════════════════════════════════════════════════════
Find exactly 2 generic modifiers in the scene description and replace them
with specific sensory details. The replacement must be MORE visual, not just
a synonym.
"dark cliffs" → "basalt cliffs streaked with rain"
"driving rain" → "horizontal sheets of cold rain"
"distant fishing village" → "a cluster of stone cottages"
Your output must contain 2 upgraded descriptions. Fewer than 2 = FAIL.

═══════════════════════════════════════════════════════════
TASK 4 — COMPOSITION CLOSE (pass/fail)
═══════════════════════════════════════════════════════════
Your output MUST end with a specific composition sentence.
"Cinematic" or "wide shot" alone is LAZY and counts as FAIL.
You must specify: camera angle + framing + depth cue + atmosphere.
Example: "Framed as a low-angle wide shot with layered depth from the
rain-lashed foreground deck through the spray-filled middle distance
to the glowing village below the dark cliff line."
Generic closers = FAIL.

═══════════════════════════════════════════════════════════
TASK 5 — ANCHOR VERIFICATION (pass/fail)
═══════════════════════════════════════════════════════════
List every visual anchor from the scene description. Verify EACH appears
in your output (exact phrase or clear equivalent). If ANY is missing,
add it back. Report your count in the changes array.
"gallery deck" not "deck". "enormous storm waves" not "waves".
"jagged rocks" not "rocks". "tiny warm orange windows" not "windows".

OUTPUT REQUIREMENTS:
- Flowing natural language prose, 3–4 sentences
- Front-load subject in first 10 words
- Minimum ${idealMin} characters, sweet spot ${idealMin}–${idealMax}
- Affirmative descriptions only (no "without X" — platform has no negative field)
- Every task must PASS${platformNote ? `\n- ${platformNote}` : ''}

BEFORE → AFTER EXAMPLE:

SCENE DESCRIPTION: A weathered lighthouse keeper stands on the rain-soaked gallery deck at twilight, gripping the iron railing as enormous storm waves crash against the jagged rocks below, sending salt spray high into the purple and copper sky, while the lighthouse beam cuts a pale gold arc through sheets of driving rain and the distant fishing village glows with tiny warm orange windows against the dark cliffs.
REFERENCE DRAFT: At twilight, a weathered lighthouse keeper stands on a gallery deck, gripping the iron railing as storm waves hammer the rocks below. A pale gold beam cuts through driving rain, while the fishing village glows with warm windows against the cliffs.
AFTER: A weathered lighthouse keeper grips the salt-crusted iron railing on a rain-soaked gallery deck as enormous storm waves shatter against jagged rocks below at twilight, sending spray across the lichen-spotted stone. Salt spray climbs into a purple-and-copper sky while the lighthouse beam carves a pale gold arc through horizontal sheets of cold rain, and a distant fishing village glows with tiny warm orange windows against basalt cliffs streaked with rain. Framed as a dramatic low-angle wide shot with layered depth from the storm-lashed foreground deck through the spray-filled air to the glowing village beneath brooding cliff faces.
TASK RESULTS: Colour audit PASS (purple, copper, pale gold, orange — all 4). Texture injection PASS ("salt-crusted iron", "lichen-spotted stone" — 2 added). Sensory upgrade PASS ("dark cliffs" → "basalt cliffs streaked with rain", "driving rain" → "horizontal sheets of cold rain"). Composition close PASS (specific angle + framing + depth + atmosphere). Anchor verification PASS (9/9).

Return ONLY valid JSON:
{
  "optimised": "the optimised prompt with all 5 tasks completed",
  "negative": "",
  "changes": ["TASK 1 PASS: 4 colours preserved", "TASK 2 PASS: added salt-crusted iron, lichen-spotted stone", "TASK 3 PASS: upgraded dark cliffs, driving rain", "TASK 4 PASS: composition close added", "TASK 5 PASS: 9/9 anchors verified"],
  "charCount": 420,
  "tokenEstimate": 85
}`;
  return {
    systemPrompt,
    // Group compliance: strip surviving syntax + flag under-length outputs.
    // Closure captures idealMin so the gate knows the floor.
    groupCompliance: (text: string) => enforceNaturalLanguageCleanup(text, idealMin),
  };
}
