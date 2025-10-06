declare module "luxon" {
  export type ZoneLike = string | undefined;

  export class Duration {
    static fromObject(obj: any): Duration;
    toISO(): string | null;
    as(unit: string): number;
    toObject(): {
      years?: number; quarters?: number; months?: number; weeks?: number; days?: number;
      hours?: number; minutes?: number; seconds?: number; milliseconds?: number;
    };
    years: number; quarters: number; months: number; weeks: number; days: number;
    hours: number; minutes: number; seconds: number; milliseconds: number;
  }

  export class DateTime {
    static now(): DateTime;
    static utc(
      year?: number, month?: number, day?: number,
      hour?: number, minute?: number, second?: number, millisecond?: number
    ): DateTime;
    static fromISO(s: string, opts?: { zone?: ZoneLike }): DateTime;
    static fromMillis(ms: number, opts?: { zone?: ZoneLike }): DateTime;

    readonly year: number; readonly month: number; readonly day: number;
    readonly hour: number; readonly minute: number; readonly second: number; readonly millisecond: number;
    readonly weekday: number;         // 1..7 (Mon..Sun)
    readonly offset: number;          // minutes offset from UTC (east positive)

    setZone(zone: ZoneLike): DateTime;
    plus(dur: any): DateTime;
    minus(dur: any): DateTime;
    set(values: {
      year?: number; month?: number; day?: number;
      hour?: number; minute?: number; second?: number; millisecond?: number;
      [key: string]: any;
    }): DateTime;
    startOf(unit: string): DateTime;
    endOf(unit: string): DateTime;

    diff(other: DateTime, unit?: string | string[], opts?: any): Duration;
    diffNow(unit?: string | string[], opts?: any): Duration;

    toISO(): string | null;
    toISODate(): string;
    toFormat(fmt: string): string;
    toMillis(): number;
  }

  export class Interval {
    start: DateTime;
    end: DateTime;
    static fromDateTimes(start: DateTime, end: DateTime): Interval;
    static after(start: DateTime, dur: any): Interval;
    static before(end: DateTime, dur: any): Interval;
    contains(dt: DateTime): boolean;
    length(unit: string): number;
    splitBy(dur: any): Interval[];
  }
}

