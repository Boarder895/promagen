/**
 * Convert a 2-letter ISO country code to a flag emoji.
 * Falls back gracefully if the code is missing/invalid.
 */
const PRESET: Record<string, string> = {
  GB: '🇬🇧',
  US: '🇺🇸',
  AU: '🇦🇺',
  NZ: '🇳🇿',
  CA: '🇨🇦',
  IE: '🇮🇪',
};

export function flagEmoji(code?: string): string {
  if (!code) return '🏳️';
  const cc = code.toUpperCase().trim();
  if (PRESET[cc]) return PRESET[cc];
  if (!/^[A-Z]{2}$/.test(cc)) return '🏳️';

  // Build from regional indicator symbols
  const A = 'A'.charCodeAt(0);
  const base = 0x1f1e6; // 🇦
  const chars = [...cc].map((c) => String.fromCodePoint(base + (c.charCodeAt(0) - A)));
  return chars.join('');
}
export default flagEmoji;
