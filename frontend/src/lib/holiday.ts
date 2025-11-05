// frontend/src/lib/holidays.ts
// Tiny holiday rule engine. Intent: catalog-driven suppression without external APIs.
// Extend the maps below as needed; structure supports fixed dates, weekday rules, and moveable feasts stubs.

export type Holiday = {
  key: string;          // stable id, e.g. "new_year"
  name: string;         // display name
  date?: string;        // "MM-DD" (fixed date)
  rule?: string;        // simple rules: "nth-weekday-of-month", e.g. "MON-3-01" = 3rd Monday of Jan
  movable?: string;     // placeholder for complex (e.g., Easter-relative)
  halfDayClose?: string // "HH:MM" local early close time (optional)
};

export type HolidayCalendar = Record<string, Holiday[]>; // key = holiday id

// --- Helpers ---
function nthWeekdayOfMonth(year: number, month01: number, weekday0: number, n: number): Date {
  const d = new Date(Date.UTC(year, month01 - 1, 1));
  const firstW = d.getUTCDay(); // 0=Sun
  const offset = (7 + weekday0 - firstW) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return new Date(Date.UTC(year, month01 - 1, day));
}

// --- CALENDARS ---
// Keep them minimal and demonstrative. Add more per your `holidaysRef` keys in the catalog.
export const CAL: Record<string, Holiday[]> = {
  US: [
    { key: "new_year", name: "New Year's Day", date: "01-01" },
    { key: "mlk", name: "MLK Day", rule: "MON-3-01" },
    { key: "presidents", name: "Presidents' Day", rule: "MON-3-02" },
    { key: "memorial", name: "Memorial Day", rule: "MON-5-last" },
    { key: "independence", name: "Independence Day", date: "07-04", halfDayClose: "13:00" },
    { key: "labor", name: "Labor Day", rule: "MON-1-09" },
    { key: "thanksgiving", name: "Thanksgiving", rule: "THU-4-11", halfDayClose: "13:00" },
    { key: "christmas", name: "Christmas Day", date: "12-25", halfDayClose: "13:00" },
  ],
  GB: [
    { key: "new_year", name: "New Year's Day", date: "01-01" },
    { key: "good_friday", name: "Good Friday", movable: "easter-2" },
    { key: "easter_monday", name: "Easter Monday", movable: "easter+1" },
    { key: "early_may", name: "Early May Bank Holiday", rule: "MON-1-05" },
    { key: "spring_bank", name: "Spring Bank Holiday", rule: "MON-last-05" },
    { key: "summer_bank", name: "Summer Bank Holiday", rule: "MON-last-08" },
    { key: "christmas", name: "Christmas Day", date: "12-25" },
    { key: "boxing", name: "Boxing Day", date: "12-26" },
  ],
  JP: [
    { key: "new_year", name: "New Year's Day", date: "01-01" },
    { key: "foundation", name: "National Foundation Day", date: "02-11" },
    { key: "showa", name: "Showa Day", date: "04-29" },
    { key: "constitution", name: "Constitution Memorial Day", date: "05-03" },
    { key: "greenery", name: "Greenery Day", date: "05-04" },
    { key: "childrens", name: "Children's Day", date: "05-05" },
    { key: "culture", name: "Culture Day", date: "11-03" },
    { key: "labor_thanks", name: "Labor Thanksgiving Day", date: "11-23" },
  ],
  HK: [
    { key: "lunar_new_year_1", name: "Lunar New Year", movable: "lunar" },
    { key: "qingming", name: "Ching Ming Festival", movable: "qingming" },
    { key: "buddha", name: "Buddha's Birthday", movable: "buddha" },
    { key: "establishment", name: "HKSAR Establishment Day", date: "07-01" },
    { key: "national", name: "National Day", date: "10-01" },
    { key: "mid_autumn", name: "Day after Mid-Autumn", movable: "mid-autumn+1" },
    { key: "chung_yeung", name: "Chung Yeung Festival", movable: "chung-yeung" },
    { key: "christmas", name: "Christmas Day", date: "12-25" },
  ],
};

// --- Evaluation ---
function isSameLocalDate(d: Date, tz: string, month01: number, day: number): boolean {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const [dd, mm] = fmt.format(d).split("/"); // dd/mm/yyyy
  return Number(mm) === month01 && Number(dd) === day;
}

function lastWeekdayOfMonth(year: number, month01: number, weekday0: number): Date {
  const last = new Date(Date.UTC(year, month01, 0)); // last day of month
  const w = last.getUTCDay();
  const delta = (7 + w - weekday0) % 7;
  return new Date(Date.UTC(year, month01 - 1, last.getUTCDate() - delta));
}

function resolveRuleDateUTC(year: number, tz: string, rule: string): Date | null {
  // "MON-3-01" (3rd Monday of Jan), "MON-last-05"
  const m = rule.match(/^(SUN|MON|TUE|WED|THU|FRI|SAT)-(last|[1-5])-(\d{2})$/i);
  if (!m) return null;
  const weekday0 = ["SUN","MON","TUE","WED","THU","FRI","SAT"].indexOf(m[1].toUpperCase());
  const ord = m[2];
  const month01 = Number(m[3]);
  if (ord === "last") {
    return lastWeekdayOfMonth(year, month01, weekday0);
  }
  const n = Number(ord);
  return nthWeekdayOfMonth(year, month01, weekday0, n);
}

// For brevity, movable feasts beyond Easter are marked TODO (you can extend later).
function easterUTC(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19, b = Math.floor(year/100), c = year % 100;
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1)/3), h = (19*a + b - d - g + 15) % 30;
  const i = Math.floor(c/4), k = c % 4;
  const l = (32 + 2*e + 2*i - h - k) % 7;
  const m = Math.floor((a + 11*h + 22*l)/451);
  const month = Math.floor((h + l - 7*m + 114)/31);   // 3=March, 4=April
  const day = ((h + l - 7*m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function shiftDays(d: Date, days: number) { const nd = new Date(d); nd.setUTCDate(nd.getUTCDate()+days); return nd; }

function isHolidayToday(tz: string, holidaysRef?: string | null): { isHoliday: boolean; name?: string; halfClose?: string } {
  if (!holidaysRef || !CAL[holidaysRef]) return { isHoliday: false };
  const now = new Date();
  const cal = CAL[holidaysRef];
  const year = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric" }).format(now));

  for (const h of cal) {
    if (h.date) {
      const [mm, dd] = h.date.split("-").map(Number);
      if (isSameLocalDate(now, tz, mm, dd)) return { isHoliday: true, name: h.name, halfClose: h.halfDayClose };
    } else if (h.rule) {
      const dt = resolveRuleDateUTC(year, tz, h.rule);
      if (dt && isSameLocalDate(dt, tz, Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, month: "2-digit" }).format(now)), Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit" }).format(now)))) {
        return { isHoliday: true, name: h.name, halfClose: h.halfDayClose };
      }
    } else if (h.movable?.startsWith("easter")) {
      const delta = Number(h.movable.split(/easter/)[1] || 0); // naive +/- days
      const e = easterUTC(year);
      const d = shiftDays(e, delta);
      if (isSameLocalDate(d, tz, Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, month: "2-digit" }).format(now)), Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit" }).format(now)))) {
        return { isHoliday: true, name: h.name, halfClose: h.halfDayClose };
      }
    } else {
      // TODO: lunar-based holidays etc.
      continue;
    }
  }
  return { isHoliday: false };
}

export function evaluateHoliday(tz: string, holidaysRef?: string | null) {
  return isHolidayToday(tz, holidaysRef);
}



