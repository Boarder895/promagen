import { hash32 } from '@/lib/hash';

/**
 * Computes the next ISO timestamp when an item "should" refresh,
 * spreading refresh moments across an hour deterministically.
 *
 * Example: for 60 slots, each id maps to a minute in the hour.
 */
export function nextStaggerSlotISO(id: string, slots = 60, now = new Date()): string {
  const bucket = hash32(id) % slots; // 0..slots-1
  const dt = new Date(now);
  dt.setSeconds(0, 0);

  // Move to the next time this bucket occurs
  const currentMinute = dt.getMinutes();
  const nextMinute = bucket >= currentMinute ? bucket : bucket + 60;
  const deltaMin = nextMinute - currentMinute;

  dt.setMinutes(currentMinute + deltaMin);
  return dt.toISOString();
}
