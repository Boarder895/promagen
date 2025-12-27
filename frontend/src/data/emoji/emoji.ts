// frontend/src/data/emoji/emoji.ts
import emojiBankJson from '@/data/emoji/emoji-bank.json';

import { emojiBankSchema } from '@/data/emoji/emoji-bank.schema';

export type IdEmoji = {
  id: string;
  emoji: string;
};

export type BudgetGuardState = 'ok' | 'warning' | 'blocked';

export type ProviderLike = { id: string; emoji?: string };

const emojiBank = emojiBankSchema.parse(emojiBankJson);

export type EmojiBank = typeof emojiBank;

export type EmojiSection = Exclude<keyof EmojiBank, 'providers'>;

function normaliseId(id: string): string {
  return id.trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_').replace(/_+/g, '_');
}

function toMap(list: ReadonlyArray<IdEmoji>): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of list) {
    map.set(normaliseId(entry.id), entry.emoji);
  }
  return map;
}

const SECTION_MAPS: Record<EmojiSection, Map<string, string>> = {
  trends: toMap(emojiBank.trends),
  core: toMap(emojiBank.core),
  finance: toMap(emojiBank.finance),
  currencies: toMap(emojiBank.currencies),
  weather: toMap(emojiBank.weather),
  space: toMap(emojiBank.space),
  sports: toMap(emojiBank.sports),
  seasons: toMap(emojiBank.seasons),
  budget_guard: toMap(emojiBank.budget_guard),
  alerts: toMap(emojiBank.alerts),
  ui: toMap(emojiBank.ui),
  transport: toMap(emojiBank.transport),
  science: toMap(emojiBank.science),
  tech: toMap(emojiBank.tech),
  food: toMap(emojiBank.food),
  nature: toMap(emojiBank.nature),
  music: toMap(emojiBank.music),
  people: toMap(emojiBank.people),
  symbols: toMap(emojiBank.symbols),
};

/**
 * SSOT emoji lookup.
 *
 * Returns null when unknown.
 */
export function getEmoji(section: EmojiSection, id: string | null | undefined): string | null {
  if (!id) return null;

  const key = normaliseId(id);
  if (!key) return null;

  const map = SECTION_MAPS[section];
  return map.get(key) ?? null;
}

/**
 * Canonical budget-state emoji lookup (🛫 / 🏖️ / 🧳) from Emoji Bank SSOT.
 */
export function getBudgetGuardEmoji(state: BudgetGuardState): string | null {
  return getEmoji('budget_guard', state);
}

export function getTrendEmoji(
  trend: 'up' | 'down' | 'flat' | 'rocket' | 'crash' | null | undefined,
): string | null {
  return trend ? getEmoji('trends', trend) : null;
}

export function getProviderEmoji(
  provider: ProviderLike | string | null | undefined,
): string | null {
  const providersMap = emojiBank.providers;

  if (!provider) return null;

  if (typeof provider === 'string') {
    const raw = provider.trim();
    if (!raw) return null;
    return providersMap[raw] ?? providersMap[normaliseId(raw)] ?? null;
  }

  if (provider.emoji) return provider.emoji;

  const raw = provider.id?.trim();
  if (!raw) return null;

  return providersMap[raw] ?? providersMap[normaliseId(raw)] ?? null;
}

export default {
  getEmoji,
  getBudgetGuardEmoji,
  getTrendEmoji,
  getProviderEmoji,
};
