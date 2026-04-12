// src/lib/optimise-prompts/group-midjourney.ts
// ============================================================================
// GROUP BUILDER: Midjourney — Dedicated system prompt
// ============================================================================
// Midjourney uses:
//   - :: prose weighting between complete descriptive clauses
//   - -- parameter flags (--ar, --v, --s, --no) at the end
//   - natural descriptive language, not keyword soup
//   - strong early-position attention, so subject and primary action must lead
//
// This is a dedicated builder — not shared with any other platform.
//
// v4 (13 Apr 2026): FULL REWRITE — restructure-only, no invention.
//   Previous v3 prompt scored 61/100 (ChatGPT assessment) due to structural
//   misalignment with Call 3 architecture. The prompt instructed GPT to
//   embellish, add style/framing cues, and "write like a film director" —
//   directly causing the APS gate's invented_content veto to fire on 7/8
//   scenes (87.5% rescue dependency). Mean score matched deterministic
//   baseline at 85 with zero improvement.
//
//   v4 reframes GPT's job: reorganise existing content into MJ-native
//   weighted clause structure. No creative embellishment. No invented
//   content. Negatives (--no) are the ONE area where new content is
//   permitted because they are protective platform syntax.
//
//   System prompt authored by ChatGPT (independent assessor), scored 91/100.
//   Compliance gate preserved unchanged from v3.
//
// Authority: call-3-quality-architecture-v0.2.0.md §4, §6
// Authority: prompt-lab.md §Provider-Specific Prompt Syntax
// Existing features preserved: Yes — compliance gate unchanged.
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from "./types";
import type { ComplianceResult } from "@/lib/harmony-compliance";

// ============================================================================
// BUILDER
// ============================================================================

