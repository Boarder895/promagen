// src/lib/authority/platform-data.ts
// ============================================================================
// AUTHORITY PAGE DATA LAYER
// ============================================================================
// Merges platform-config.json (SSOT) + providers.json into the unified
// shape that authority pages consume.
//
// RULES:
//   - All counts and groupings derived dynamically — zero hardcoded numbers
//   - Zero presentation coupling (no CSS classes, no colours)
//   - Canonical type import: @/types/provider (singular entry point)
//
// Authority: promagen-ai-authority-pages-FINAL-v1.2.md
// ============================================================================

import configData from '@/data/providers/platform-config.json';
import providersData from '@/data/providers/providers.json';
import bqiData from '@/data/authority/bqi-headline.json';
import type { Provider } from '@/types/provider';

// ─── Raw config types (mirrors platform-config.json shape) ─────────────────

interface RawPlatformEntry {
  tier?: number;
  architecture?: string;
  promptStyle?: string;
  negativeSupport?: string;
  negativeSyntax?: string | null;
  sweetSpot?: number;
  maxChars?: number | null;
  idealMin?: number;
  idealMax?: number;
  tokenLimit?: number;
  tips?: string;
  groupKnowledge?: string;
  shorthandLevel?: string;
  platformNote?: string;
  exampleOutput?: string;
  [key: string]: unknown;
}

interface RawConfig {
  _meta: {
    version: string;
    description: string;
    updated: string;
    totalPlatforms: number;
  };
  _tiers: Record<
    string,
    {
      name: string;
      description: string;
      architecture: string;
      platforms: string[];
    }
  >;
  platforms: Record<string, RawPlatformEntry>;
}

const raw = configData as unknown as RawConfig;

// ─── Tier metadata (semantic only — no presentation) ───────────────────────

export interface TierMeta {
  name: string;
  shortName: string;
  description: string;
  promptStyle: string;
}

export const TIER_META: Record<number, TierMeta> = {
  1: {
    name: 'CLIP-Based',
    shortName: 'T1',
    description: 'Weighted keywords with CLIP tokenisation',
    promptStyle: 'Weighted keywords (term:1.2)',
  },
  2: {
    name: 'Midjourney Family',
    shortName: 'T2',
    description: 'Structured parameters with :: weighting and -- flags',
    promptStyle: 'Keywords + --no params',
  },
  3: {
    name: 'Natural Language',
    shortName: 'T3',
    description: 'Conversational sentences, no special syntax',
    promptStyle: 'Conversational sentences',
  },
  4: {
    name: 'Plain Language',
    shortName: 'T4',
    description: 'Short, focused prompts with minimal jargon',
    promptStyle: 'Short, focused prompts',
  },
};

// ─── Negative support types (semantic only — no presentation) ──────────────

export type NegativeSupportType = 'separate' | 'inline' | 'none';

export const NEGATIVE_SUPPORT_LABEL: Record<NegativeSupportType, string> = {
  separate: 'Separate field',
  inline: 'Inline syntax',
  none: 'Not supported',
};

// ─── Public platform shape ─────────────────────────────────────────────────

export interface AuthorityPlatform {
  id: string;
  name: string;
  countryCode: string;
  hqCity: string;
  tagline: string;
  website: string;
  tier: number;
  tierName: string;
  promptStyle: string;
  negativeSupport: NegativeSupportType;
  negativeSyntax: string | null;
  negativeSyntaxDisplay: string;
  sweetSpot: number;
  idealMin: number;
  idealMax: number;
  maxChars: number | null;
  tips: string;
  architecture: string;
  shorthandLevel: string;
  localIcon?: string;
  // Profile-page fields
  groupKnowledge: string;
  platformNote: string;
  exampleOutput: string;
  optimizationBenefit: string;
}

// ─── Merge logic ───────────────────────────────────────────────────────────

