// src/lib/composition-engine.ts
// ============================================================================
// COMPOSITION ENGINE - Static and Dynamic Composition Pack Assembly
// ============================================================================
// Version 1.1.0
//
// FIXES in v1.1.0:
// - Fixed TypeScript error: getPlatformARSupport returns proper fallback
// - Fixed TypeScript error: hintArray[0] properly guarded against undefined
//
// The Composition Engine provides two modes for aspect ratio handling:
// - STATIC MODE: Fixed composition packs per AR (predictable, learnable)
// - DYNAMIC MODE: Context-aware packs assembled from all selections
//
// For platforms that support native AR (Midjourney family):
// - Appends --ar X:Y to prompt
// - Composition pack optional (based on mode)
//
// For platforms without native AR support:
// - Injects composition text into prompt
// - Text guides the model toward the intended framing
//
// Security:
// - All inputs validated against whitelists
// - No user-provided code execution
// - Type-safe throughout
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

import type { PromptSelections } from '@/types/prompt-builder';

// ============================================================================
// TYPES
// ============================================================================

/** Composition mode - static (fixed packs) or dynamic (context-aware) */
export type CompositionMode = 'static' | 'dynamic';

/** Aspect ratio identifier */
export type AspectRatioId =
  | '1:1'
  | '4:5'
  | '3:4'
  | '2:3'
  | '3:2'
  | '4:3'
  | '16:9'
  | '9:16'
  | '21:9';

/** AR orientation */
export type AROrientation = 'square' | 'portrait' | 'landscape';

/** Aspect ratio definition */
export interface AspectRatioDefinition {
  id: AspectRatioId;
  label: string;
  width: number;
  height: number;
  orientation: AROrientation;
  useCase: string;
  useCasePlatforms: string[];
  staticPack: string;
  dynamicHints: {
    placement: string[];
    framing: string[];
    depth: string[];
    emphasis: string[];
  };
}

/** Platform AR support */
export interface PlatformARSupport {
  nativeSupport: boolean;
  supportedRatios: AspectRatioId[];
  syntax: string | null;
  defaultRatio: AspectRatioId | null;
  notes: string;
}

/** Composition pack output */
export interface CompositionPack {
  /** The assembled composition text */
  text: string;
  /** Whether native AR parameter should be used */
  useNativeAR: boolean;
  /** The AR parameter string (e.g., "--ar 16:9") if applicable */
  arParameter: string | null;
  /** Mode used to generate this pack */
  mode: CompositionMode;
  /** Whether AR was supported natively by the platform */
  isNativelySupported: boolean;
}

// ============================================================================
// STATIC DATA - Aspect Ratios
// ============================================================================

