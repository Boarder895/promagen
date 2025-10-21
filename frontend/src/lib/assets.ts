// src/lib/assets.ts
// Centralised helpers for static assets (flags, etc.). Keeps paths lowercase
// so Windows/macOS dev doesn't hide case-sensitivity bugs that break in prod.

/** Default ISO2 used when a market has no country code */
export const DEFAULT_FLAG_ISO2 = "us";

/**
 * Base path for local flags served from Next.js public/
 * (We keep this lowercase intentionally.)
 */
export const FLAG_PATH = "/flags";

/**
 * Optional: flip to true to serve from a CDN instead of local public/flags
 * (handy if you don't want to commit SVGs). Local by default.
 */
export const USE_CDN_FLAGS = false;

/** Normalise any incoming ISO2 ? clean lowercase a-z */
const cleanIso2 = (iso2?: string) =>
  (iso2 ?? DEFAULT_FLAG_ISO2).toLowerCase().replace(/[^a-z]/g, "");

/** Build the flag URL (local or CDN), always lowercase path for safety */
export function flagSrc(iso2?: string): string {
  const cc = cleanIso2(iso2);

  if (USE_CDN_FLAGS) {
    // CDN expects UPPERCASE filenames in this package path
    return `https://cdn.jsdelivr.net/npm/country-flag-icons@latest/3x2/${cc.toUpperCase()}.svg`;
  }

  const base = (FLAG_PATH || "/flags").toLowerCase();
  return `${base}/${cc}.svg`;
}

/**
 * <img onError={flagOnError} ... />
 * When a specific ISO file is missing, swap in a safe fallback once.
 */
export function flagOnError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackIso2: string = DEFAULT_FLAG_ISO2
) {
  try {
    const img = e.currentTarget;
    if (img.dataset.fallback === "1") return; // already swapped
    img.src = flagSrc(fallbackIso2);
    img.dataset.fallback = "1";
  } catch {
    /* no-op */
  }
}

/** Optional: preload a flag to avoid layout shimmer the first time */
export function preloadFlag(iso2?: string) {
  if (typeof document === "undefined") return;
  const href = flagSrc(iso2);
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = href;
  document.head.appendChild(link);
}

