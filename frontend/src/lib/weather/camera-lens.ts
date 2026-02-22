// src/lib/weather/camera-lens.ts
// ============================================================================
// CAMERA + LENS METADATA — Platform-Aware Quality Tokens (v9.2.0 — Chat 3)
// ============================================================================
//
// Selects physically correct camera body + lens combos for the scene.
// Focal length is venue-driven (can't shoot 200mm in a narrow alley).
// Camera body is style-driven (photoreal = digital, cinematic = cinema).
//
// AI image generators trained on EXIF-tagged photography datasets respond
// strongly to camera/lens metadata — it controls depth of field, distortion,
// colour science, and perceived "look" more reliably than adjective lists.
//
// Existing features preserved: Yes (new file)
// ============================================================================

import { pickRandom } from './prng';
import type { PromptProfile, VenueSetting } from './prompt-types';

// ============================================================================
// CAMERA BODIES — Grouped by style profile
// ============================================================================

const BODIES_PHOTOREAL: readonly string[] = [
  'Canon EOS R5',
  'Sony A7R V',
  'Nikon Z8',
  'Fujifilm GFX 100S',
  'Leica SL2-S',
  'Sony A7 IV',
  'Canon EOS R6 Mark II',
];

const BODIES_CINEMATIC: readonly string[] = [
  'ARRI Alexa Mini LF',
  'RED V-Raptor',
  'Sony Venice 2',
  'Blackmagic URSA Mini Pro',
  'Canon C500 Mark II',
];

const BODIES_DOCUMENTARY: readonly string[] = [
  'Sony FX3',
  'Canon C70',
  'Leica Q3',
  'Fujifilm X-T5',
  'Ricoh GR IIIx',
  'Nikon Zf',
];

const STYLE_BODIES: Record<PromptProfile['style'], readonly string[]> = {
  photoreal: BODIES_PHOTOREAL,
  cinematic: BODIES_CINEMATIC,
  documentary: BODIES_DOCUMENTARY,
};

// ============================================================================
// LENSES — Grouped by focal-length class
// ============================================================================

interface LensOption {
  /** e.g. "24mm f/1.4" */
  spec: string;
  /** Short focal length descriptor for plain-language tiers */
  descriptor: string;
}

const LENSES_ULTRAWIDE: readonly LensOption[] = [
  { spec: '14mm f/2.8', descriptor: 'ultra-wide angle' },
  { spec: '16mm f/2.8', descriptor: 'ultra-wide angle' },
  { spec: '12-24mm f/2.8', descriptor: 'ultra-wide zoom' },
];

const LENSES_WIDE: readonly LensOption[] = [
  { spec: '24mm f/1.4', descriptor: 'wide angle' },
  { spec: '28mm f/2', descriptor: 'wide angle' },
  { spec: '20mm f/1.8', descriptor: 'wide angle' },
  { spec: '24-70mm f/2.8', descriptor: 'standard zoom' },
];

const LENSES_STANDARD: readonly LensOption[] = [
  { spec: '35mm f/1.4', descriptor: '35mm prime' },
  { spec: '50mm f/1.2', descriptor: '50mm prime' },
  { spec: '40mm f/2', descriptor: '40mm pancake' },
  { spec: '35mm f/2', descriptor: '35mm prime' },
  { spec: '50mm f/1.8', descriptor: 'nifty fifty' },
];

const LENSES_PORTRAIT: readonly LensOption[] = [
  { spec: '85mm f/1.4', descriptor: 'portrait lens' },
  { spec: '105mm f/2.8 macro', descriptor: 'macro lens' },
  { spec: '90mm f/2', descriptor: 'short telephoto' },
];

const LENSES_TELE: readonly LensOption[] = [
  { spec: '135mm f/1.8', descriptor: 'telephoto' },
  { spec: '200mm f/2.8', descriptor: 'telephoto' },
  { spec: '70-200mm f/2.8', descriptor: 'telephoto zoom' },
];