function mergeProviderWithConfig(
  provider: Provider,
  config: RawPlatformEntry | undefined,
): AuthorityPlatform {
  const tier = config?.tier ?? 4;
  const negSupport = (config?.negativeSupport ?? 'none') as NegativeSupportType;

  let negativeSyntaxDisplay = 'N/A';
  if (negSupport === 'separate') negativeSyntaxDisplay = 'Separate field';
  else if (negSupport === 'inline') {
    negativeSyntaxDisplay = config?.negativeSyntax
      ? config.negativeSyntax.replace('{negative}', '…')
      : 'Inline';
  }

  return {
    id: provider.id,
    name: provider.name,
    countryCode: provider.countryCode ?? provider.country ?? '',
    hqCity: provider.hqCity ?? '',
    tagline: provider.tagline ?? '',
    website: provider.website,
    tier,
    tierName: TIER_META[tier]?.name ?? 'Unknown',
    promptStyle: config?.promptStyle ?? 'natural',
    negativeSupport: negSupport,
    negativeSyntax: config?.negativeSyntax ?? null,
    negativeSyntaxDisplay,
    sweetSpot: config?.sweetSpot ?? 0,
    idealMin: config?.idealMin ?? 0,
    idealMax: config?.idealMax ?? 0,
    maxChars: config?.maxChars ?? null,
    tips: config?.tips ?? '',
    architecture: config?.architecture ?? 'proprietary',
    shorthandLevel: config?.shorthandLevel ?? 'MINIMAL',
    localIcon: provider.localIcon,
    groupKnowledge: (config?.groupKnowledge as string) ?? '',
    platformNote: (config?.platformNote as string) ?? '',
    exampleOutput: (config?.exampleOutput as string) ?? '',
    optimizationBenefit: (config?.optimizationBenefit as string) ?? '',
  };
}

// ─── Public API ────────────────────────────────────────────────────────────

/** All platforms merged with config data, sorted A→Z by name */
export function getAuthorityPlatforms(): AuthorityPlatform[] {
  const providers = providersData as Provider[];
  return providers
    .filter((p) => raw.platforms[p.id] != null)
    .map((p) => mergeProviderWithConfig(p, raw.platforms[p.id]))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** All active platform IDs from the SSOT (for sitemap, static params) */
export function getAuthorityPlatformIds(): string[] {
  return Object.keys(raw.platforms);
}

/** Single platform by ID — returns undefined if not found */
export function getAuthorityPlatformById(id: string): AuthorityPlatform | undefined {
  const providers = providersData as Provider[];
  const provider = providers.find((p) => p.id === id);
  const config = raw.platforms[id];
  if (!provider || !config) return undefined;
  return mergeProviderWithConfig(provider, config);
}

/** Other platforms in the same tier (for "related platforms" on profile pages) */
export function getSameTierPlatforms(id: string, tier: number): AuthorityPlatform[] {
  return getAuthorityPlatforms().filter((p) => p.tier === tier && p.id !== id);
}

// ─── Derived counts (dynamic, never hardcoded) ─────────────────────────────

export interface PlatformCounts {
  total: number;
  byTier: Record<number, number>;
  byNegativeSupport: Record<string, number>;
}

export function getPlatformCounts(): PlatformCounts {
  const entries = Object.values(raw.platforms);

  const byTier: Record<number, number> = {};
  const byNegativeSupport: Record<string, number> = {};

  for (const p of entries) {
    const t = p.tier ?? 4;
    byTier[t] = (byTier[t] ?? 0) + 1;

    const ns = p.negativeSupport ?? 'none';
    byNegativeSupport[ns] = (byNegativeSupport[ns] ?? 0) + 1;
  }

  return { total: entries.length, byTier, byNegativeSupport };
}

// ─── Negative prompt grouping (for the negative prompt guide) ──────────────

export interface NegativeSupportGroup {
  type: NegativeSupportType;
  label: string;
  platforms: AuthorityPlatform[];
}

/** All platforms grouped by negative support type, sorted A→Z within each group */
export function getPlatformsByNegativeSupport(): NegativeSupportGroup[] {
  const all = getAuthorityPlatforms();
  const order: NegativeSupportType[] = ['separate', 'inline', 'none'];

  return order.map((type) => ({
    type,
    label: NEGATIVE_SUPPORT_LABEL[type],
    platforms: all.filter((p) => p.negativeSupport === type),
  }));
}

/** SSOT version */
export function getSSOTVersion(): string {
  return raw._meta.version;
}

/** SSOT last-updated date */
export function getLastUpdated(): string {
  return raw._meta.updated;
}

// ─── BQI headline range (Option B) ─────────────────────────────────────────

export interface BqiHeadlineRange {
  min: number;
  max: number;
  lastBatchRun: string;
}

/** BQI headline range from typed JSON — update bqi-headline.json when scores stabilise */
export function getBqiHeadlineRange(): BqiHeadlineRange {
  return {
    min: bqiData.min,
    max: bqiData.max,
    lastBatchRun: bqiData.lastBatchRun,
  };
}
