type Holiday = { name: string; halfDayClose?: boolean; date: string; weekday?: string };

function weekdayIndex(short: string): number {
  const map = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return map.indexOf(short.toUpperCase());
}

function isSameLocalDate(now: Date, tz: string, mm?: number, dd?: number): boolean {
  if (typeof mm !== "number" || typeof dd !== "number") return false;
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(now);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const curM = Number(p.month);
  const curD = Number(p.day);
  return curM === mm && curD === dd;
}

export function evaluateHoliday(now: Date, tz: string, h: Holiday): { isHoliday: true; name: string; halfClose?: boolean } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(h.date);
  if (!m) return null;
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (isSameLocalDate(now, tz, mm, dd)) {
    return { isHoliday: true, name: h.name, halfClose: h.halfDayClose };
  }
  return null;
}

export function weekdayFrom(h: Holiday): number | null {
  if (!h.weekday) return null;
  const idx = weekdayIndex(h.weekday);
  return idx >= 0 ? idx : null;
}