const ASPECT_RATIOS: Record<AspectRatioId, AspectRatioDefinition> = {
  '1:1': {
    id: '1:1',
    label: 'Square',
    width: 1,
    height: 1,
    orientation: 'square',
    useCase: 'Social posts, avatars, album covers, icons',
    useCasePlatforms: ['Instagram profile', 'Spotify', 'App icons', 'LinkedIn'],
    staticPack: 'centred composition, symmetrical framing, balanced negative space',
    dynamicHints: {
      placement: ['centred', 'symmetrical'],
      framing: ['tight crop', 'balanced margins'],
      depth: ['minimal depth layers', 'flat focus plane'],
      emphasis: ['single focal point', 'equal visual weight'],
    },
  },
  '4:5': {
    id: '4:5',
    label: 'Portrait (Social)',
    width: 4,
    height: 5,
    orientation: 'portrait',
    useCase: 'Instagram feed, product shots, mobile-first',
    useCasePlatforms: ['Instagram feed', 'Facebook', 'Product photography'],
    staticPack: 'portrait framing, full-body, subject fills frame, clean background',
    dynamicHints: {
      placement: ['subject centred vertically', 'head near top third'],
      framing: ['full-body or three-quarter', 'minimal side margins'],
      depth: ['subject-background separation', 'shallow depth'],
      emphasis: ['subject dominates frame', 'background simplified'],
    },
  },
  '3:4': {
    id: '3:4',
    label: 'Portrait (Classic)',
    width: 3,
    height: 4,
    orientation: 'portrait',
    useCase: 'Phone wallpapers, editorial portraits, classic photography',
    useCasePlatforms: ['Mobile wallpaper', 'Print portrait', 'Editorial'],
    staticPack: 'vertical portrait composition, three-quarter body, balanced headroom',
    dynamicHints: {
      placement: ['classical portrait positioning', 'face in upper third'],
      framing: ['three-quarter body', 'breathing room above head'],
      depth: ['traditional portrait depth', 'background softness'],
      emphasis: ['face and expression focus', 'elegant proportions'],
    },
  },
  '2:3': {
    id: '2:3',
    label: 'Tall Portrait',
    width: 2,
    height: 3,
    orientation: 'portrait',
    useCase: 'Posters, fashion editorial, movie posters',
    useCasePlatforms: ['Movie posters', 'Fashion magazines', 'Pinterest'],
    staticPack: 'tall vertical poster layout, full-body with breathing room, editorial framing',
    dynamicHints: {
      placement: ['full figure with space above', 'poster-style positioning'],
      framing: ['full-body with context', 'dramatic vertical emphasis'],
      depth: ['layered vertical depth', 'environmental context'],
      emphasis: ['dramatic presence', 'editorial impact'],
    },
  },
  '3:2': {
    id: '3:2',
    label: 'Landscape (Classic)',
    width: 3,
    height: 2,
    orientation: 'landscape',
    useCase: 'Photography prints, DSLR output, classic landscape',
    useCasePlatforms: ['Print photography', 'Photo frames', 'Galleries'],
    staticPack: 'horizontal landscape composition, subject with environment context',
    dynamicHints: {
      placement: ['subject on thirds', 'horizon placement considered'],
      framing: ['subject plus environment', 'breathing room sides'],
      depth: ['foreground-midground-background', 'natural depth'],
      emphasis: ['subject-environment relationship', 'contextual storytelling'],
    },
  },
  '4:3': {
    id: '4:3',
    label: 'Landscape (Standard)',
    width: 4,
    height: 3,
    orientation: 'landscape',
    useCase: 'Presentations, web banners, standard monitors',
    useCasePlatforms: ['PowerPoint', 'Web headers', 'Traditional displays'],
    staticPack: 'classic landscape framing, balanced subject and background',
    dynamicHints: {
      placement: ['centred or rule of thirds', 'comfortable margins'],
      framing: ['subject with context', 'balanced composition'],
      depth: ['moderate depth layers', 'clear subject separation'],
      emphasis: ['clear focal hierarchy', 'professional balance'],
    },
  },
  '16:9': {
    id: '16:9',
    label: 'Widescreen',
    width: 16,
    height: 9,
    orientation: 'landscape',
    useCase: 'YouTube thumbnails, presentations, desktop wallpapers, cinematic',
    useCasePlatforms: ['YouTube', 'Desktop wallpaper', 'Presentations', 'TV'],
    staticPack:
      'wide establishing shot, cinematic framing, subject on rule of thirds, deep background',
    dynamicHints: {
      placement: ['subject on power third', 'action space opposite'],
      framing: ['wide establishing', 'cinematic bars implied'],
      depth: ['layered depth planes', 'foreground-mid-background'],
      emphasis: ['theatrical staging', 'environmental scale'],
    },
  },
  '9:16': {
    id: '9:16',
    label: 'Vertical Video',
    width: 9,
    height: 16,
    orientation: 'portrait',
    useCase: 'Stories, TikTok, Reels, mobile-first video',
    useCasePlatforms: ['TikTok', 'Instagram Stories', 'YouTube Shorts', 'Snapchat'],
    staticPack: 'vertical video framing, full-height subject, mobile-first composition',
    dynamicHints: {
      placement: ['subject fills height', 'centred horizontally'],
      framing: ['full-height portrait', 'minimal side context'],
      depth: ['stacked vertical layers', 'top-to-bottom flow'],
      emphasis: ['immediate impact', 'scroll-stopping presence'],
    },
  },
  '21:9': {
    id: '21:9',
    label: 'Ultrawide',
    width: 21,
    height: 9,
    orientation: 'landscape',
    useCase: 'Cinematic, panoramic, ultra-wide banners, film',
    useCasePlatforms: ['Cinema 2.39:1', 'Ultrawide monitors', 'Hero banners'],
    staticPack: 'panoramic ultrawide composition, sweeping vista, small subject for scale',
    dynamicHints: {
      placement: ['subject small in vast frame', 'extreme horizontal thirds'],
      framing: ['sweeping panoramic', 'letterbox aesthetic'],
      depth: ['epic depth of field', 'vast environmental scale'],
      emphasis: ['environment dominates', 'subject provides scale reference'],
    },
  },
};

