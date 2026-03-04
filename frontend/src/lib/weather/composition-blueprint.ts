// src/lib/weather/composition-blueprint.ts
// ============================================================================
// SCENE COMPOSITION BLUEPRINT — Extra 5 (Unified Brain)
// ============================================================================
//
// v1.0.0 (Mar 2026) — Analyses a WeatherCategoryMap and outputs a structured
// composition recommendation: foreground element (materials/action), midground
// focus point (subject/environment), background layer (lighting/atmosphere),
// plus suggested depth-of-field and focal plane based on camera lens data.
//
// WHY THIS MATTERS:
//   Composition is the ONLY category that's never weather-populated. Every
//   other category gets either a vocabulary match or a rich physics phrase.
//   This module fills the gap so every showcase prompt arrives with all 12
//   categories populated, giving the "Try in" builder a complete scene.
//
// The blueprint feeds into the category mapper's composition field, producing
// both a `selections` match (short composition phrase for dropdown) and a
// `customValues` rich phrase (the full compositional instruction).
//
// Existing features preserved: Yes — purely additive. The existing
// getComposition() in weather-prompt-generator.ts remains untouched.
// This module produces richer, layered output that supersedes it when present.
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import type { WeatherCategoryMap } from '@/types/prompt-builder';
import type { CameraLensResult } from './camera-lens';
import type { VenueSetting } from './prompt-types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Depth-of-field descriptor based on lens characteristics.
 *
 * Depth-of-field (DoF) = the range of distance in a scene that appears
 * acceptably sharp. A wide aperture (f/1.4) gives shallow DoF (blurry
 * background), while a narrow aperture (f/8) gives deep DoF (everything sharp).
 */
export type DepthOfField = 'shallow' | 'moderate' | 'deep';

/**
 * Focal plane — which depth layer the lens focuses on.
 *
 * The focal plane determines what's sharpest in the image. A portrait lens
 * on a narrow street focuses midground (the subject); a wide lens at an
 * elevated viewpoint focuses background (the skyline).
 */
export type FocalPlane = 'foreground' | 'midground' | 'background';

/**
 * A single scene layer in the composition blueprint.
 */
export interface SceneLayer {
  /** Which prompt categories contribute to this layer */
  sourceCategories: PromptCategory[];
  /** Key phrase describing what's in this layer */
  description: string;
  /** Whether this layer is the focal point (sharpest) */
  isFocalPoint: boolean;
}

/**
 * Complete scene composition blueprint.
 */
export interface CompositionBlueprint {
  /** Near elements: materials, action, surface textures */
  foreground: SceneLayer;
  /** Focus point: subject, environment, primary scene content */
  midground: SceneLayer;
  /** Distant/ambient: lighting, atmosphere, sky */
  background: SceneLayer;
  /** Lens-derived depth-of-field */
  depthOfField: DepthOfField;
  /** Where the lens focuses */
  focalPlane: FocalPlane;
  /** Camera framing phrase (e.g., "low-angle architectural night shot") */
  framingPhrase: string;
  /** Full composition instruction for the prompt */
  compositionText: string;
  /** Short vocabulary-matched composition phrase for dropdown */
  compositionSelection: string;
  /** Confidence in the composition (0–1) */
  confidence: number;
}

// ============================================================================
// INPUT TYPE
// ============================================================================

export interface CompositionInput {
  /** The category map (may be partially populated — composition is what we're filling) */
  categoryMap: Omit<WeatherCategoryMap, 'selections' | 'customValues'> & {
    selections: Partial<Record<PromptCategory, string[]>>;
    customValues: Partial<Record<PromptCategory, string>>;
  };
  /** Camera lens result from getCameraLens() */
  camera: CameraLensResult;
  /** Venue setting type */
  venueSetting: VenueSetting | null;
  /** Whether it's night */
  isNight: boolean;
}

// ============================================================================
// DEPTH-OF-FIELD INFERENCE
// ============================================================================

/**
 * Infer depth-of-field from lens descriptor.
 *
 * Wide lenses (24mm, 35mm) typically give deeper DoF at the same aperture
 * compared to telephoto lenses (85mm, 200mm). The descriptor string from
 * camera-lens.ts tells us the lens class.
 */
