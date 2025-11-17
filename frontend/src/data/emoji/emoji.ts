// frontend/src/data/emoji/emoji.ts
import emojiBank from '@/data/emoji/emoji-bank.json';

type IdEmoji = {
  id: string;
  emoji: string;
};

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
  symbols: symbolsMap,
  providers: providerMap,
} as const;

export type EmojiSection = keyof typeof SECTION_MAPS;

/**
 * Generic lookup by section then id.
 * Returns null if the section/id pair does not exist.
 */
export function getEmoji(section: EmojiSection, id: string | undefined | null): string | null {
  if (!id) {
    return null;
  }

  const sectionMap = SECTION_MAPS[section];

  if (!sectionMap) {
    return null;
  }

  return sectionMap[id] ?? null;
}

/**
 * Helper for trend emojis: "up", "down", "flat", etc.
 */
export function getTrendEmoji(trend: string | null | undefined): string | null {
  if (!trend) {
    return null;
  }

  return trendMap[trend] ?? null;
}

type ProviderLike = {
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
export function getProviderEmoji(provider: ProviderLike): string | null {
  // 1) explicit emoji on the provider object
  if (provider.emoji && provider.emoji.trim().length) {
    return provider.emoji;
  }

  // 2) providers map by id
  const byId = providerMap[provider.id];
  if (byId) {
    return byId;
  }

  // 3) optional category fallback (e.g., "image", "video" live in core)
  if (provider.category) {
    const byCategory = coreMap[provider.category];
    if (byCategory) {
      return byCategory;
    }
  }

  return null;
}
