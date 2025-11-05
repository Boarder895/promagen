// frontend/src/lib/market-hours.ts
// Sessions, workdays, exceptions, open/close logic, countdowns, progress.

export type Session = { startMin: number; endMin: number; kind?: "PRE" | "REG" | "POST" };
export type Sessions = Session[];

export type Exceptions =
  | { date: string; closed?: boolean; open?: string; close?: string };

const DOW = ["SUN","MON","TUE","WED","THU","FRI","SAT"] as const;

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return Math.max(0, Math.min(24 * 60, (h || 0) * 60 + (m || 0)));
}

export function minutesToHHMM(m: number) {
  const h = Math.floor(m / 60), mn = m % 60;
  return `${String(h).padStart(2,"0")}:${String(mn).padStart(2,"0")}`;
}

// Parse templates:
//  - CONTINUOUS_09:30_16:00
//  - SPLIT_09:00_11:30__12:30_15:00
//  - EXTENDED_PRE_07:00_09:30__REG_09:30_16:00__POST_16:00_20:00
export function parseHoursTemplate(tpl?: string | null): Sessions {
  if (!tpl) return [];
  if (tpl.startsWith("CONTINUOUS_")) {
    const m = tpl.match(/^CONTINUOUS_(\d{2}:\d{2})_(\d{2}:\d{2})$/);
    if (m) return [{ startMin: toMin(m[1]), endMin: toMin(m[2]), kind: "REG" }];
    return [];
  }
  if (tpl.startsWith("SPLIT_")) {
    const m = tpl.match(/^SPLIT_(\d{2}:\d{2})_(\d{2}:\d{2})__(\d{2}:\d{2})_(\d{2}:\d{2})$/);
    if (!m) return [];
    return [
      { startMin: toMin(m[1]), endMin: toMin(m[2]), kind: "REG" },
      { startMin: toMin(m[3]), endMin: toMin(m[4]), kind: "REG" },
    ];
  }
  if (tpl.startsWith("EXTENDED_")) {
    const parts = tpl.replace(/^EXTENDED_/, "").split("__");
    const out: Sessions = [];
    for (const p of parts) {
      const mm = p.match(/^(PRE|REG|POST)_(\d{2}:\d{2})_(\d{2}:\d{2})$/);
      if (mm) {
        const k = mm[1] as "PRE"|"REG"|"POST";
        out.push({ kind: k, startMin: toMin(mm[2]), endMin: toMin(mm[3]) });
      }
    }
    return out;
  }
  return [];
}

export function parseWorkdays(spec?: string | null): Set<number> {
  // Accept "MON-FRI", "SUN-THU", or "MON,TUE,WED,FRI"
  const def = new Set([1,2,3,4,5]); // MON-FRI
  if (!spec) return def;
  const days = new Set<number>();
  const tokens = spec.split(/[,\s]+/).filter(Boolean);
  for (const t of tokens) {
    if (!t) continue;
    if (t.includes("-")) {
      const [a,b] = t.split("-");
      const ai = DOW.indexOf(a as typeof DOW[number]), bi = DOW.indexOf(b as typeof DOW[number]);
      if (ai >= 0 && bi >= 0) {
        for (let i=0;i<7;i++){ const d = (ai + i) % 7; days.add(d); if (d === bi) break; }
      }
    } else {
      const i = DOW.indexOf(t as typeof DOW[number]);
      if (i >= 0) days.add(i);
    }
  }
  return days.size ? days : def;
}

export function localNowParts(tz: string) {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "numeric", minute: "2-digit", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d);
  const map: Record<string,string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const hh = Number(map.hour ?? "0"), mm = Number(map.minute ?? "0");
  const weekdayShort = map.weekday ?? "Mon";
  const dateISO = `${map.year}-${map.month}-${map.day}`;
  return { minutes: hh*60+mm, weekdayShort, dateISO };
}

export function applyExceptions(sessions: Sessions, exc: Exceptions[] | undefined, todayISO: string) {
  if (!exc || !exc.length) return sessions;
  const e = exc.find(x => x.date === todayISO);
  if (!e) return sessions;
  if (e.closed) return []; // fully closed today
  if (e.open && e.close) return [{ startMin: toMin(e.open), endMin: toMin(e.close), kind: "REG" }];
  return sessions;
}

export function isOpenNow(
  tz: string,
  tpl?: string | null,
  workdays?: string | null,
  halfDayClose?: string | null,
  exceptions?: Exceptions[]
) {
  const base = parseHoursTemplate(tpl);
  const { minutes, weekdayShort, dateISO } = localNowParts(tz);
  const wd = parseWorkdays(workdays);

  const dayMap = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6} as const;
  type WeekKey = keyof typeof dayMap;
  const dow = dayMap[(weekdayShort as WeekKey)] ?? 1;
  if (!wd.has(dow)) return { open:false, phase: "CLOSED" as const, sessions: [], minutes, dow, wd };

  let sessions = base;
  // Half-day close (e.g., 13:00) if provided by holiday evaluation
  if (halfDayClose) {
    const cut = toMin(halfDayClose);
    sessions = base.map(s => ({ ...s, endMin: Math.min(s.endMin, cut) }));
  }
  sessions = applyExceptions(sessions, exceptions, dateISO) as Session[];

  // Within which session?
  for (const s of sessions) {
    if (minutes >= s.startMin && minutes < s.endMin) {
      return { open: true, phase: (s.kind ?? "REG") as "PRE" | "POST" | "REG", sessions, minutes, dow, wd };
    }
  }
  // If not within any session, keep CLOSED ? but compute next event.
  return { open: false, phase: "CLOSED" as const, sessions, minutes, dow, wd };
}

export function nextEvent(tz: string, tpl?: string | null, workdays?: string | null, halfDayClose?: string | null, exceptions?: Exceptions[]) {
  const now = isOpenNow(tz, tpl, workdays, halfDayClose, exceptions);
  const s = now.sessions;
  if (!s.length) return { label: "Closed", minutes: 0 };
  if (now.open) {
    const current = s.find(x => now.minutes >= x.startMin && now.minutes < x.endMin)!;
    return { label: "Closes", minutes: current.endMin - now.minutes };
  } else {
    const future = s.find(x => x.startMin > now.minutes);
    if (future) return { label: "Opens", minutes: future.startMin - now.minutes };
    // next day open (simple)
    const first = s[0];
    return { label: "Opens", minutes: 24*60 - now.minutes + first.startMin };
  }
}

export function sessionProgress(minutes: number, sessions: Sessions) {
  const cur = sessions.find(x => minutes >= x.startMin && minutes < x.endMin);
  if (!cur) return 0;
  const span = cur.endMin - cur.startMin;
  return span > 0 ? Math.max(0, Math.min(100, Math.round(((minutes - cur.startMin) / span) * 100))) : 0;
}





