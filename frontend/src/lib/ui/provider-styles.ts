// src/lib/ui/provider-styles.ts
// Promagen UI tokens & helpers used by UI components (focus ring etc).
// Keep this lean and stable. No component imports here.

export type ClassValue = string | undefined | null | false;

/** Tiny class merger that ignores falsy values. */
export function cx(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Focus ring token (sky-400) to satisfy Promagen Global Standard:
 * - visible on keyboard focus
 * - no outline shimmy
 * - offset to avoid clipping on rounded elements
 */
export const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

/**
 * A conservative subdued button baseline used by several compact controls.
 * Kept here so audits find a single source of truth.
 */
export const SUBTLE_TAB_BASE =
  "rounded px-3 py-1 text-sm data-[selected=true]:font-semibold";

/**
 * Historical export kept for compatibility. If your design system defines
 * richer label styles elsewhere, update this constant and consumers inherit it.
 */
export const PROVIDER_STYLE_LABEL = "text-white/80";
