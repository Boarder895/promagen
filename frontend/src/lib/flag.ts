// frontend/src/lib/flag.ts
export function flagEmoji(cc?: string) {
  if (!cc) return '🏳️';
  const code = cc.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}
export const flag = flagEmoji; // alias if some files import default
export default flagEmoji;
