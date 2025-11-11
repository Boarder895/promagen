export type Exchange = {
  id: string;            // e.g. "LSE"
  exchange: string;      // e.g. "London Stock Exchange"
  city: string;          // e.g. "London"
  iso2: string;          // e.g. "GB"
  tz: string;            // IANA tz, e.g. "Europe/London"
  latitude?: number;
  longitude?: number;
  hoursTemplate?: string | null;
  workdays?: string | null;
  holidaysRef?: string | null;
  exceptions?: Array<{
    date: string;        // ISO date
    isOpen: boolean;
    note?: string;
  }>;
};