function inferDepthOfField(lensDescriptor: string): DepthOfField {
  const d = lensDescriptor.toLowerCase();

  // Telephoto/portrait lenses → shallow DoF (creamy bokeh)
  if (d.includes('portrait') || d.includes('telephoto') || d.includes('macro')) {
    return 'shallow';
  }

  // Standard primes (35mm, 50mm) → moderate DoF
  if (d.includes('standard') || d.includes('prime') || d.includes('50mm')) {
    return 'moderate';
  }

  // Wide angle → deep DoF (everything sharp)
  if (d.includes('wide') || d.includes('ultra-wide')) {
    return 'deep';
  }

  // Default: moderate
  return 'moderate';
}

/**
 * Infer focal plane from venue setting and lens type.
 *
 * Elevated viewpoints with wide lenses focus background (skyline).
 * Markets/narrow streets focus midground (people, stalls, architecture).
 * Monuments/temples with telephoto focus foreground detail.
 */
function inferFocalPlane(
  venueSetting: VenueSetting | null,
  lensDescriptor: string,
): FocalPlane {
  const tele =
    lensDescriptor.toLowerCase().includes('portrait') ||
    lensDescriptor.toLowerCase().includes('telephoto') ||
    lensDescriptor.toLowerCase().includes('macro');

  switch (venueSetting) {
    case 'elevated':
      return tele ? 'midground' : 'background';
    case 'beach':
    case 'waterfront':
      return tele ? 'midground' : 'background';
    case 'monument':
      return tele ? 'foreground' : 'midground';
    case 'narrow':
      return 'midground';
    case 'market':
      return 'foreground';
    case 'park':
    case 'plaza':
      return tele ? 'midground' : 'background';
    case 'street':
    default:
      return 'midground';
  }
}

// ============================================================================
// LAYER EXTRACTION
// ============================================================================

/**
 * Extract the foreground layer from existing category map data.
 * Foreground = what's closest to the camera: materials, action, surface textures.
 */
function extractForeground(
  selections: Partial<Record<PromptCategory, string[]>>,
  customValues: Partial<Record<PromptCategory, string>>,
  isFocal: boolean,
): SceneLayer {
  const parts: string[] = [];
  const sources: PromptCategory[] = [];

  const materialsCustom = customValues.materials;
  if (materialsCustom) {
    parts.push(materialsCustom);
    sources.push('materials');
  }

  const actionCustom = customValues.action;
  if (actionCustom) {
    parts.push(actionCustom);
    sources.push('action');
  }

  // Fallback: if no custom values, check selections
  if (parts.length === 0) {
    const materialsSel = selections.materials;
    if (materialsSel?.length) {
      parts.push(materialsSel.join(', '));
      sources.push('materials');
    }
  }

  return {
    sourceCategories: sources.length > 0 ? sources : ['materials'],
    description: parts.length > 0 ? parts.join('; ') : 'textured ground surface',
    isFocalPoint: isFocal,
  };
}

/**
 * Extract the midground layer — the primary scene content.
 * Midground = subject, environment, the core of what the image depicts.
 */
function extractMidground(
  selections: Partial<Record<PromptCategory, string[]>>,
  customValues: Partial<Record<PromptCategory, string>>,
  isFocal: boolean,
): SceneLayer {
  const parts: string[] = [];
  const sources: PromptCategory[] = [];

  // Subject (city name, venue)
  const subjectCustom = customValues.subject;
  const subjectSel = selections.subject;
  if (subjectCustom) {
    parts.push(subjectCustom);
    sources.push('subject');
  } else if (subjectSel?.length) {
    parts.push(subjectSel.join(', '));
    sources.push('subject');
  }

  // Environment (venue name)
  const envSel = selections.environment;
  if (envSel?.length) {
    parts.push(envSel.join(', '));
    sources.push('environment');
  }

  return {
    sourceCategories: sources.length > 0 ? sources : ['subject', 'environment'],
    description: parts.length > 0 ? parts.join(' — ') : 'urban scene',
    isFocalPoint: isFocal,
  };
}

/**
 * Extract the background layer — lighting, atmosphere, sky.
 * Background = what fills the space behind the subject.
 */
