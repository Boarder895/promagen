// src/lib/call-2-harness/mechanical-scorer/quality-rules.ts
// ============================================================================
// Call 2 Quality Harness — Content Quality Rules (Phase 1)
// ============================================================================
// 9 new rules that measure content quality — the gap between 28/29 HEALTHY
// structural compliance and a manual score of 61/68/70. Structural compliance
// without content quality is a passing MOT on a car with no engine.
//
// Rule IDs from api-call-2-v2_1_0.md §11.2:
//   T1.no_orphaned_adjectives         → Aim 7 (redundancy), Aim 2 (T1 nativeness)
//   T1.no_clip_unusable_jargon        → Aim 6 (technical conversion), Aim 2 (T1 nativeness)
//   T1.no_non_visual_literals          → Aim 6 (technical conversion), Aim 2 (T1 nativeness)
//   T1.no_duplicate_quality_families   → Aim 7 (redundancy)
//   T1.generic_quality_not_above_scene → Aim 4 (emphasis hierarchy)
//   T3.no_raw_camera_jargon            → Aim 6 (technical conversion), Aim 2 (T3 nativeness)
//   T3.no_raw_numeric_measurements     → Aim 6 (technical conversion), Aim 2 (T3 nativeness)
//   T4.no_raw_camera_jargon            → Aim 6 (technical conversion), Aim 2 (T4 nativeness)
//   T4.no_raw_numeric_measurements     → Aim 6 (technical conversion), Aim 2 (T4 nativeness)
//
// Authority: api-call-2-v2_1_0.md §11.2
// Existing features preserved: Yes (new file, no modifications to existing rules).
// ============================================================================

import type { RuleDefinition } from './types';

// ── Shared patterns ────────────────────────────────────────────────────────

/** Parenthetical weight syntax: (phrase:1.3) */
const PAREN_WEIGHT_RE = /\(([^):]+):(\d+\.\d+)\)/g;
/** Double-colon weight syntax: phrase::1.3 */
const DOUBLE_COLON_WEIGHT_RE = /(?:^|,)\s*([^,:()]+?)::(\d+\.\d+)/g;

interface WeightHit {
  readonly phrase: string;
  readonly weight: number;
  readonly position: number;
}

function extractWeights(text: string): WeightHit[] {
  const hits: WeightHit[] = [];
  for (const m of text.matchAll(PAREN_WEIGHT_RE)) {
    const phrase = (m[1] ?? '').trim();
    const weight = Number.parseFloat(m[2] ?? '0');
    if (phrase.length > 0 && Number.isFinite(weight)) {
      hits.push({ phrase, weight, position: m.index ?? 0 });
    }
  }
  for (const m of text.matchAll(DOUBLE_COLON_WEIGHT_RE)) {
    const phrase = (m[1] ?? '').trim();
    const weight = Number.parseFloat(m[2] ?? '0');
    if (phrase.length > 0 && Number.isFinite(weight)) {
      hits.push({ phrase, weight, position: m.index ?? 0 });
    }
  }
  hits.sort((a, b) => a.position - b.position);
  return hits;
}

/**
 * Extract comma-separated tokens from T1 text, stripping weight wrappers.
 * Returns lowercased, trimmed tokens.
 */
function extractT1Tokens(text: string): string[] {
  // Remove weight wrappers: (phrase:1.3) → phrase, phrase::1.3 → phrase
  const stripped = text
    .replace(/\(([^):]+):\d+\.\d+\)/g, '$1')
    .replace(/([^,:()]+?)::\d+\.\d+/g, '$1');
  return stripped
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
}

// ── Camera / technical jargon patterns ─────────────────────────────────────
// These patterns detect raw camera/lens/measurement strings that should have
// been converted by convertPhotographyJargonTierAware() or stripped from T1.

