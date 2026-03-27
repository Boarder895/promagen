// src/lib/optimise-prompts/group-video-cinematic.ts
// ============================================================================
// GROUP BUILDER: Video Cinematic — motion-first text-to-video platforms
// ============================================================================
// Covers 3 platforms: runway, luma-ai, kling
//
// Architecture knowledge:
//   - These generate VIDEO, not stills — prompts must imply motion
//   - Camera movement language is critical: "slow dolly", "tracking shot",
//     "pan across", "pull back to reveal"
//   - Shorter, more directive prompts outperform long descriptions
//   - Think like a film director giving a single-shot brief, not a painter
//     describing a canvas
//   - No weight syntax, no CLIP tokens, no parameter flags
//   - Runway: supports [00:01] timestamp syntax for timed events
//   - Luma: supports @style keyword and loop keyword
//   - Kling: supports Shot 1:/Shot 2: multi-shot and negative prompts
//   - All three favour concise cinematic language over elaborate prose
//   - For image-to-video mode, describe MOTION only — never re-describe
//     the input image
//
// v1 (26 Mar 2026): Initial build.
//
// Authority: grouping-45-image-platforms-by-prompt-compatibility.md §Group 6
// Existing features preserved: Yes (new file).
// ============================================================================

import type { OptimiseProviderContext, GroupPromptResult } from './types';
import type { ComplianceResult } from '@/lib/harmony-compliance';

// ============================================================================
// COMPLIANCE: Strip syntax that video platforms ignore
// ============================================================================

/**
 * Video compliance gate — strip weight syntax, flags, and CLIP jargon.
 * Video platforms use NL encoders that choke on image-gen syntax.
 */