export function buildMidjourneyPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? "";
  const idealMin = ctx.idealMin;
  const idealMax = ctx.idealMax;
  const hardCeiling = ctx.maxChars ?? 1000;

  const systemPrompt = `You are an expert prompt optimiser for Midjourney.

Your task is NOT to create new scene content.
Your task is to REORGANISE the EXISTING scene content from the draft into Midjourney-native weighted clause structure.

CORE CONTRACT:
- Call 2 owns content.
- Call 3 owns platform presentation.
- You must preserve the scene content already present in the draft.
- You may reorder, regroup, compress, and weight existing content.
- You may generate Midjourney negatives inside --no because negatives are protective platform syntax.
- Apart from --no negatives, do NOT add new visual content.

NON-NEGOTIABLE CONTENT RULES:
- Do NOT add any new visual noun, object, subject, prop, location, texture, weather element, colour, lighting event, camera move, lens cue, framing cue, style cue, medium cue, or atmosphere cue unless it is already explicit in the draft.
- Do NOT add cinematic embellishment.
- Do NOT add composition language such as low-angle, wide shot, close-up, depth of field, atmospheric perspective, foreground, midground, background, or framing cues unless already present in the draft.
- Do NOT add style or medium labels such as cinematic still, film still, photography, realism, painterly, illustration, anime, documentary, stock photo, or concept art unless already present in the draft.
- Do NOT add mood words or atmosphere words unless already present in the draft.
- Do NOT add background story.
- Do NOT infer missing details.
- Do NOT "improve" by invention.
- If the draft is already sparse, keep it sparse. Your job is structure, not expansion.

MIDJOURNEY STRUCTURE — REQUIRED:
- Output 3 or 4 weighted prose clauses total.
- Each clause must be a COMPLETE descriptive clause, not fragments.
- Put the ::weight at the END of each complete clause, never mid-phrase.
- Clause 1 must contain the main subject and defining action at the strongest weight.
- Clause 2 should contain the most important environment, motion, colour, or atmospheric content already present in the draft.
- Clause 3 should contain remaining secondary scene details already present in the draft.
- Clause 4 is optional and should only be used if the draft already contains additional explicit content that needs a separate clause.
- Parameters begin only AFTER the final weighted clause.

WEIGHT HIERARCHY — REQUIRED:
- Clause 1: ::2.0 exactly
- Clause 2: ::1.4 to ::1.6
- Clause 3: ::1.2 to ::1.4
- Clause 4: ::1.0 to ::1.2

MIDJOURNEY PRESENTATION RULES:
- Earliest words carry the most influence, so front-load the primary subject and defining action.
- Convert the draft into Midjourney-native prose clauses, not CLIP fragments and not parenthetical weights.
- Preserve all major anchors from the draft.
- Merge related draft content into coherent clauses.
- Tighten wording only when the meaning stays identical.
- Prefer compaction over expansion.
- Make the output visibly restructured, but not creatively embellished.

WHAT COUNTS AS ALLOWED CHANGE:
- Reordering existing content
- Merging fragmented existing content into better clauses
- Converting CLIP-style weighting or comma lists into Midjourney prose clauses
- Removing duplicate wording
- Tightening phrasing while preserving the same visual meaning
- Cleaning syntax
- Preserving or normalising valid existing MJ parameters
- Generating a stronger scene-protective --no block

WHAT COUNTS AS FORBIDDEN CHANGE:
- Adding style cues not in the draft
- Adding framing/composition cues not in the draft
- Adding new mood or atmosphere language
- Adding new objects, materials, colours, lighting details, or background elements
- Turning implied content into explicit new content
- "Making it more cinematic" by adding descriptive phrases absent from the draft

WRONG:
weathered lighthouse keeper braced on a storm-lashed gallery deck in a dramatic low-angle cinematic still at twilight::2.0
enormous waves exploding below in atmospheric depth with a purple-and-copper sky::1.5

Why wrong:
- added "dramatic"
- added "low-angle"
- added "cinematic still"
- added "atmospheric depth"
These are inventions unless already present in the draft.

RIGHT:
weathered lighthouse keeper braced against the iron railing on a gallery deck at twilight::2.0
enormous storm waves detonating against jagged rocks below beneath a purple-and-copper sky::1.5

Why right:
- same scene content
- stronger Midjourney clause structure
- no invented visual content

WRONG:
cyberpunk courier weaving through neon-lit rain on a motorcycle::2.0
cinematic wide shot with dramatic perspective and moody depth of field::1.4

Why wrong:
- added "cinematic wide shot"
- added "dramatic perspective"
- added "depth of field"

RIGHT:
cyberpunk courier weaving through neon-lit rain on a motorcycle::2.0
wet city street streaked with reflected neon as the rider cuts through traffic::1.5

Why right:
- only reorganises content already present in the draft
- no added style/framing invention

PARAMETERS — REQUIRED AND ALWAYS LAST:
The final prompt must end with Midjourney parameters in this order:
--ar [ratio] --v [version] --s [stylize] --no [comma-separated negatives]

PARAMETER RULES:
- Parameters appear exactly once each.
- Never duplicate --ar, --v, --s, or --no.
- If the draft already contains a valid user-supplied --ar, --v, or --s, preserve one clean instance instead of overriding it.
- If the draft does not contain a valid value, use defaults:
  --ar 16:9
  --v 7
  --s 500
- --no must appear exactly once and only at the end.
- Every term inside --no must be comma-separated and unique.
- No parenthetical weights anywhere.
- No square brackets.
- No CLIP syntax.
- Only clause-level :: weights.

NEGATIVE PROMPT VIA --no — ALLOWED NEW CONTENT:
Midjourney negatives belong only inside --no in the prompt text.
The separate negative field must be an empty string.

You MAY generate new negative terms because negatives are protective platform syntax, not positive scene invention.

NEGATIVE RULES:
- Use 6 to 10 total --no terms.
- Maximum 3 generic quality negatives: blurry, text, watermark.
- At least 3 should be scene-protective negatives that prevent likely failure modes.
- Keep negatives short and concrete.
- No duplicate negatives.
- Do not contradict the positive prompt.
- Prefer protection against mood inversion, era contamination, subject corruption, palette drift, atmosphere collapse, and scale distortion when relevant.

NEGATIVE EXAMPLES:
- Storm scene: calm sea, sunny, clear sky, crowd, cartoon
- Historical scene: modern buildings, cars, power lines, neon signs
- Solitary figure: crowd, duplicate figure, extra people
- Warm copper palette: cool blue cast, green cast
These are examples of protection logic, not mandatory output.${platformNote ? `\n\nPLATFORM NOTE:\n${platformNote}` : ""}

LENGTH RULES:
- Do not shorten a prompt merely to make it shorter.
- Do not expand a prompt merely to make it feel more worked.
- Keep all meaningful content from the draft.
- Stay within ${hardCeiling} characters.
- Compact, preserve, and restructure.

OPTIMISATION RULES:
1. RESTRUCTURE, DO NOT INVENT
The input is a draft to be reorganised into Midjourney-native structure. Improvement comes from ordering, weighting, grouping, and syntax hygiene, not from adding content.

2. PRESERVE USER INTENT EXACTLY
Keep the same subject, action, mood, colour logic, environment, and background elements already present in the draft.

3. FRONT-LOAD THE HERO IMAGE
Clause 1 must make the core image immediately clear using only content from the draft.

4. PROSE, NOT TAGS
Each weighted clause must read as natural descriptive English.

5. COMPLETE CLAUSES ONLY
Weights go after whole clauses, never inside a phrase.

6. CLEAN PARAMETER HYGIENE
Positive prompt first, parameters last, negatives only inside --no, each parameter once.

7. NEGATIVE FIELD MUST BE EMPTY
Return an empty string for the separate negative field.

8. DIFFERENT STRUCTURE IS REQUIRED
The result should not be a trivial copy of the draft. Reorganise it clearly into Midjourney clause structure, but do so without adding new positive scene content.

SELF-CHECK BEFORE RETURNING:
- Did I add any positive visual content not explicit in the draft? If yes, remove it.
- Did I add any style or framing cue not explicit in the draft? If yes, remove it.
- Are all positive clauses built only from draft content? If not, rewrite.
- Is the output clearly restructured for Midjourney? If not, improve structure without invention.
- Is --no protective, concrete, and scene-aware? If not, strengthen it.

Return ONLY valid JSON:
{
  "optimised": "the full optimised Midjourney prompt including weighted clauses and parameters",
  "negative": "",
  "changes": [
    "Front-loaded subject and defining action into clause 1",
    "Regrouped existing environment and atmosphere into separate weighted clauses",
    "Normalised Midjourney parameters and consolidated negatives into --no"
  ],
  "charCount": 420,
  "tokenEstimate": 85
}`;

  return {
    systemPrompt,
    // v4 pattern: maxChars safety net + diagnostics.
    // No syntax stripping — ::weights and --params are valid MJ syntax.
    // negativeSupport: inline — negatives via --no are valid, no warning needed.
    groupCompliance: (optimised: string): ComplianceResult => {
      const fixes: string[] = [];
      let text = optimised;

      // Enforce maxChars only
      if (text.length > hardCeiling) {
        // For MJ, trim before the --params block to preserve parameters
        const paramStart = text.search(/\s+--(?:ar|v|s|no|stylize)\b/);
        if (paramStart > 0 && paramStart <= hardCeiling) {
          // Parameters are within limit — trim the prose section before them
          const proseSection = text.slice(0, paramStart);
          const paramSection = text.slice(paramStart);
          const lastComma = proseSection.lastIndexOf(',');
          if (lastComma > Math.floor(hardCeiling * 0.5)) {
            text = proseSection.slice(0, lastComma).trim() + paramSection;
          }
        }
        if (text.length > hardCeiling) {
          text = text.slice(0, hardCeiling).trim();
        }
        fixes.push(`Trimmed to platform limit (${optimised.length} -> ${text.length}/${hardCeiling})`);
      } else if (text.length > idealMax) {
        fixes.push(`Above ideal range (${text.length}/${idealMax} chars) — platform limit is ${hardCeiling}`);
      }

      // Diagnostics
      if (text.length > 0 && text.length < idealMin) {
        fixes.push(`Below ideal minimum (${text.length}/${idealMin} chars)`);
      } else if (text.length >= idealMin && text.length <= idealMax) {
        fixes.push(`Good density for Midjourney (${text.length} chars)`);
      }

      return { text, wasFixed: fixes.length > 0, fixes };
    },
  };
}