// ============================================================================
// STATIC DATA - Platform AR Support
// ============================================================================

const PLATFORM_AR_SUPPORT: Record<string, PlatformARSupport> = {
  midjourney: {
    nativeSupport: true,
    supportedRatios: ['1:1', '4:5', '3:4', '2:3', '3:2', '4:3', '16:9', '9:16', '21:9'],
    syntax: '--ar {width}:{height}',
    defaultRatio: '1:1',
    notes: 'Full AR support via --ar parameter',
  },
  bluewillow: {
    nativeSupport: true,
    supportedRatios: ['1:1', '2:3', '3:2'],
    syntax: '--ar {width}:{height}',
    defaultRatio: '1:1',
    notes: 'Limited AR support - unsupported ratios fallback to composition text',
  },
  nijijourney: {
    nativeSupport: true,
    supportedRatios: ['1:1', '4:5', '3:4', '2:3', '3:2', '4:3', '16:9', '9:16', '21:9'],
    syntax: '--ar {width}:{height}',
    defaultRatio: '1:1',
    notes: 'Same as Midjourney',
  },
  _default: {
    nativeSupport: false,
    supportedRatios: [],
    syntax: null,
    defaultRatio: null,
    notes: 'Default: composition text injection for AR context',
  },
};

// ============================================================================
// SEMANTIC TYPE MAPPINGS (Simplified for runtime - full data in JSON)
// ============================================================================

// Subject type detection keywords
const SUBJECT_TYPE_KEYWORDS: Record<string, string[]> = {
  'single-figure': [
    'portrait',
    'woman',
    'man',
    'person',
    'warrior',
    'knight',
    'astronaut',
    'samurai',
    'detective',
    'musician',
    'ballerina',
    'chef',
    'scientist',
    'pirate',
    'angel',
    'ninja',
    'monk',
    'geisha',
    'gladiator',
    'viking',
    'pharaoh',
    'god',
    'soldier',
    'king',
    'queen',
    'prince',
    'princess',
    'wizard',
    'witch',
    'vampire',
    'superhero',
  ],
  creature: [
    'dragon',
    'robot',
    'android',
    'mermaid',
    'demon',
    'alien',
    'phoenix',
    'unicorn',
    'griffin',
    'centaur',
    'fairy',
  ],
  animal: [
    'wolf',
    'cat',
    'owl',
    'horse',
    'butterfly',
    'eagle',
    'lion',
    'tiger',
    'elephant',
    'dolphin',
    'whale',
  ],
  landscape: ['mountain', 'forest', 'ocean', 'desert', 'beach', 'waterfall'],
  architecture: ['castle', 'cottage', 'cityscape', 'building', 'temple', 'cathedral'],
  vehicle: ['car', 'spaceship'],
  object: ['flower', 'rose', 'tree', 'bouquet'],
};

