export type HolidayOverrides = {
  [marketId: string]: {
    holidays?: string[]; // YYYY-MM-DD
    halfDays?: { [isoDate: string]: string }; // close time like "14:00"
  }
};

export const HOLIDAY_OVERRIDES: HolidayOverrides = {
  // examples:
  moscow: { holidays: ["2025-11-04"] },
  // extend over time
};
