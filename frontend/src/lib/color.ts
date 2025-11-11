// frontend/src/lib/color.ts
// Typed color utilities used across ribbons/cards.
// Self-contained to avoid mismatches with external types.

export type MarketStatus = "open" | "closed" | "pre" | "post" | "holiday" | "unknown";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Map temperature °C ? hue (cold?blue 220, hot?red 10). */
export function hueFromTempC(tempC: number): number {
  const t = clamp(tempC, -20, 40);
  const ratio = (t - (-20)) / 60; // 0..1
  return Math.round(220 + (10 - 220) * ratio);
}

/** HSL color from temperature for dark UI backgrounds. */
export function tempToColor(tempC: number): string {
  return `hsl(${hueFromTempC(tempC)} 70% 16%)`;
}
/** Back-compat alias some files import. */
export const tempColor = tempToColor;

/** Normalize loose strings to the MarketStatus union. */
export function normalizeStatus(s: unknown): MarketStatus {
  const v = String(s ?? "unknown").toLowerCase();
  if (v === "open") {return "open";}
  if (v === "closed") {return "closed";}
  if (v === "holiday") {return "holiday";}
  if (v === "pre" || v === "preopen" || v === "pre-open") {return "pre";}
  if (v === "post" || v === "postclose" || v === "post-close") {return "post";}
  return "unknown";
}

/** Convert status to a saturation weight for chip tints (0–100). */
export function stateSat(status: MarketStatus): number {
  switch (status) {
    case "open":    return 85;
    case "pre":
    case "post":    return 65;
    case "holiday": return 35;
    case "closed":
    case "unknown":
    default:        return 30;
  }
}

/** Background tint for chips based on temperature + status. */
export function chipColor(tempC: number | null, status: MarketStatus | string): string {
  const t = typeof tempC === "number" ? tempC : 12;             // neutral default
  const sat = stateSat(normalizeStatus(status));
  return `hsl(${hueFromTempC(t)} ${clamp(sat, 0, 100)}% / 0.48)`;
}

/** Simple CSS gradient helper. */
export function blend(leftColor: string, rightColor: string): string {
  return `linear-gradient(90deg, ${leftColor}, ${rightColor})`;
}





