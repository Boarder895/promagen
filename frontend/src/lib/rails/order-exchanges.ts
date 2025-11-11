import type { Exchange } from "@/types/exchange";

/**
 * Sorts east→west and splits into left/right rails.
 * Undefined longitudes are pushed to the end deterministically.
 */
export function orderForRails(selected: Exchange[]): { left: Exchange[]; right: Exchange[] } {
  const normalised = [...selected].map((e) => ({
    ...e,
    longitude: typeof e.longitude === "number" ? e.longitude : -1000 // sentinel: far east
  }));

  const eastToWest = normalised.sort((a, b) => {
    const la = a.longitude!;
    const lb = b.longitude!;
    if (la === lb) return (a.city || a.id).localeCompare(b.city || b.id);
    return lb - la; // higher longitude (more easterly) first
  });

  const half = Math.ceil(eastToWest.length / 2);
  return { left: eastToWest.slice(0, half), right: eastToWest.slice(half) };
}