function extractBackground(
  selections: Partial<Record<PromptCategory, string[]>>,
  customValues: Partial<Record<PromptCategory, string>>,
  isFocal: boolean,
): SceneLayer {
  const parts: string[] = [];
  const sources: PromptCategory[] = [];

  // Lighting
  const lightCustom = customValues.lighting;
  const lightSel = selections.lighting;
  if (lightCustom) {
    parts.push(lightCustom);
    sources.push('lighting');
  } else if (lightSel?.length) {
    parts.push(lightSel.join(', '));
    sources.push('lighting');
  }

  // Atmosphere
  const atmosCustom = customValues.atmosphere;
  const atmosSel = selections.atmosphere;
  if (atmosCustom) {
    parts.push(atmosCustom);
    sources.push('atmosphere');
  } else if (atmosSel?.length) {
    parts.push(atmosSel.join(', '));
    sources.push('atmosphere');
  }

  return {
    sourceCategories: sources.length > 0 ? sources : ['lighting', 'atmosphere'],
    description: parts.length > 0 ? parts.join('; ') : 'ambient lighting',
    isFocalPoint: isFocal,
  };
}

// ============================================================================
// FRAMING PHRASE GENERATION
// ============================================================================

/**
 * Venue-setting-to-framing lookup, lens-aware.
 * Produces the same quality as getComposition() in the generator but with
 * richer depth-layer awareness.
 */
function getFramingPhrase(
  venueSetting: VenueSetting | null,
  isNight: boolean,
  lensDescriptor: string,
): string {
  const tele =
    lensDescriptor.toLowerCase().includes('portrait') ||
    lensDescriptor.toLowerCase().includes('telephoto') ||
    lensDescriptor.toLowerCase().includes('macro');

  switch (venueSetting) {
    case 'elevated':
      return tele
        ? 'compressed telephoto skyline view with layered depth'
        : 'wide panoramic establishing shot, foreground to horizon';
    case 'beach':
      return tele
        ? (isNight ? 'telephoto seascape night shot, shallow focus on surf detail' : 'telephoto seascape shot, compressed wave layers')
        : (isNight ? 'wide seascape night shot, deep focus shoreline to sky' : 'wide seascape shot, deep focus shoreline to sky');
    case 'waterfront':
      return tele
        ? 'compressed harbourfront detail, shallow focus on mooring elements'
        : 'wide harbourfront shot, boats-to-skyline depth';
    case 'monument':
      return isNight
        ? 'low-angle architectural night shot, leading lines to apex'
        : 'low-angle architectural shot, stepped depth from base to crown';
    case 'narrow':
      return 'eye-level alleyway shot, converging perspective lines';
    case 'market':
      return 'street-level documentary shot, layered stall depth';
    case 'park':
      return tele
        ? 'compressed parkland detail, foreground foliage bokeh'
        : 'wide parkland scene, grass-to-canopy depth layers';
    case 'plaza':
      return tele
        ? 'compressed plaza detail, shallow focus on architectural ornament'
        : 'wide open-square scene, pavement-to-facade depth';
    case 'street':
    default:
      return isNight
        ? 'street-level night photography, receding light pools creating depth'
        : 'street-level photography, natural perspective recession';
  }
}

/**
 * Build a short vocabulary-matched selection for the composition dropdown.
 * These are the terms that exist in the composition vocabulary JSON.
 */
function getCompositionVocabMatch(
  venueSetting: VenueSetting | null,
  isNight: boolean,
  tele: boolean,
): string {
  // Map to common composition vocabulary terms
  // v11.1.0 Upgrade 4: Each vocab match describes the photographic TECHNIQUE,
  // while the compositionText describes the SCENE. No word overlap allowed.
  //
  // v11.1.1 Upgrade 4b: Full audit — fixed 10 pairs where selection shared
  // words with framing text (e.g., "architectural framing" + "low-angle
  // architectural shot" → both said "architectural").
  switch (venueSetting) {
    case 'elevated':
      return tele ? 'long-lens stacking' : 'high vantage point';
    case 'beach':
    case 'waterfront':
      return tele ? 'telephoto layering' : 'environmental depth';
    case 'monument':
      return isNight ? 'upward night perspective' : 'upward perspective';
    case 'narrow':
      // v11.1.2: "converging geometry" → "vanishing-point framing"
      // Framing text says "converging perspective lines" — vocab selection
      // must not share "converging". Vanishing-point describes the same
      // photographic effect (lines meeting at a point) with zero word overlap.
      return 'vanishing-point framing';
    case 'market':
      return 'candid scene coverage';
    case 'park':
    case 'plaza':
      return tele ? 'selective focus' : 'deep focus landscape';
    case 'street':
    default:
      return isNight ? 'ambient light composition' : 'eye-level composition';
  }
}