// Style type detection keywords
const STYLE_TYPE_KEYWORDS: Record<string, string[]> = {
  cinematic: ['cinematic', 'film', 'movie', 'noir', 'blockbuster'],
  painterly: [
    'oil painting',
    'watercolor',
    'acrylic',
    'impressionist',
    'baroque',
    'renaissance',
    'art nouveau',
  ],
  photographic: [
    'photorealistic',
    'hyperrealistic',
    'documentary',
    'editorial',
    'photography',
    'portrait photo',
  ],
  digital: [
    'digital',
    'concept art',
    'matte',
    '3D render',
    'CGI',
    'Unreal',
    'Octane',
    'ray tracing',
  ],
  illustrated: [
    'illustration',
    'comic',
    'manga',
    'anime',
    'cartoon',
    'pixel',
    'vector',
    'sketch',
    'line art',
  ],
  genre: ['steampunk', 'cyberpunk', 'gothic', 'fantasy', 'sci-fi', 'post-apocalyptic', 'dystopian'],
  aesthetic: ['vaporwave', 'synthwave', 'dreamcore', 'cottagecore', 'academia', 'ethereal', 'Y2K'],
  minimal: ['minimalist', 'minimal'],
};

// Lighting type detection keywords
const LIGHTING_TYPE_KEYWORDS: Record<string, string[]> = {
  'soft-ambient': ['soft', 'diffused', 'ambient', 'natural light', 'overcast', 'window light'],
  'dramatic-directional': [
    'dramatic',
    'chiaroscuro',
    'Rembrandt',
    'split lighting',
    'spotlight',
    'theatrical',
  ],
  'golden-hour': ['golden hour', 'magic hour', 'sunrise', 'sunset', 'warm'],
  'cool-blue': ['blue hour', 'moonlight', 'cool', 'cold'],
  'rim-separation': ['backlight', 'rim light', 'hair light', 'silhouette'],
  'neon-artificial': ['neon', 'LED', 'fluorescent', 'strobe'],
  volumetric: ['volumetric', 'god rays', 'crepuscular', 'light rays', 'lens flare'],
  practical: ['candlelight', 'firelight', 'torchlight', 'lantern'],
};

// Camera type detection keywords
const CAMERA_TYPE_KEYWORDS: Record<string, string[]> = {
  'wide-capture': ['wide angle', 'ultra wide', 'fisheye', '14mm', '24mm'],
  standard: ['50mm', '35mm', 'eye level', 'DSLR'],
  'portrait-lens': ['portrait lens', '85mm', '135mm', 'telephoto', 'bokeh', 'shallow depth', 'f/1'],
  macro: ['macro', 'microscopic', 'close-up'],
  cinematic: ['anamorphic', 'cinema camera', 'IMAX', 'RED', 'ARRI', '35mm film'],
  'dynamic-angle': [
    'low angle',
    'high angle',
    'overhead',
    'aerial',
    'drone',
    'Dutch angle',
    "bird's eye",
    "worm's eye",
  ],
};

// ============================================================================
// COMPOSITION CONTRIBUTIONS BY SEMANTIC TYPE
// ============================================================================

interface CompositionContribution {
  placement?: string[];
  framing?: string[];
  depth?: string[];
  movement?: string[];
  mood?: string[];
  contrast?: string[];
  perspective?: string[];
}

const SUBJECT_CONTRIBUTIONS: Record<string, CompositionContribution> = {
  'single-figure': {
    placement: ['figure as focal point', 'subject anchor'],
    framing: ['action space around subject'],
    depth: ['figure-ground separation'],
  },
  creature: {
    placement: ['creature dominates composition'],
    framing: ['dynamic positioning'],
    depth: ['creature-environment integration'],
  },
  animal: {
    placement: ['natural positioning'],
    framing: ['habitat context'],
    depth: ['wildlife depth'],
  },
  landscape: {
    placement: ['horizon placement', 'thirds division'],
    framing: ['expansive view'],
    depth: ['foreground-midground-background'],
  },
  architecture: {
    placement: ['structural leading lines'],
    framing: ['geometric anchor'],
    depth: ['architectural depth planes'],
  },
  vehicle: {
    placement: ['vehicle as hero'],
    framing: ['dynamic angle'],
    depth: ['motion suggestion'],
  },
  object: {
    placement: ['object isolation', 'centred'],
    framing: ['clean negative space'],
    depth: ['object-background separation'],
  },
};

