// Compare current vs prior close once per day.
// We clamp tiny moves to "none" so the arrow doesn't appear on noise.

export function computeDailyArrow(
  prevClose: number,
  current: number,
  flatTolerancePct = 0.0001
): 'up' | 'none' {
  if (!isFinite(prevClose) || !isFinite(current) || prevClose === 0) {return 'none';}
  const pct = (current - prevClose) / prevClose;
  if (Math.abs(pct) <= flatTolerancePct) {return 'none';}
  return pct > 0 ? 'up' : 'none'; // Only green up by spec
}
