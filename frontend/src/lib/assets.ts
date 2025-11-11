// frontend/src/lib/assets.ts
import type React from "react";

/** Default ISO2 when a market has no country code */
export const DEFAULT_FLAG_ISO2 = "us";

/** Base path for local flags (if you serve from /public/flags) */
export const FLAG_PATH = "/flags";

/** Return a local flag URL (lowercase iso2) */
export function flagSrc(iso2?: string): string {
  const code = (iso2 || DEFAULT_FLAG_ISO2).toLowerCase();
  return `${FLAG_PATH}/${code}.svg`;
}

/** Swap the image src to a fallback flag if the original fails */
export function onFlagError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackIso2 = DEFAULT_FLAG_ISO2
): void {
  const img = e.currentTarget;
  img.src = flagSrc(fallbackIso2);
  img.dataset.fallback = "1";
}

/** Optional: preload a flag to avoid first-use shimmer */
export function preloadFlag(iso2?: string) {
  if (typeof document === "undefined") {return;}
  const href = flagSrc(iso2);
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = href;
  document.head.appendChild(link);
}