const LENSES_ANAMORPHIC: readonly LensOption[] = [
  { spec: '40mm T2 anamorphic', descriptor: 'anamorphic lens' },
  { spec: '50mm T2 anamorphic', descriptor: 'anamorphic lens' },
  { spec: '75mm T2.8 anamorphic', descriptor: 'anamorphic lens' },
  { spec: '35mm T2 anamorphic', descriptor: 'anamorphic lens' },
];

// ============================================================================
// LENS SELECTION LOGIC — Venue-driven focal length
// ============================================================================
// Physical rules:
//   - Narrow alley → can't be 200mm (no room, no subject separation)
//   - Elevated viewpoint → wide/ultrawide (showing expanse)
//   - Beach → either wide (seascape) or tele (compressed horizon)
//   - Street → standard 35–50mm (classic street photography)
//   - Cinematic style ALWAYS gets anamorphic option mixed in

type LensClass = 'ultrawide' | 'wide' | 'standard' | 'portrait' | 'tele';

const VENUE_LENS_WEIGHTS: Record<VenueSetting, LensClass[]> = {
  elevated:  ['ultrawide', 'wide', 'wide'],
  beach:     ['wide', 'wide', 'tele', 'standard'],
  waterfront: ['wide', 'standard', 'tele'],
  park:      ['standard', 'wide', 'portrait'],
  market:    ['standard', 'wide', 'standard'],
  plaza:     ['standard', 'wide', 'standard'],
  monument:  ['standard', 'portrait', 'wide'],
  street:    ['standard', 'standard', 'wide'],
  narrow:    ['standard', 'wide', 'standard'],
};

const DEFAULT_LENS_WEIGHTS: LensClass[] = ['standard', 'wide', 'standard', 'portrait'];

const LENS_CLASS_MAP: Record<LensClass, readonly LensOption[]> = {
  ultrawide: LENSES_ULTRAWIDE,
  wide: LENSES_WIDE,
  standard: LENSES_STANDARD,
  portrait: LENSES_PORTRAIT,
  tele: LENSES_TELE,
};

function selectLens(
  style: PromptProfile['style'],
  venueSetting: VenueSetting | null,
  seed: number,
): LensOption {
  // Cinematic style: 40% chance of anamorphic override
  if (style === 'cinematic') {
    const anamorphicRoll = ((seed * 2654435761) >>> 0) % 10;
    if (anamorphicRoll < 4) {
      return pickRandom(LENSES_ANAMORPHIC, seed * 1.7);
    }
  }

  // Venue-driven focal length class selection
  const weights = venueSetting
    ? (VENUE_LENS_WEIGHTS[venueSetting] ?? DEFAULT_LENS_WEIGHTS)
    : DEFAULT_LENS_WEIGHTS;

  // Pick a lens class from the weighted list
  const classIdx = ((seed * 2654435761) >>> 0) % weights.length;
  const lensClass = weights[classIdx] ?? 'standard';

  return pickRandom(LENS_CLASS_MAP[lensClass], seed * 1.3);
}

// ============================================================================
// PLATFORM-AWARE NEGATIVE PROMPTS (v9.2.0)
// ============================================================================
// Different platforms need different negative approaches:
//   T1 (CLIP/SD): Full negative prompt with comma-separated anti-tokens
//   T2 (MJ):      --no parameter (space-separated, no commas, max ~10 tokens)
//   T3 (DALL·E):  Inline "Avoid:" sentence (DALL·E ignores negative prompts)
//   T4 (Plain):   Inline "no X" suffix (weak parsers, keep simple)

/** T1 negative prompt — CLIP-tokenised, comma-separated */
const NEG_T1_BASE = [
  'text', 'watermark', 'logo', 'signature', 'blurry',
  'out of focus foreground', 'oversaturated', 'HDR artefacts',
] as const;

const NEG_T1_QUIET = [
  'people', 'person', 'crowd', 'pedestrian', 'silhouette',
] as const;

