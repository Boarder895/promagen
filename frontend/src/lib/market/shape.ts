// Small typed utilities used by the homepage. Zero 'any'.

/** Clamp a number between min and max. */
export function clamp(x: number, min: number, max: number): number {
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

/** Map a temperature in ?C to a hue (blue @ cold ? red @ hot). */
export function hueFromTempC(tempC: number): number {
  const t = clamp(tempC, -20, 40);
  const ratio = (t - (-20)) / (40 - (-20)); // 0..1
  // 220 (cool blue) ? 10 (warm red)
  return Math.round(220 + (10 - 220) * ratio);
}

/** Lightweight className combiner without 'any'. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Type guard to filter defined values in arrays. */
export function isDefined<T>(x: T | null | undefined): x is T {
  return x !== null && x !== undefined;
}



