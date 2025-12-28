'use client';

import * as React from 'react';
import EMOJI_BANK from '@/data/emoji/emoji-bank.json';

export type ExchangeConditionProps = {
  /** Weather condition emoji from API; null triggers SSOT fallback */
  emoji: string | null;
  /** Optional condition text for accessibility */
  condition?: string | null;
  /** Optional className for styling */
  className?: string;
};

type EmojiEntry = {
  id: string;
  emoji: string;
};

type EmojiBank = {
  weather: EmojiEntry[];
};

const FALLBACK_WEATHER_EMOJI = '☀️';

/**
 * Get weather emojis from SSOT (emoji-bank.json).
 * Guarantees at least one emoji.
 */
function getWeatherEmojis(): string[] {
  const bank = EMOJI_BANK as EmojiBank;

  if (!bank.weather || !Array.isArray(bank.weather)) {
    return [FALLBACK_WEATHER_EMOJI];
  }

  const emojis = bank.weather
    .map((entry) => (typeof entry?.emoji === 'string' ? entry.emoji.trim() : ''))
    .filter((e) => e.length > 0);

  return emojis.length > 0 ? emojis : [FALLBACK_WEATHER_EMOJI];
}

/**
 * Get a deterministic "random" emoji based on current hour.
 * This ensures the emoji doesn't change every render but still varies throughout the day.
 */
function getRandomWeatherEmoji(): string {
  const emojis = getWeatherEmojis();
  const hour = new Date().getHours();
  const index = emojis.length > 0 ? hour % emojis.length : 0;
  return emojis[index] ?? FALLBACK_WEATHER_EMOJI;
}

/**
 * ExchangeCondition - Displays weather condition emoji.
 *
 * When API weather is unavailable, shows a random emoji from SSOT
 * (emoji-bank.json → weather group). The "random" selection is
 * deterministic based on current hour to avoid flickering.
 */
export const ExchangeCondition = React.memo(function ExchangeCondition({
  emoji,
  condition,
  className = '',
}: ExchangeConditionProps) {
  // Use provided emoji or fall back to SSOT
  const displayEmoji = emoji && emoji.trim().length > 0 ? emoji : getRandomWeatherEmoji();

  const ariaLabel = condition && condition.trim().length > 0 ? condition : 'Weather condition';

  return (
    <span
      className={`text-lg ${className}`}
      role="img"
      aria-label={ariaLabel}
      title={condition ?? undefined}
    >
      {displayEmoji}
    </span>
  );
});

export default ExchangeCondition;
