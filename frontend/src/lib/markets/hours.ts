/**
 * Parses exchange hours templates into minute ranges.
 * Defensive: all regex groups are checked before use.
 */
export type Session = { startMin: number; endMin: number; kind: "REG" | "PRE" | "POST" };

function toMin(s: string | undefined): number {
  if (!s) return 0;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function parseHours(template?: string): Session[] {
  if (!template) return [];
  // Examples:
  // "REG 09:00-17:30"
  // "PRE 08:00-09:00; REG 09:00-17:30; POST 17:30-18:30"
  const parts = template.split(";").map((s) => s.trim()).filter(Boolean);
  const out: Session[] = [];

  for (const p of parts) {
    const m = /^(PRE|REG|POST)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/.exec(p.toUpperCase());
    if (!m) continue;
    const kind = m[1] as Session["kind"];
    out.push({ kind, startMin: toMin(m[2]), endMin: toMin(m[3]) });
  }
  return out;
}

export function minutesUntilOpen(now: { minutes: number }, sessions: Session[]): { label: "Opens" | "Closes"; minutes: number } | null {
  if (!sessions.length) return null;
  const first = sessions[0];
  if (!first) return null;
  return { label: "Opens", minutes: 24 * 60 - now.minutes + first.startMin };
}