/** T2 --no tokens — MJ syntax: space-separated, no commas, keep tight.
 * v9.8.0: Removed 'blur' — it conflicts with atmospheric haze/mist which MJ
 * interprets as intentional softness. Keeping 'blur' in --no kills fog/mist looks. */
const NEG_T2_BASE = ['text', 'watermark', 'logo'] as const;
const NEG_T2_QUIET = ['people', 'person', 'crowd'] as const;

export function getNegativeT1(quiet: boolean): string {
  const parts = quiet
    ? [...NEG_T1_QUIET, ...NEG_T1_BASE]
    : [...NEG_T1_BASE];
  return parts.join(', ');
}

export function getMjNoParam(quiet: boolean): string {
  const parts = quiet
    ? [...NEG_T2_QUIET, ...NEG_T2_BASE]
    : [...NEG_T2_BASE];
  return `--no ${parts.join(' ')}`;
}

// ============================================================================
// PLATFORM-AWARE QUALITY TAGS (v9.2.0)
// ============================================================================
// Replaces STYLE_QUALITY_TAGS with camera-metadata-enriched versions.
// T1 (CLIP): Camera spec as weighted token + technical quality tags
// T2 (MJ):   Camera body alone (MJ interprets camera look natively)
// T3 (NL):   Woven into the ending sentence ("Shot on Canon EOS R5, 35mm...")
// T4 (Plain): Lens descriptor only ("wide angle, sharp focus")

/** Tier 1 quality tags: camera + lens + technical tokens */
export function getQualityTagsT1(
  camera: CameraLensResult,
  style: PromptProfile['style'],
): string[] {
  const base = [`shot on ${camera.full}`];
  switch (style) {
    case 'photoreal':
      return [...base, 'sharp focus', 'high resolution', 'professional photography'];
    case 'cinematic':
      return [...base, 'cinematic color grading', 'film grain', 'high resolution'];
    case 'documentary':
      return [...base, 'natural light', 'documentary photography', 'high resolution'];
  }
}

/**
 * Tier 2 quality suffix: camera + lens for MJ (it understands camera looks).
 * v9.8.0: Added lens spec — MJ responds more strongly to focal length + aperture
 * than to camera body alone. e.g. "shot on Sony A7R V, 35mm f/1.4"
 */
export function getQualityT2(camera: CameraLensResult): string {
  return `shot on ${camera.body}, ${camera.lensSpec}`;
}

/**
 * Tier 3 quality ending: camera metadata woven into the setting ending.
 * e.g. "Photorealistic, high-detail city scene. Shot on Canon EOS R5 with a 35mm f/1.4 lens."
 */
export function getQualityEndingT3(
  camera: CameraLensResult,
): string {
  return `Shot on ${camera.body} with a ${camera.lensSpec} lens.`;
}

/** Tier 4: just the descriptor ("wide angle") — enough for weak parsers */
export function getQualityT4(camera: CameraLensResult): string {
  return camera.lensDescriptor;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export interface CameraLensResult {
  /** Full spec: "Canon EOS R5, 35mm f/1.4" */
  full: string;
  /** Camera body only: "Canon EOS R5" */
  body: string;
  /** Lens spec only: "35mm f/1.4" */
  lensSpec: string;
  /** Natural descriptor: "35mm prime" */
  lensDescriptor: string;
}

/**
 * Select a camera body + lens combo appropriate for the scene.
 * Deterministic: same inputs → same result.
 */
export function getCameraLens(
  style: PromptProfile['style'],
  venueSetting: VenueSetting | null,
  seed: number,
): CameraLensResult {
  const bodies = STYLE_BODIES[style];
  const body = pickRandom(bodies, seed * 2.1);
  const lens = selectLens(style, venueSetting, seed);

  return {
    full: `${body}, ${lens.spec}`,
    body,
    lensSpec: lens.spec,
    lensDescriptor: lens.descriptor,
  };
}
