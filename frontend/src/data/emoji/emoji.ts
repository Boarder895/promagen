// frontend/src/data/emoji/emoji.ts
import emojiBankJson from '@/data/emoji/emoji-bank.json';

type IdEmoji = {
  id: string;
  emoji: string;
};

type EmojiBank = {
  trends?: IdEmoji[];
  core?: IdEmoji[];
  finance?: IdEmoji[];
  currencies?: IdEmoji[];
  weather?: IdEmoji[];
  space?: IdEmoji[];
  sports?: IdEmoji[];
  seasons?: IdEmoji[];
  alerts?: IdEmoji[];
  ui?: IdEmoji[];
  transport?: IdEmoji[];
  science?: IdEmoji[];
  tech?: IdEmoji[];
  food?: IdEmoji[];
  nature?: IdEmoji[];
  music?: IdEmoji[];
  people?: IdEmoji[];
  symbols?: IdEmoji[];
  providers?: Record<string, string>;
};

const emojiBank = emojiBankJson as EmojiBank;

function toMap(arr: IdEmoji[] | undefined): Record<string, string> {
  return (arr ?? []).reduce<Record<string, string>>((acc, item) => {
    acc[item.id] = item.emoji;
    return acc;
  }, {});
}

// Build lookup maps once at module load
const trendMap = toMap(emojiBank.trends);
const coreMap = toMap(emojiBank.core);
const financeMap = toMap(emojiBank.finance);
const currencyMap = toMap(emojiBank.currencies);
const weatherMap = toMap(emojiBank.weather);
const spaceMap = toMap(emojiBank.space);
const sportsMap = toMap(emojiBank.sports);
const seasonsMap = toMap(emojiBank.seasons);
const alertsMap = toMap(emojiBank.alerts);
const uiMap = toMap(emojiBank.ui);
const transportMap = toMap(emojiBank.transport);
const scienceMap = toMap(emojiBank.science);
const techMap = toMap(emojiBank.tech);
const foodMap = toMap(emojiBank.food);
const natureMap = toMap(emojiBank.nature);
const musicMap = toMap(emojiBank.music);
const peopleMap = toMap(emojiBank.people);
const symbolsMap = toMap(emojiBank.symbols);

// Providers are already a flat map in the JSON
const providerMap: Record<string, string> = emojiBank.providers ?? {};

const SECTION_MAPS = {
  trends: trendMap,
  core: coreMap,
  finance: financeMap,
  currencies: currencyMap,
  weather: weatherMap,
  space: spaceMap,
  sports: sportsMap,
  seasons: seasonsMap,
  alerts: alertsMap,
  ui: uiMap,
  transport: transportMap,
  science: scienceMap,
  tech: techMap,
  food: foodMap,
  nature: natureMap,
  music: musicMap,
  people: peopleMap,
  symbols: symbolsMap,
  providers: providerMap,
} as const;

export type EmojiSection = keyof typeof SECTION_MAPS;

function normaliseId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Generic lookup by section then id.
 * Returns null if the section/id pair does not exist.
 */
export function getEmoji(section: EmojiSection, id: unknown): string | null {
  const safeId = normaliseId(id);
  if (!safeId) return null;

  const sectionMap = SECTION_MAPS[section];
  const glyph = sectionMap[safeId];

  return typeof glyph === 'string' && glyph.trim().length > 0 ? glyph : null;
}

/**
 * Trend-specific helper.
 * For now we only guarantee support for "up" | "down" | "flat".
 */
export function getTrendEmoji(trend: 'up' | 'down' | 'flat' | null | undefined): string | null {
  const safeId = normaliseId(trend);
  if (!safeId) return null;

  const glyph = trendMap[safeId];
  return typeof glyph === 'string' && glyph.trim().length > 0 ? glyph : null;
}

export type ProviderLike = {
  id: string;
  emoji?: string | null;
  category?: string | null;
};

/**
 * Best-effort provider emoji resolution:
 * 1. Use provider.emoji if explicitly set.
 * 2. Fall back to providers map by id.
 * 3. Fall back to core category emoji (e.g. "image", "video").
 */
export function getProviderEmoji(
  provider: string | ProviderLike | null | undefined,
): string | null {
  if (!provider) return null;

  let explicitEmoji: string | null = null;
  let providerId: string | null = null;
  let category: string | null = null;

  if (typeof provider === 'string') {
    providerId = normaliseId(provider);
  } else {
    providerId = normaliseId(provider.id);
    category = provider.category ?? null;
    if (typeof provider.emoji === 'string' && provider.emoji.trim().length) {
      explicitEmoji = provider.emoji;
    }
  }

  // 1) explicit emoji on the provider object
  if (explicitEmoji) {
    return explicitEmoji;
  }

  // 2) providers map by id
  if (providerId) {
    const byId = providerMap[providerId];
    if (typeof byId === 'string' && byId.trim().length) {
      return byId;
    }
  }

  // 3) optional category fallback (e.g., "image", "video" live in core)
  if (category) {
    const catId = normaliseId(category);
    if (catId) {
      const byCategory = coreMap[catId];
      if (typeof byCategory === 'string' && byCategory.trim().length) {
        return byCategory;
      }
    }
  }

  return null;
}

export default {
  getEmoji,
  getTrendEmoji,
  getProviderEmoji,
};
