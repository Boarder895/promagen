// src/data/providers/platform-config.ts
// ============================================================================
// PLATFORM CONFIG — SINGLE SOURCE OF TRUTH (v1.1.0)
// ============================================================================
// ONE JSON file. THREE consumer shapes. ZERO duplication.
//
// Replaces the per-platform data from:
//   - platform-formats.json   → assembly config (Call 2 + Call 3)
//   - prompt-limits.json      → trimmer + length UI
//   - compression/platform-support.json → shorthand compression engine
//
// Each consumer imports from here instead of the old JSON files.
// The adapter picks the fields each consumer needs — consumers don't
// know or care that the data is merged.
//
// Authority: prompt_engineering_specs_40_platforms_tier_classification_routing_logic.md
// ============================================================================

import configData from './platform-config.json';
import type { PlatformFormat, PlatformFormats } from '@/types/prompt-builder';
import type { PromptLimit, PromptLimitsConfig } from '@/types/prompt-limits';
import type {
  PlatformSupportMatrix,
  PlatformConfig as CompressionPlatformConfig,
  CompressionTier,
  ShorthandLevel,
} from '@/types/compression';

// ============================================================================
// RAW CONFIG TYPE (matches platform-config.json shape)
// ============================================================================

/** Every field from all 3 old files, merged per platform */
interface RawPlatformEntry {
  // Identity
  tier?: number;
  architecture?: string;
  _removed?: boolean;

  // Assembly (from platform-formats)
  promptStyle?: string;
  separator?: string;
  negativeSupport?: string;
  negativeSyntax?: string | null;
  categoryOrder?: string[];
  wrapNegativeInPrompt?: boolean;
  negativeWrapPrefix?: string;
  supportsWeighting?: boolean;
  weightingSyntax?: string;
  tips?: string;
  exampleOutput?: string;
  suffixParams?: string[];
  tokenLimit?: number;
  /** Hard model token limit for prompt-limits (e.g. 77 for CLIP) — distinct from assembly tokenLimit */
  limitsTokenLimit?: number | null;
  sweetSpot?: number;
  qualityPrefix?: string[];
  qualitySuffix?: string[];
  qualityNegative?: string[];
  weightedCategories?: Record<string, number>;
  impactPriority?: string[];
  groupKnowledge?: string;

  // Limits (from prompt-limits)
  maxChars?: number | null;
  idealMin?: number;
  idealMax?: number;
  idealWords?: number;
  platformNote?: string;
  optimizationBenefit?: string;
  qualityImpact?: string;
  impactCategory?: string;

  // Compression (from platform-support)
  shorthandLevel?: string;
  compressionNotes?: string;

   
  [key: string]: any;
}

interface RawConfig {
  _meta: { version: string; description: string; updated: string; totalPlatforms: number };
  _assemblyDefaults: PlatformFormat;
  _tiers: PlatformSupportMatrix['tiers'];
  _compressionStrategies: PlatformSupportMatrix['compressionStrategies'];
  platforms: Record<string, RawPlatformEntry>;
}

const raw = configData as unknown as RawConfig;

// ============================================================================
// ADAPTER 1: PlatformFormats (for prompt-builder.ts, providers/index.ts)
// ============================================================================

function derivePlatformFormat(entry: RawPlatformEntry): PlatformFormat {
  return {
    promptStyle: (entry.promptStyle as PlatformFormat['promptStyle']) ?? 'natural',
    separator: entry.separator ?? ', ',
    negativeSupport: (entry.negativeSupport as PlatformFormat['negativeSupport']) ?? 'none',
    negativeSyntax: entry.negativeSyntax ?? undefined,
    categoryOrder: (entry.categoryOrder as PlatformFormat['categoryOrder']) ?? raw._assemblyDefaults.categoryOrder,
    wrapNegativeInPrompt: entry.wrapNegativeInPrompt,
    negativeWrapPrefix: entry.negativeWrapPrefix,
    supportsWeighting: entry.supportsWeighting,
    weightingSyntax: entry.weightingSyntax,
    tips: entry.tips,
    exampleOutput: entry.exampleOutput,
    suffixParams: entry.suffixParams,
    tokenLimit: entry.tokenLimit,
    sweetSpot: entry.sweetSpot,
    qualityPrefix: entry.qualityPrefix,
    qualitySuffix: entry.qualitySuffix,
    qualityNegative: entry.qualityNegative,
    weightedCategories: entry.weightedCategories,
    impactPriority: entry.impactPriority as PlatformFormat['impactPriority'],
    groupKnowledge: entry.groupKnowledge,
  };
}

