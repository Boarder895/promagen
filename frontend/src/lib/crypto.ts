// Minimal placeholder to satisfy imports during Stage 1.
// Rename unused param to underscore to comply with eslint rule.

export function hashProvider(_provider: string): string {
  // Simple non-cryptographic hash; replace with real impl later.
  let h = 0;
  for (let i = 0; i < _provider.length; i++) {
    h = (h * 31 + _provider.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}






