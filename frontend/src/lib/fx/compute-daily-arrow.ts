// frontend/src/lib/fx/compute-daily-arrow.ts
// Compare current vs prior close once per day.
// Tiny moves are clamped to "none" so the arrow does not flicker on noise.

export type DailyArrowDirection = 'up' | 'none';

const DEFAULT_FLAT_TOLERANCE_PCT = 0.0001;

/**
 * Returns "up" when the current value is meaningfully higher than the previous
 * close, otherwise "none". Down moves are represented by the absence of an
 * arrow – this keeps the ribbon visually calm.
 */
export function computeDailyArrow(
  prevClose: number,
  current: number,
  flatTolerancePct: number = DEFAULT_FLAT_TOLERANCE_PCT,
): DailyArrowDirection {
  if (!Number.isFinite(prevClose) || !Number.isFinite(current) || prevClose === 0) {
    return 'none';
  }

  const pctChange = (current - prevClose) / prevClose;

  if (Math.abs(pctChange) <= flatTolerancePct) {
    return 'none';
  }

  // By design we only show a positive "up" arrow – down moves are represented
  // by the absence of an arrow.
  return pctChange > 0 ? 'up' : 'none';
}