const STYLE_CONTRIBUTIONS: Record<string, CompositionContribution> = {
  cinematic: {
    mood: ['theatrical staging', 'cinematic depth'],
    framing: ['film aspect awareness', 'dramatic angles'],
  },
  painterly: {
    mood: ['painterly depth', 'classical balance'],
    framing: ['artistic composition', 'golden ratio'],
  },
  photographic: {
    mood: ['natural framing', 'authentic perspective'],
    depth: ['realistic depth of field'],
  },
  digital: {
    mood: ['digital precision', 'rendered clarity'],
    framing: ['technical composition'],
  },
  illustrated: {
    mood: ['stylized framing', 'graphic emphasis'],
    framing: ['illustrative composition'],
  },
  genre: {
    mood: ['genre-appropriate staging'],
    framing: ['thematic framing'],
  },
  aesthetic: {
    mood: ['aesthetic-specific atmosphere'],
    framing: ['vibe-appropriate framing'],
  },
  minimal: {
    framing: ['maximum negative space', 'single focal point'],
    mood: ['extreme simplicity'],
  },
};

const LIGHTING_CONTRIBUTIONS: Record<string, CompositionContribution> = {
  'soft-ambient': {
    contrast: ['gentle tonal transitions'],
    mood: ['calm atmosphere'],
    depth: ['subtle depth definition'],
  },
  'dramatic-directional': {
    contrast: ['high contrast zones', 'light-shadow interplay'],
    mood: ['dramatic atmosphere'],
    depth: ['strong depth separation'],
  },
  'golden-hour': {
    contrast: ['warm tonal range'],
    mood: ['warm romantic atmosphere'],
    depth: ['warm depth layers'],
  },
  'cool-blue': {
    contrast: ['cool tonal range'],
    mood: ['mysterious atmosphere'],
    depth: ['cool depth separation'],
  },
  'rim-separation': {
    contrast: ['edge definition'],
    mood: ['ethereal atmosphere'],
    depth: ['strong subject-background separation'],
  },
  'neon-artificial': {
    contrast: ['colored light zones'],
    mood: ['urban tech atmosphere'],
    depth: ['neon depth planes'],
  },
  volumetric: {
    contrast: ['light beam definition'],
    mood: ['ethereal atmosphere'],
    depth: ['volumetric depth'],
  },
  practical: {
    contrast: ['natural falloff'],
    mood: ['intimate atmosphere'],
    depth: ['light source depth'],
  },
};

