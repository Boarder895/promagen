/** Format a date to local HH:MM in a given IANA timeZone. */
export function formatLocalHM(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}

/** Linear blend helper some components import. */
export function blend(a: number, b: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return a + (b - a) * clamped;
}

/** Preview helper some routes import. */
export function previewDate(d: Date = new Date()): string {
  return d.toISOString();
}

/** Legacy stubs certain prototypes may import — keep them no-op for Stage-1. */
export function currentOpenState(): "open" | "closed" | "unknown" { return "unknown"; }
export function currentOpensAt(): string | null { return null; }