/** PlatformFormats shape — drop-in replacement for old platform-formats.json import */
export const PLATFORM_FORMATS_DERIVED: PlatformFormats = {
  _meta: {
    version: raw._meta.version,
    description: raw._meta.description,
    updated: raw._meta.updated,
  },
  _defaults: raw._assemblyDefaults,
  platforms: Object.fromEntries(
    Object.entries(raw.platforms)
      .filter(([, entry]) => !entry._removed)
      .map(([id, entry]) => [id, derivePlatformFormat(entry)]),
  ),
};

// ============================================================================
// ADAPTER 2: PromptLimitsConfig (for prompt-trimmer.ts, compress.ts)
// ============================================================================

function derivePromptLimit(entry: RawPlatformEntry): PromptLimit {
  return {
    maxChars: entry.maxChars ?? null,
    idealMin: entry.idealMin ?? 100,
    idealMax: entry.idealMax ?? 500,
    idealWords: entry.idealWords ?? 50,
    tokenLimit: (entry.limitsTokenLimit ?? entry.tokenLimit ?? null) as number | null,
    platformNote: entry.platformNote ?? '',
    optimizationBenefit: entry.optimizationBenefit ?? '',
    qualityImpact: entry.qualityImpact ?? '',
    impactCategory: (entry.impactCategory as PromptLimit['impactCategory']) ?? 'moderate',
    architecture: (entry.architecture as PromptLimit['architecture']) ?? 'proprietary',
    sources: entry.limitSources ?? entry.sources ?? [],
  };
}

/** PromptLimitsConfig shape — drop-in replacement for old prompt-limits.json import */
export const PROMPT_LIMITS_DERIVED: PromptLimitsConfig = {
  $schema: '',
  version: raw._meta.version,
  lastUpdated: raw._meta.updated,
  meta: {
    description: 'Derived from platform-config.json SSOT',
  },
  providers: Object.fromEntries(
    Object.entries(raw.platforms)
      .filter(([, entry]) => !entry._removed)
      .map(([id, entry]) => [id, derivePromptLimit(entry)]),
  ),
};

// ============================================================================
// ADAPTER 3: PlatformSupportMatrix (for compression/index.ts, compress.ts)
// ============================================================================

function deriveCompressionConfig(entry: RawPlatformEntry): CompressionPlatformConfig {
  return {
    tier: (entry.tier ?? 4) as CompressionTier,
    architecture: entry.architecture ?? 'proprietary',
    shorthandLevel: (entry.shorthandLevel ?? 'MINIMAL') as ShorthandLevel,
    negativeSupport: (entry.negativeSupport as CompressionPlatformConfig['negativeSupport']) ?? 'none',
    negativeSyntax: entry.negativeSyntax ?? undefined,
    tokenLimit: entry.tokenLimit,
    weightSyntax: entry.weightingSyntax,
    notes: entry.compressionNotes ?? entry.tips,
  };
}

/** PlatformSupportMatrix shape — drop-in replacement for old platform-support.json import */
export const PLATFORM_SUPPORT_DERIVED: PlatformSupportMatrix = {
  version: raw._meta.version,
  lastUpdated: raw._meta.updated,
  meta: {
    description: 'Derived from platform-config.json SSOT',
    totalPlatforms: Object.values(raw.platforms).filter((e) => !e._removed).length,
  },
  tiers: raw._tiers,
  platforms: Object.fromEntries(
    Object.entries(raw.platforms)
      .filter(([, entry]) => !entry._removed)
      .map(([id, entry]) => [id, deriveCompressionConfig(entry)]),
  ),
  compressionStrategies: raw._compressionStrategies,
};

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/** Get raw merged config for a platform (all fields) */
export function getRawPlatformConfig(id: string): RawPlatformEntry | undefined {
  return raw.platforms[id];
}

/** Check if a platform is active (not removed) */
export function isPlatformActive(id: string): boolean {
  const entry = raw.platforms[id];
  return entry != null && !entry._removed;
}

/** Get all active platform IDs */
export function getActivePlatformIds(): string[] {
  return Object.entries(raw.platforms)
    .filter(([, entry]) => !entry._removed)
    .map(([id]) => id);
}