/** Camera body names — hardware that CLIP cannot interpret */
const CAMERA_BODY_RE =
  /\b(?:Canon\s*(?:EOS|R\d|5D|6D|7D|1D|80D|90D|R[35])|Nikon\s*(?:Z\d|D\d{3,4}|Z[579])|Sony\s*(?:A\d{4}|A[79](?:R?\s*(?:III|IV|V))?|FX\d)|Fuji(?:film)?\s*(?:X-[TESH]\d|GFX)|Leica\s*(?:M\d{1,2}|SL\d?|Q\d?)|Hasselblad\s*(?:X\d|907|H\d)|Panasonic\s*(?:GH\d|S\d|G\d)|Olympus\s*(?:OM-\d|E-M\d)|Pentax\s*(?:K-\d|645)|Phase\s*One|Ricoh\s*GR|Sigma\s*fp)\b/i;

/** Lens specifications — focal length + aperture combos */
const LENS_SPEC_RE =
  /\b\d{1,3}(?:-\d{1,3})?\s*mm\s*(?:f\/?\d+\.?\d*)?|\bf\/?\d+\.?\d+\b|\b(?:f-stop|focal\s*length|aperture)\s*(?:of\s*)?\d/i;

/** ISO / shutter speed / exposure values */
const EXPOSURE_RE =
  /\bISO\s*\d{2,6}\b|\b1\/\d{2,5}\s*(?:s|sec(?:ond)?s?)?\b|\bshutter\s*speed\b/i;

/** Raw numeric measurements: distances, speeds, temperatures, compass directions */
const NUMERIC_MEASUREMENT_RE =
  /\b\d+(?:\.\d+)?\s*(?:km\/h|mph|m\/s|knots|degrees?|°[CF]|cm|mm|metres?|meters?|feet|ft|inches?|in)\b|\b(?:north|south|east|west)(?:-?(?:north|south|east|west))?(?:erly|ern)?\b/i;

/** Bare adjectives that are orphaned tokens in T1 — visual-context-free */
const ORPHAN_ADJECTIVE_RE =
  /^(?:beautiful|stunning|amazing|gorgeous|wonderful|incredible|breathtaking|magnificent|spectacular|lovely|perfect|awesome|epic|dramatic|elegant|graceful|delicate|subtle|intense|vivid)$/i;

/** CLIP-unusable jargon — hardware names that CLIP treats as noise */
const CLIP_UNUSABLE_JARGON_RE =
  /\b(?:Canon|Nikon|Sony|Fuji(?:film)?|Leica|Hasselblad|Panasonic|Olympus|Pentax|Phase\s*One|Ricoh|Sigma)\b|\b(?:EOS|DSLR|mirrorless)\b/i;

/** Non-visual literals — abstract concepts CLIP can't render */
const NON_VISUAL_LITERAL_RE =
  /\b(?:ISO\s*\d+|f\/?\d+\.?\d*|\d{1,3}mm\s+lens|\bshutter\s*speed\b|\bexposure\s*time\b|\bfocal\s*length\b|\baperture\b)\b/i;

/**
 * Quality-family groupings for deduplication — aligned with the code
 * enforcer's families in harmony-compliance.ts deduplicateQualityTokens().
 *
 * CRITICAL: The system prompt intentionally instructs BOTH a quality prefix
 * ("masterpiece, best quality, highly detailed") and a quality suffix
 * ("sharp focus, 8K, intricate textures"). These are deliberately paired.
 * The rule must NOT flag the instructed prefix+suffix scaffold as duplicates.
 *
 * The rule SHOULD flag: GPT inventing EXTRA tokens that duplicate the
 * instructed scaffold (e.g. "ultra detailed" when "highly detailed" is
 * already present, or "4K" when "8K" is already present).
 */
