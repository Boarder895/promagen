// Convert ISO 3166-1 alpha-2 (e.g., "GB") into a flag emoji.
// Unknown codes return "🏳️".
export function flagEmoji(cc: string | null | undefined): string {
  if (!cc || cc === "ZZ") return "🏳️";
  return cc
    .toUpperCase()
    .replace(/./g, c => String.fromCodePoint((c.charCodeAt(0) - 65) + 0x1F1E6));
}
