// Stage-1 static exchange data (local open/close times).
// Times are *local* to each exchange's IANA tz.

export type ExchangeInfo = {
  exchange: string;      // short code (UI fallback for "code")
  name: string;          // display name
  city: string;
  country: string;
  tz: string;            // IANA timezone
  open: string;          // "HH:MM" local
  close: string;         // "HH:MM" local
  indexSymbol: string;   // major index ticker/symbol
  holidayCalendarRef?: string;
};

export const exchanges: ExchangeInfo[] = [
  { exchange: "ASX",    name: "Australian Securities Exchange", city: "Sydney",    country: "Australia", tz: "Australia/Sydney",  open: "10:00", close: "16:00", indexSymbol: "^AXJO", holidayCalendarRef: "au" },
  { exchange: "TSE",    name: "Tokyo Stock Exchange",           city: "Tokyo",     country: "Japan",     tz: "Asia/Tokyo",        open: "09:00", close: "15:00", indexSymbol: "^N225", holidayCalendarRef: "jp" },
  { exchange: "HKEX",   name: "Hong Kong Exchange",             city: "Hong Kong", country: "China (HK)",tz: "Asia/Hong_Kong",    open: "09:30", close: "16:00", indexSymbol: "^HSI",  holidayCalendarRef: "hk" },
  { exchange: "SSE",    name: "Shanghai Stock Exchange",        city: "Shanghai",  country: "China",     tz: "Asia/Shanghai",     open: "09:30", close: "15:00", indexSymbol: "000001.SS", holidayCalendarRef: "cn" },
  { exchange: "SGX",    name: "Singapore Exchange",             city: "Singapore", country: "Singapore", tz: "Asia/Singapore",    open: "09:00", close: "17:00", indexSymbol: "^STI", holidayCalendarRef: "sg" },
  { exchange: "NSE",    name: "National Stock Exchange",        city: "Mumbai",    country: "India",     tz: "Asia/Kolkata",      open: "09:15", close: "15:30", indexSymbol: "^NSEI", holidayCalendarRef: "in" },
  { exchange: "DFM",    name: "Dubai Financial Market",         city: "Dubai",     country: "UAE",       tz: "Asia/Dubai",        open: "10:00", close: "14:45", indexSymbol: "DFMGI", holidayCalendarRef: "ae" },
  { exchange: "FWB",    name: "Frankfurt Stock Exchange",       city: "Frankfurt", country: "Germany",   tz: "Europe/Berlin",     open: "09:00", close: "17:30", indexSymbol: "^GDAXI", holidayCalendarRef: "de" },
  { exchange: "LSE",    name: "London Stock Exchange",          city: "London",    country: "UK",        tz: "Europe/London",     open: "08:00", close: "16:30", indexSymbol: "^FTSE", holidayCalendarRef: "uk" },
  { exchange: "NYSE",   name: "New York Stock Exchange",        city: "New York",  country: "USA",       tz: "America/New_York",  open: "09:30", close: "16:00", indexSymbol: "^DJI",  holidayCalendarRef: "us" },
  { exchange: "NASDAQ", name: "NASDAQ",                         city: "New York",  country: "USA",       tz: "America/New_York",  open: "09:30", close: "16:00", indexSymbol: "^IXIC", holidayCalendarRef: "us" },
  { exchange: "TSX",    name: "Toronto Stock Exchange",         city: "Toronto",   country: "Canada",    tz: "America/Toronto",   open: "09:30", close: "16:00", indexSymbol: "^GSPTSE", holidayCalendarRef: "ca" },
];