const QUALITY_FAMILIES: ReadonlyArray<{
  readonly name: string;
  readonly members: readonly string[];
}> = [
  // Family 0: matches code enforcer family 0
  { name: 'sharpness', members: ['sharp focus', 'crisp detail', 'clear detail', 'crisp tonal rendering', 'tack sharp', 'razor sharp'] },
  // Family 1: matches code enforcer family 1
  { name: 'resolution', members: ['8k', '4k', 'uhd', 'high resolution', 'ultra hd'] },
  // Family 2: matches code enforcer family 2 — BUT does NOT cross-match
  // "highly detailed" with "intricate textures" because the prompt instructs
  // one as prefix and the other as suffix. They are in the same code-enforcer
  // family for dedup purposes, but the suffix-restore puts the suffix back.
  // The rule should catch: "highly detailed" + "ultra detailed" (same prefix slot),
  // or "intricate textures" + "detailed textures" (same suffix slot).
  { name: 'detail_prefix', members: ['highly detailed', 'ultra detailed', 'extremely detailed'] },
  { name: 'detail_suffix', members: ['intricate textures', 'detailed textures', 'rich textures', 'fine textures'] },
  // Family 3: matches code enforcer family 3
  { name: 'cleanliness', members: ['clean image', 'unmarked'] },
  // Family 4: matches code enforcer family 4
  { name: 'colour_balance', members: ['balanced colours', 'balanced colors'] },
  // Additional families not in the code enforcer (harness-only detection)
  { name: 'quality_label', members: ['best quality', 'high quality', 'top quality', 'highest quality', 'premium quality'] },
  { name: 'masterpiece', members: ['masterpiece', 'masterwork', 'award-winning', 'award winning'] },
  { name: 'realism', members: ['photorealistic', 'photo-realistic', 'hyperrealistic', 'hyper-realistic', 'photoreal'] },
];

/**
 * Check if a T1 token belongs to a quality family. Returns the family name
 * or null. Uses EXACT phrase matching (the token must CONTAIN the full
 * member phrase), not substring on individual words.
 */
function findQualityFamily(token: string): string | null {
  const lower = token.toLowerCase();
  for (const family of QUALITY_FAMILIES) {
    for (const member of family.members) {
      if (lower.includes(member)) return family.name;
    }
  }
  return null;
}

/** Generic quality terms that should never outweight scene content */
const GENERIC_QUALITY_TERMS = new Set([
  'masterpiece', 'best quality', 'highly detailed', 'ultra detailed',
  'high quality', '8k', '4k', 'sharp focus', 'intricate',
  'detailed textures', 'high resolution', 'photorealistic',
  'hyper-realistic', 'professional', 'stunning', 'beautiful',
  'amazing', 'gorgeous', 'breathtaking', 'uhd', 'hdr',
]);

// ── Rule definitions ───────────────────────────────────────────────────────

