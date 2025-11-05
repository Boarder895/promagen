// frontend/src/lib/flags.ts
import type React from "react";

export function flag(iso2: string): string {
  const base = "https://cdn.jsdelivr.net/npm/country-flag-icons/3x2";
  return `${base}/${(iso2 || "UN").toUpperCase()}.svg`;
}

export function flagOnError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackIso2 = "UN"
): void {
  const img = e.currentTarget;
  img.src = flag(fallbackIso2);
  img.dataset.fallback = "1";
}

export function preloadFlag(iso2: string): void {
  if (typeof document === "undefined") return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = flag(iso2);
  document.head.appendChild(link);
}

