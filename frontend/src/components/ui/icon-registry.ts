// frontend/src/components/ui/icon-registry.ts
import { EMOJI_ICON_NAMES } from "@/components/ui/emoji";

/**
 * Registry used for diagnostics/menus.
 * Keep emoji as the literal union so callers get EmojiName, not string.
 */

// Placeholder lucide registry (expand when lucide is wired)
export const LucideIcons = {
  external_link: true,
  bookmark: true,
  save: true,
} as const;

export const ICON_REGISTRY = {
  // <- critical change: use the literal tuple from emoji.tsx
  emoji: EMOJI_ICON_NAMES,
  lucide: Object.keys(LucideIcons) as readonly string[],
} as const;

export type IconKind = keyof typeof ICON_REGISTRY;