const CAMERA_CONTRIBUTIONS: Record<string, CompositionContribution> = {
  'wide-capture': {
    perspective: ['environmental context', 'space exaggeration'],
    depth: ['deep depth of field'],
  },
  standard: {
    perspective: ['natural perspective'],
    depth: ['natural depth'],
  },
  'portrait-lens': {
    perspective: ['compressed perspective', 'subject emphasis'],
    depth: ['shallow depth', 'background blur'],
  },
  macro: {
    perspective: ['intimate detail view'],
    depth: ['extremely shallow depth'],
  },
  cinematic: {
    perspective: ['cinematic framing'],
    depth: ['cinematic depth'],
  },
  'dynamic-angle': {
    perspective: ['dramatic angle', 'power dynamics'],
    depth: ['angle-enhanced depth'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate aspect ratio ID against whitelist
 */
export function isValidAspectRatio(ratio: string): ratio is AspectRatioId {
  return ratio in ASPECT_RATIOS;
}

/**
 * Get all available aspect ratios
 */
export function getAllAspectRatios(): AspectRatioDefinition[] {
  return Object.values(ASPECT_RATIOS);
}

/**
 * Get aspect ratio definition by ID
 */
export function getAspectRatio(ratioId: AspectRatioId): AspectRatioDefinition {
  return ASPECT_RATIOS[ratioId];
}

/**
 * Get platform AR support info
 */
export function getPlatformARSupport(platformId: string): PlatformARSupport {
  const support = PLATFORM_AR_SUPPORT[platformId];
  if (support) return support;

  // Return default if platform not found
  const defaultSupport = PLATFORM_AR_SUPPORT['_default'];
  if (defaultSupport) return defaultSupport;

  // Ultimate fallback (should never reach here with proper data)
  return {
    nativeSupport: false,
    supportedRatios: [],
    syntax: null,
    defaultRatio: null,
    notes: 'Default: composition text injection for AR context',
  };
}

/**
 * Check if platform supports a specific AR natively
 */
export function platformSupportsAR(platformId: string, ratioId: AspectRatioId): boolean {
  const support = getPlatformARSupport(platformId);
  return support.nativeSupport && support.supportedRatios.includes(ratioId);
}

/**
 * Get default AR for platform (if any)
 */
export function getPlatformDefaultAR(platformId: string): AspectRatioId | null {
  const support = getPlatformARSupport(platformId);
  return support.defaultRatio;
}

/**
 * Detect semantic type from a selection string
 */
function detectSemanticType(
  selection: string,
  typeKeywords: Record<string, string[]>,
): string | null {
  const lowerSelection = selection.toLowerCase();

  for (const [type, keywords] of Object.entries(typeKeywords)) {
    for (const keyword of keywords) {
      if (lowerSelection.includes(keyword.toLowerCase())) {
        return type;
      }
    }
  }

  return null;
}

/**
 * Get contributions for detected semantic types
 */
function getContributions(selections: PromptSelections): CompositionContribution {
  const contributions: CompositionContribution = {
    placement: [],
    framing: [],
    depth: [],
    movement: [],
    mood: [],
    contrast: [],
    perspective: [],
  };

  // Process subject
  const subjects = selections.subject ?? [];
  for (const subject of subjects) {
    const type = detectSemanticType(subject, SUBJECT_TYPE_KEYWORDS);
    if (type && SUBJECT_CONTRIBUTIONS[type]) {
      const contrib = SUBJECT_CONTRIBUTIONS[type];
      for (const [key, values] of Object.entries(contrib)) {
        if (values && contributions[key as keyof CompositionContribution]) {
          contributions[key as keyof CompositionContribution]!.push(...values);
        }
      }
    }
  }

  // Process style
  const styles = selections.style ?? [];
  for (const style of styles) {
    const type = detectSemanticType(style, STYLE_TYPE_KEYWORDS);
    if (type && STYLE_CONTRIBUTIONS[type]) {
      const contrib = STYLE_CONTRIBUTIONS[type];
      for (const [key, values] of Object.entries(contrib)) {
        if (values && contributions[key as keyof CompositionContribution]) {
          contributions[key as keyof CompositionContribution]!.push(...values);
        }
      }
    }
  }

  // Process lighting
  const lighting = selections.lighting ?? [];
  for (const light of lighting) {
    const type = detectSemanticType(light, LIGHTING_TYPE_KEYWORDS);
    if (type && LIGHTING_CONTRIBUTIONS[type]) {
      const contrib = LIGHTING_CONTRIBUTIONS[type];
      for (const [key, values] of Object.entries(contrib)) {
        if (values && contributions[key as keyof CompositionContribution]) {
          contributions[key as keyof CompositionContribution]!.push(...values);
        }
      }
    }
  }

  // Process camera
  const camera = selections.camera ?? [];
  for (const cam of camera) {
    const type = detectSemanticType(cam, CAMERA_TYPE_KEYWORDS);
    if (type && CAMERA_CONTRIBUTIONS[type]) {
      const contrib = CAMERA_CONTRIBUTIONS[type];
      for (const [key, values] of Object.entries(contrib)) {
        if (values && contributions[key as keyof CompositionContribution]) {
          contributions[key as keyof CompositionContribution]!.push(...values);
        }
      }
    }
  }

  return contributions;
}

/**
 * Deduplicate and merge contribution arrays
 */
function deduplicateContributions(contributions: CompositionContribution): string[] {
  const allHints: string[] = [];

  for (const values of Object.values(contributions)) {
    if (values && Array.isArray(values)) {
      allHints.push(...values);
    }
  }

  // Deduplicate while preserving order
  return [...new Set(allHints)];
}

/**
 * Assemble dynamic composition pack from AR + selections
 */
function assembleDynamicPack(ratioId: AspectRatioId, selections: PromptSelections): string {
  const ar = ASPECT_RATIOS[ratioId];
  const hints: string[] = [];

  // Start with AR-specific hints
  for (const hintArray of Object.values(ar.dynamicHints)) {
    // Pick first hint from each category for conciseness
    if (hintArray.length > 0) {
      const firstHint = hintArray[0];
      if (firstHint !== undefined) {
        hints.push(firstHint);
      }
    }
  }

  // Get contributions from selections
  const contributions = getContributions(selections);
  const selectionHints = deduplicateContributions(contributions);

  // Merge AR hints with selection hints, removing duplicates
  const allHints = [...new Set([...hints, ...selectionHints])];

  // Limit to reasonable length (8-12 hints max)
  const trimmedHints = allHints.slice(0, 10);

  // Join into natural language
  return trimmedHints.join(', ');
}

// ============================================================================
// MAIN PUBLIC API
// ============================================================================

/**
 * Assemble composition pack for the given AR and platform
 *
 * @param platformId - Platform identifier (e.g., 'midjourney', 'openai')
 * @param ratioId - Aspect ratio identifier (e.g., '16:9')
 * @param mode - Composition mode ('static' or 'dynamic')
 * @param selections - User's prompt selections (for dynamic mode)
 * @returns CompositionPack with text and AR parameter info
 */
export function assembleCompositionPack(
  platformId: string,
  ratioId: AspectRatioId,
  mode: CompositionMode,
  selections: PromptSelections = {},
): CompositionPack {
  // Validate ratio
  if (!isValidAspectRatio(ratioId)) {
    return {
      text: '',
      useNativeAR: false,
      arParameter: null,
      mode,
      isNativelySupported: false,
    };
  }

  const ar = ASPECT_RATIOS[ratioId];
  const platformSupport = getPlatformARSupport(platformId);
  const isNativelySupported = platformSupportsAR(platformId, ratioId);

  // Determine composition text based on mode
  let compositionText: string;
  if (mode === 'static') {
    compositionText = ar.staticPack;
  } else {
    compositionText = assembleDynamicPack(ratioId, selections);
  }

  // Determine if we should use native AR parameter
  const useNativeAR = isNativelySupported;

  // Build AR parameter string if supported
  let arParameter: string | null = null;
  if (useNativeAR && platformSupport.syntax) {
    arParameter = platformSupport.syntax
      .replace('{width}', String(ar.width))
      .replace('{height}', String(ar.height));
  }

  // If native AR is used, composition text is optional enhancement
  // If not native, composition text is required for framing guidance
  return {
    text: compositionText,
    useNativeAR,
    arParameter,
    mode,
    isNativelySupported,
  };
}

/**
 * Get tooltip content for an aspect ratio
 */
export function getARTooltip(platformId: string, ratioId: AspectRatioId): string {
  const ar = ASPECT_RATIOS[ratioId];
  const support = getPlatformARSupport(platformId);
  const isSupported = platformSupportsAR(platformId, ratioId);

  let tooltip = `${ar.label}\n`;
  tooltip += `${ar.useCase}\n\n`;

  if (support.nativeSupport) {
    if (isSupported) {
      tooltip += `✓ Native support: ${support.syntax?.replace('{width}:{height}', `${ar.width}:${ar.height}`)}\n`;
    } else {
      tooltip += `○ Not natively supported\n`;
      tooltip += `→ Composition text will be embedded in prompt\n`;
    }
  } else {
    tooltip += `→ Composition text will be embedded in prompt`;
  }

  return tooltip;
}

/**
 * Generate AR parameter string for native platforms
 */
export function generateARParameter(ratioId: AspectRatioId): string {
  const ar = ASPECT_RATIOS[ratioId];
  return `--ar ${ar.width}:${ar.height}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { ASPECT_RATIOS, PLATFORM_AR_SUPPORT };
