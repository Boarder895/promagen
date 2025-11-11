// frontend/src/data/emoji.ts
import emojiBank from "@/data/emoji-bank.json";

// Build fast lookup maps once
type IdEmoji = { id: string; emoji: string };

function toMap(arr: IdEmoji[] | undefined): Record<string, string> {
  return (arr ?? []).reduce<Record<string, string>>((acc, item) => {
    acc[item.id] = item.emoji;
    return acc;
  }, {});
}

const trendMap = toMap((emojiBank as any).trends);
const coreMap = toMap((emojiBank as any).core);
const financeMap = toMap((emojiBank as any).finance);
const weatherMap = toMap((emojiBank as any).weather);
const spaceMap = toMap((emojiBank as any).space);
const sportsMap = toMap((emojiBank as any).sports);
const seasonsMap = toMap((emojiBank as any).seasons);
const alertsMap = toMap((emojiBank as any).alerts);
const uiMap = toMap((emojiBank as any).ui);
const transportMap = toMap((emojiBank as any).transport);
const scienceMap = toMap((emojiBank as any).science);
const techMap = toMap((emojiBank as any).tech);
const foodMap = toMap((emojiBank as any).food);
const natureMap = toMap((emojiBank as any).nature);
const musicMap = toMap((emojiBank as any).music);

// Providers are already a flat map in the JSON
const providerMap: Record<string, string> = (emojiBank as any).providers ?? {};

// Generic getter by “section” then id (handy for future use)
export function getEmoji(section: string, id: string | undefined | null): string | null {
  if (!id) {return null;}
  const sectionMap =
    {
      trends: trendMap,
      core: coreMap,
      finance: financeMap,
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
      providers: providerMap,
    }[section] ?? {};

  return sectionMap[id] ?? null;
}

/**
 * getTrendEmoji – resolves a trend id like "up" | "down" | "rocket" to its emoji.
 * Returns null when unknown.
 */
export function getTrendEmoji(trendId?: string | null): string | null {
  if (!trendId) {return null;}
  return trendMap[trendId] ?? null;
}

/**
 * getProviderEmoji – resolves a provider to an emoji with sensible fallbacks.
 * Priority:
 *   1) explicit provider.emoji (from data pipelines)
 *   2) providers map in emoji-bank.json
 *   3) optional category fallback via "core" set (if you pass category)
 */
export type ProviderLike = { id: string; emoji?: string; category?: string } | string;

export function getProviderEmoji(provider: ProviderLike): string | null {
  if (typeof provider === "string") {
    return providerMap[provider] ?? null;
  }

  // 1) explicit on the object
  if (provider.emoji && provider.emoji.trim().length) {return provider.emoji;}

  // 2) providers map
  const byId = providerMap[provider.id];
  if (byId) {return byId;}

  // 3) optional category fallback (e.g., "image", "video", etc. live in core)
  if (provider.category) {
    const byCategory = coreMap[provider.category];
    if (byCategory) {return byCategory;}
  }

  return null;
}

