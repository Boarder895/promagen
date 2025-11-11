import * as React from "react";

/** Single source of truth for allowed emoji names. */
export const EMOJI_ICON_NAMES = [
  // core
  "brain",
  "bookmark",
  "dice",
  "save",
  "trend_up",
  "trend_down",
  "trend_flat",

  // categories already used in the app
  "food",
  "nature",
  "music",
  "people",
  "providers",
  "symbols",

  // additional categories used by emoji-icons.tsx
  "trends",
  "core",
  "finance",
  "currencies",
  "weather",
  "space",
  "sports",
  "seasons",
  "alerts",
  "ui",
  "transport",
  "science",
  "tech",
] as const;

export type EmojiName = (typeof EMOJI_ICON_NAMES)[number];

const EMOJI_MAP: Record<EmojiName, string> = {
  // core
  brain: "??",
  bookmark: "??",
  dice: "??",
  save: "??",
  trend_up: "??",
  trend_down: "??",
  trend_flat: "??",

  // categories
  food: "???",
  nature: "??",
  music: "??",
  people: "????????",
  providers: "??",
  symbols: "??",

  // extra categories
  trends: "??",
  core: "??",
  finance: "??",
  currencies: "??",
  weather: "?",
  space: "??",
  sports: "??",
  seasons: "??",
  alerts: "??",
  ui: "???",
  transport: "??",
  science: "??",
  tech: "??",
};

export type EmojiProps = {
  name: EmojiName;
  className?: string;
  title?: string;
  "aria-label"?: string;
};

export function Emoji({ name, className, title, ...rest }: EmojiProps) {
  const glyph = EMOJI_MAP[name];
  return (
    <span
      role="img"
      aria-label={rest["aria-label"] ?? name}
      className={className}
      title={title ?? name.replaceAll("_", " ")}
    >
      {glyph}
    </span>
  );
}

/** Optional named exports for direct JSX usage */
export const BrainIcon = (p: { className?: string }) => <Emoji name="brain" {...p} />;
export const BookmarkIcon = (p: { className?: string }) => <Emoji name="bookmark" {...p} />;
export const DiceIcon = (p: { className?: string }) => <Emoji name="dice" {...p} />;
export const SaveIcon = (p: { className?: string }) => <Emoji name="save" {...p} />;
export const TrendUpIcon = (p: { className?: string }) => <Emoji name="trend_up" {...p} />;
export const TrendDownIcon = (p: { className?: string }) => <Emoji name="trend_down" {...p} />;
export const TrendFlatIcon = (p: { className?: string }) => <Emoji name="trend_flat" {...p} />;