export const QUALITY_RULES: readonly RuleDefinition[] = Object.freeze([
  // ── Q1: T1 — no orphaned adjectives ────────────────────────────────────
  {
    id: 'T1.no_orphaned_adjectives',
    tier: 1 as const,
    cluster: 'value_add_filler' as const,
    description:
      'T1 must not contain bare adjectives (beautiful, stunning, etc.) as standalone ' +
      'weighted tokens. Adjectives must be paired with visual nouns.',
    check(bundle) {
      const tokens = extractT1Tokens(bundle.tier1.positive);
      const orphans: string[] = [];

      for (const token of tokens) {
        // Single-word token that matches the orphan list
        const words = token.split(/\s+/).filter(Boolean);
        if (words.length === 1 && ORPHAN_ADJECTIVE_RE.test(token)) {
          orphans.push(token);
        }
      }

      if (orphans.length > 0) {
        return {
          passed: false,
          details: `Orphaned adjectives: ${orphans.slice(0, 4).join(', ')}`,
        };
      }
      return { passed: true };
    },
  },

  // ── Q2: T1 — no CLIP-unusable jargon ───────────────────────────────────
  {
    id: 'T1.no_clip_unusable_jargon',
    tier: 1 as const,
    cluster: 'value_add_filler' as const,
    description:
      'T1 must not contain camera body/brand names or hardware jargon that CLIP ' +
      'cannot interpret visually. "Leica SL2-S" wastes T1 token budget.',
    check(bundle) {
      const text = bundle.tier1.positive;
      const hits = extractWeights(text);
      const offenders: string[] = [];

      for (const hit of hits) {
        if (CLIP_UNUSABLE_JARGON_RE.test(hit.phrase)) {
          offenders.push(hit.phrase);
        }
      }

      // Also check unweighted tokens
      const tokens = extractT1Tokens(text);
      for (const token of tokens) {
        if (CLIP_UNUSABLE_JARGON_RE.test(token)) {
          // Avoid double-counting if already found in weighted hits
          if (!offenders.some((o) => token.includes(o.toLowerCase()))) {
            offenders.push(token);
          }
        }
      }

      if (offenders.length > 0) {
        return {
          passed: false,
          details: `CLIP-unusable jargon in T1: ${offenders.slice(0, 3).join(', ')}`,
        };
      }
      return { passed: true };
    },
  },

  // ── Q3: T1 — no non-visual literals ────────────────────────────────────
  {
    id: 'T1.no_non_visual_literals',
    tier: 1 as const,
    cluster: 'value_add_filler' as const,
    description:
      'T1 must not contain non-visual literal specs (ISO values, f-stops, focal ' +
      'lengths, shutter speeds) that CLIP cannot render. These should be converted ' +
      'to visual effects or stripped.',
    check(bundle) {
      const text = bundle.tier1.positive;
      const matches: string[] = [];

      // Check weighted phrases
      for (const hit of extractWeights(text)) {
        if (NON_VISUAL_LITERAL_RE.test(hit.phrase)) {
          matches.push(hit.phrase);
        }
      }

      // Check unweighted tokens
      for (const token of extractT1Tokens(text)) {
        if (NON_VISUAL_LITERAL_RE.test(token) && !matches.some((m) => token.includes(m.toLowerCase()))) {
          matches.push(token);
        }
      }

      if (matches.length > 0) {
        return {
          passed: false,
          details: `Non-visual literals in T1: ${matches.slice(0, 3).join(', ')}`,
        };
      }
      return { passed: true };
    },
  },

  // ── Q4: T1 — no duplicate quality families ─────────────────────────────
  {
    id: 'T1.no_duplicate_quality_families',
    tier: 1 as const,
    cluster: 'value_add_filler' as const,
    description:
      'T1 must not contain more than one token from the same quality family. ' +
      '"highly detailed" + "ultra detailed" = wasted budget. The prompt-instructed ' +
      'prefix ("highly detailed") and suffix ("intricate textures") are in separate ' +
      'families and do not count as duplicates.',
    check(bundle) {
      const tokens = extractT1Tokens(bundle.tier1.positive);
      const familyHits: Map<string, string[]> = new Map();

      for (const token of tokens) {
        const family = findQualityFamily(token);
        if (family) {
          const existing = familyHits.get(family) ?? [];
          // Avoid counting the same token twice (e.g. if it matches via two members)
          if (!existing.includes(token)) {
            existing.push(token);
            familyHits.set(family, existing);
          }
        }
      }

      const duplicates: string[] = [];
      for (const [family, hits] of familyHits) {
        if (hits.length > 1) {
          duplicates.push(`${family}: [${hits.join(', ')}]`);
        }
      }

      if (duplicates.length > 0) {
        return {
          passed: false,
          details: `Duplicate quality families: ${duplicates.slice(0, 3).join('; ')}`,
        };
      }
      return { passed: true };
    },
  },

  // ── Q5: T1 — generic quality tokens must not outweight scene content ───
  {
    id: 'T1.generic_quality_not_above_scene',
    tier: 1 as const,
    cluster: 'subject_salience_loss' as const,
    description:
      'Generic quality tokens (masterpiece, 8k, etc.) must not carry higher weight ' +
      'than scene-specific content. Quality boilerplate at 1.3 while the actual scene ' +
      'sits at 1.1 means the emphasis hierarchy is inverted.',
    check(bundle) {
      const hits = extractWeights(bundle.tier1.positive);
      if (hits.length < 3) return { passed: true }; // Too few weights to evaluate

      let maxQualityWeight = 0;
      let maxSceneWeight = 0;
      let qualityTerm = '';
      let sceneTerm = '';

      for (const hit of hits) {
        const isGeneric = GENERIC_QUALITY_TERMS.has(hit.phrase.toLowerCase());
        if (isGeneric) {
          if (hit.weight > maxQualityWeight) {
            maxQualityWeight = hit.weight;
            qualityTerm = hit.phrase;
          }
        } else {
          if (hit.weight > maxSceneWeight) {
            maxSceneWeight = hit.weight;
            sceneTerm = hit.phrase;
          }
        }
      }

      // If no generic or no scene tokens, pass (nothing to compare)
      if (maxQualityWeight === 0 || maxSceneWeight === 0) return { passed: true };

      if (maxQualityWeight > maxSceneWeight) {
        return {
          passed: false,
          details:
            `Generic "${qualityTerm}" at ${maxQualityWeight} outweighs ` +
            `scene "${sceneTerm}" at ${maxSceneWeight}`,
        };
      }
      return { passed: true };
    },
  },

  // ── Q6: T3 — no raw camera jargon ──────────────────────────────────────
  {
    id: 'T3.no_raw_camera_jargon',
    tier: 3 as const,
    cluster: 'tier_drift' as const,
    description:
      'T3 must not contain raw camera body names, lens specs, or exposure values. ' +
      'These should have been converted to visual-effect descriptions by ' +
      'convertPhotographyJargonTierAware().',
    check(bundle) {
      const text = bundle.tier3.positive;
      const found: string[] = [];

      if (CAMERA_BODY_RE.test(text)) {
        const match = text.match(CAMERA_BODY_RE);
        if (match) found.push(match[0]);
      }
      if (LENS_SPEC_RE.test(text)) {
        const match = text.match(LENS_SPEC_RE);
        if (match) found.push(match[0]);
      }
      if (EXPOSURE_RE.test(text)) {
        const match = text.match(EXPOSURE_RE);
        if (match) found.push(match[0]);
      }

      if (found.length > 0) {
        return {
          passed: false,
          details: `Raw camera jargon in T3: ${found.join(', ')}`,
        };
      }
      return { passed: true };
    },
  },

  // ── Q7: T3 — no raw numeric measurements ──────────────────────────────
  {
    id: 'T3.no_raw_numeric_measurements',
    tier: 3 as const,
    cluster: 'tier_drift' as const,
    description:
      'T3 must not contain raw numeric measurements (15 km/h, 30 degrees, ' +
      'south-westerly). These should be converted to visual equivalents.',
    check(bundle) {
      const text = bundle.tier3.positive;
      const match = text.match(NUMERIC_MEASUREMENT_RE);

      if (match) {
        return {
          passed: false,
          details: `Raw numeric measurement in T3: "${match[0]}"`,
        };
      }
      return { passed: true };
    },
  },

  // ── Q8: T4 — no raw camera jargon ──────────────────────────────────────
  {
    id: 'T4.no_raw_camera_jargon',
    tier: 4 as const,
    cluster: 'tier_drift' as const,
    description:
      'T4 must not contain raw camera body names, lens specs, or exposure values. ' +
      'A casual user should never see "Leica SL2-S" or "f/1.4" in T4.',
    check(bundle) {
      const text = bundle.tier4.positive;
      const found: string[] = [];

      if (CAMERA_BODY_RE.test(text)) {
        const match = text.match(CAMERA_BODY_RE);
        if (match) found.push(match[0]);
      }
      if (LENS_SPEC_RE.test(text)) {
        const match = text.match(LENS_SPEC_RE);
        if (match) found.push(match[0]);
      }
      if (EXPOSURE_RE.test(text)) {
        const match = text.match(EXPOSURE_RE);
        if (match) found.push(match[0]);
      }

      if (found.length > 0) {
        return {
          passed: false,
          details: `Raw camera jargon in T4: ${found.join(', ')}`,
        };
      }
      return { passed: true };
    },
  },

  // ── Q9: T4 — no raw numeric measurements ──────────────────────────────
  {
    id: 'T4.no_raw_numeric_measurements',
    tier: 4 as const,
    cluster: 'tier_drift' as const,
    description:
      'T4 must not contain raw numeric measurements. A casual user should never ' +
      'see "15 km/h" or "south-westerly" — convert to visual language.',
    check(bundle) {
      const text = bundle.tier4.positive;
      const match = text.match(NUMERIC_MEASUREMENT_RE);

      if (match) {
        return {
          passed: false,
          details: `Raw numeric measurement in T4: "${match[0]}"`,
        };
      }
      return { passed: true };
    },
  },
]);