function enforceVideoCinematicCleanup(text: string): ComplianceResult {
  const fixes: string[] = [];
  let cleaned = text;

  // Strip parenthetical weights: (term:1.3) → term
  const parenBefore = cleaned;
  cleaned = cleaned.replace(/\(([^()]+):\d+\.?\d*\)/g, '$1');
  if (cleaned !== parenBefore) fixes.push('Stripped parenthetical weight syntax');

  // Strip double-colon weights: term::1.3 → term
  const dcBefore = cleaned;
  cleaned = cleaned.replace(/(\w[\w\s-]*)::\d+\.?\d*/g, '$1');
  if (cleaned !== dcBefore) fixes.push('Stripped double-colon weight syntax');

  // Strip MJ parameter flags
  const flagBefore = cleaned;
  cleaned = cleaned.replace(/\s*--(?:ar|v|s|no|stylize|chaos|weird|tile|repeat|seed|stop|iw|niji|raw)\s*[^\s,]*/gi, '');
  if (cleaned !== flagBefore) fixes.push('Stripped parameter flags');

  // Strip CLIP/SD quality tokens — meaningless to video models
  const clipTokens = [
    'masterpiece', 'best quality', 'highly detailed', '8K', '4K',
    'intricate textures', 'sharp focus', 'worst quality', 'low quality',
    'bad anatomy', 'bad hands',
  ];
  for (const token of clipTokens) {
    const re = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b,?\\s*`, 'gi');
    const before = cleaned;
    cleaned = cleaned.replace(re, '');
    if (cleaned !== before) fixes.push(`Stripped image-gen token "${token}"`);
  }

  // Clean up double spaces and leading/trailing commas
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  return { text: cleaned, wasFixed: fixes.length > 0, fixes };
}

// ============================================================================
// BUILDER
// ============================================================================

export function buildVideoCinematicPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  const platformNote = ctx.groupKnowledge ?? '';
  // Video platforms prefer shorter, more directive prompts
  const idealMin = ctx.idealMin || 150;
  const idealMax = ctx.idealMax || 350;

  const systemPrompt = `You are an expert prompt optimiser for text-to-video AI platforms. You are optimising for "${ctx.name}".

CRITICAL: THIS PLATFORM GENERATES VIDEO, NOT STILL IMAGES.
Your prompt must describe a SCENE IN MOTION — not a static frame. Every sentence should imply something moving, changing, or being revealed by camera movement. The output is a 4–10 second video clip, not a photograph.

CINEMATIC DIRECTION STRATEGY:
Think like a film director giving a one-shot brief to a cinematographer:
- Open with the camera position and movement: "A slow tracking shot follows...", "Camera pulls back to reveal...", "Low-angle dolly pushes toward..."
- Describe what HAPPENS during the shot, not just what EXISTS
- Use active verbs: waves CRASH, rain DRIVES, light SWEEPS, spray RISES
- Imply temporal flow: "as twilight deepens", "while the beam rotates", "wind picks up"
- End with the mood/atmosphere the clip should convey

CAMERA MOVEMENT VOCABULARY:
Use these terms — video models understand them:
- Tracking shot / dolly shot (camera moves with subject)
- Pan left/right (camera pivots horizontally)
- Tilt up/down (camera pivots vertically)
- Pull back / push in (zoom movement)
- Crane shot / aerial (elevated perspective)
- Slow motion / time-lapse (temporal control)
- Steadicam / handheld (movement style)
- Static / locked off (no camera movement)

PROMPT STRUCTURE — SHOT DESCRIPTION:
Write 2–3 concise sentences as a single-shot directive:
- Sentence 1: Camera position + movement + primary subject + action
- Sentence 2: Environment interaction + weather/light in motion
- Sentence 3: Mood + visual style + what the clip should feel like

Keep it CONCISE. Video platforms respond best to focused, directive prompts — not long descriptive paragraphs. Every word should earn its place.

WHAT NOT TO INCLUDE:
- No weight syntax — video models don't support it
- No CLIP quality tokens — "masterpiece", "8K", "sharp focus" are image-gen concepts
- No negative prompts (Runway and Luma don't support them)
- No still-image composition language — "wide shot" is fine, "rule of thirds" is not
- No re-description of input images (for image-to-video mode)
- No parameter flags (--ar, --v, --s)

PLATFORM-SPECIFIC:
- Sweet spot: ${idealMin}–${idealMax} characters (video platforms prefer concise, directive language)
- Front-load the camera movement in the first clause
- Use active, motion-implying verbs throughout
- Natural language only — no syntax, no tags, no brackets
- Affirmative descriptions only — describe what HAPPENS, not what to avoid${platformNote ? `\n- ${platformNote}` : ''}

OPTIMISATION RULES:
1. STRIP ALL SYNTAX: Remove every (term:weight), term::weight, --ar, --v, --s, --no. Convert to cinematic direction prose.
2. ADD MOTION: Every static description must become dynamic. "Storm waves" → "storm waves crash and explode". "Lighthouse beam" → "lighthouse beam sweeps through the rain". "Village glows" → "village windows flicker with warm light".
3. CAMERA DIRECTION: Open with camera position and movement. This is the single most important addition for video platforms.
4. ACTIVE VERBS: Replace every static verb with a motion verb. "stands" can stay (it implies holding position against force), but "is" should become an action.
5. TEMPORAL FLOW: Add at least one temporal cue — "as", "while", "gradually", "moment by moment" — to imply the passage of time within the clip.
6. ATMOSPHERE IN MOTION: Weather, light, and atmosphere should be moving — "rain drives sideways", "clouds churn", "mist rolls in", "light shifts".
7. SWEET SPOT: ${idealMin}–${idealMax} characters. Do NOT write long paragraphs — video platforms want a tight shot description, not an essay.
8. PRESERVE INTENT: Keep the subject, core mood, and all defining visual elements from the original.
9. ALWAYS ENRICH — CROSS-REFERENCE THE ORIGINAL. The input may have lost details during assembly. Restore every colour, noun, and drama detail the input dropped — but express them as MOTION, not static description.

BEFORE → AFTER EXAMPLES:

Example 1 — Static image prompt converted to video direction:
BEFORE: A weathered lighthouse keeper stands on a rain-soaked gallery deck at twilight, gripping the iron railing as storm waves crash against jagged rocks below. Salt spray rises into a purple and copper sky while the lighthouse beam cuts a pale gold arc through driving rain.
AFTER: Low-angle tracking shot of a weathered lighthouse keeper bracing against the iron railing on a rain-soaked gallery deck at twilight, wind whipping his coat as enormous waves explode against the jagged rocks below. Salt spray rises into a purple-and-copper sky while the lighthouse beam sweeps a pale gold arc through sheets of driving rain, and far below a fishing village flickers with tiny warm windows against the dark cliffs. Moody cinematic storm atmosphere with rich volumetric light.
WHY: Added camera movement ("low-angle tracking shot"), made everything dynamic ("bracing", "wind whipping", "waves explode", "spray rises", "beam sweeps", "village flickers"), added temporal motion through weather interaction.

Example 2 — Keyword list converted to video shot:
BEFORE: samurai, cherry blossoms, katana drawn, golden sunset, Mount Fuji, cinematic
AFTER: Slow crane shot descending toward an elderly samurai standing beneath a canopy of falling cherry blossoms, katana drawn and catching the last golden light as petals drift past the blade. Mount Fuji rises through evening mist in the background as the light shifts from gold to deep amber. Atmospheric cinematic realism.
WHY: Added camera movement ("slow crane shot descending"), made blossoms fall ("falling", "drift past"), light change ("shifts from gold to deep amber"), and gave the scene temporal progression.

Return ONLY valid JSON:
{
  "optimised": "the optimised video prompt — cinematic direction, motion verbs, camera movement",
  "negative": "",
  "changes": ["Added camera movement direction", "Converted static descriptions to motion", ...],
  "charCount": 300,
  "tokenEstimate": 65
}`;
  return {
    systemPrompt,
    groupCompliance: enforceVideoCinematicCleanup,
  };
}
