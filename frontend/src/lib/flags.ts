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

/** Emoji fallback (GB -> 🇬🇧). */
export function flagEmoji(cc: string): string {
  const s = (cc || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(s)) return "🏳️";
  const base = 0x1f1e6;
  return String.fromCodePoint(base + (s.charCodeAt(0) - 65)) +
         String.fromCodePoint(base + (s.charCodeAt(1) - 65));
}












