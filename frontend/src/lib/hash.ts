// Tiny non-crypto hash for stable bucketing (e.g. staggering)
// Deterministic across server runs for the same key.
export function hash32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