// ============================================================================
// DoF PHRASE
// ============================================================================

/**
 * Human-readable DoF instruction for the prompt.
 */
function dofPhrase(dof: DepthOfField, focalPlane: FocalPlane): string {
  // v11.1.1 Improvement 4: Merged DoF + focal plane into single phrase.
  // Before: "moderate depth of field, midground tack-sharp" (two comma-separated concepts)
  // After:  "moderate depth of field with midground in sharp focus" (one flowing phrase)
  switch (dof) {
    case 'shallow':
      return `shallow depth of field with ${focalPlane} in sharp focus, soft bokeh ${focalPlane === 'foreground' ? 'behind' : 'in front'}`;
    case 'deep':
      // Deep focus = entire scene sharp. When focalPlane is 'background',
      // saying 'from background through background' is nonsensical.
      // Deep DoF by definition covers foreground to background.
      return focalPlane === 'background'
        ? 'deep focus from foreground through background'
        : `deep focus from ${focalPlane} through background`;
    case 'moderate':
    default:
      return `moderate depth of field with ${focalPlane} in sharp focus`;
  }
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Compute a complete scene composition blueprint from a WeatherCategoryMap
 * and camera data. Returns structured layers plus a composition phrase
 * ready for the prompt.
 *
 * @param input - Category map, camera, venue, night state
 * @returns Blueprint with foreground/midground/background layers,
 *          DoF, focal plane, and composition strings
 */
export function computeCompositionBlueprint(input: CompositionInput): CompositionBlueprint {
  const { categoryMap, camera, venueSetting, isNight } = input;
  const { selections, customValues } = categoryMap;

  // Infer lens characteristics
  const dof = inferDepthOfField(camera.lensDescriptor);
  const focalPlane = inferFocalPlane(venueSetting, camera.lensDescriptor);

  // Extract scene layers
  const foreground = extractForeground(
    selections,
    customValues,
    focalPlane === 'foreground',
  );
  const midground = extractMidground(
    selections,
    customValues,
    focalPlane === 'midground',
  );
  const background = extractBackground(
    selections,
    customValues,
    focalPlane === 'background',
  );

  // Framing phrase (replaces basic getComposition)
  const framingPhrase = getFramingPhrase(venueSetting, isNight, camera.lensDescriptor);

  // Vocabulary-matched short selection
  const tele =
    camera.lensDescriptor.toLowerCase().includes('portrait') ||
    camera.lensDescriptor.toLowerCase().includes('telephoto') ||
    camera.lensDescriptor.toLowerCase().includes('macro');
  const compositionSelection = getCompositionVocabMatch(venueSetting, isNight, tele);

  // Build the full composition text
  // Structure: framing + depth-of-field + layer callouts
  const dofText = dofPhrase(dof, focalPlane);

  const layerParts: string[] = [];
  if (foreground.description !== 'textured ground surface') {
    layerParts.push(`foreground: ${foreground.description}`);
  }
  layerParts.push(`focus: ${midground.description}`);
  if (background.description !== 'ambient lighting') {
    layerParts.push(`background: ${background.description}`);
  }

  const compositionText = `${framingPhrase}, ${dofText}`;

  // Confidence: higher when we have more data to build from
  let confidence = 0.5; // base: we always have venue setting
  if (customValues.materials) confidence += 0.1;
  if (customValues.action) confidence += 0.05;
  if (customValues.lighting) confidence += 0.15;
  if (customValues.atmosphere) confidence += 0.1;
  if (selections.environment?.length) confidence += 0.1;
  confidence = Math.min(1, confidence);

  return {
    foreground,
    midground,
    background,
    depthOfField: dof,
    focalPlane,
    framingPhrase,
    compositionText,
    compositionSelection,
    confidence: Math.round(confidence * 100) / 100,
  };
}
