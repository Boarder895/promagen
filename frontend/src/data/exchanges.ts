// Canonical exchanges catalog (Stage-1/2). We keep a wider catalog,
// but exactly 12 are selected for the ribbon (6 East / 6 West).

export type Exchange = {
  id: string;
  city: string;
  exchange: string;
  country: string;
  iso2: string;      // ISO-3166 alpha-2 for flag
  tz: string;        // IANA time zone
  longitude: number; // used for east/west split
};

export const EXCHANGES: Exchange[] = [
  // --- Eastern hemisphere (> 0 lon)
  { id: "ASX",   city: "Sydney",        exchange: "ASX",   country: "Australia",     iso2: "au", tz: "Australia/Sydney",        longitude: 151.21 },
  { id: "TSE",   city: "Tokyo",         exchange: "TSE",   country: "Japan",         iso2: "jp", tz: "Asia/Tokyo",              longitude: 139.69 },
  { id: "HKEX",  city: "Hong Kong",     exchange: "HKEX",  country: "China",         iso2: "hk", tz: "Asia/Hong_Kong",          longitude: 114.16 },
  { id: "SGX",   city: "Singapore",     exchange: "SGX",   country: "Singapore",     iso2: "sg", tz: "Asia/Singapore",          longitude: 103.82 }, // kept in catalog, not selected
  { id: "BSE",   city: "Mumbai",        exchange: "BSE",   country: "India",         iso2: "in", tz: "Asia/Kolkata",            longitude: 72.88 },
  { id: "JSE",   city: "Johannesburg",  exchange: "JSE",   country: "South Africa",  iso2: "za", tz: "Africa/Johannesburg",     longitude: 28.05 },
  { id: "XETRA", city: "Frankfurt",     exchange: "Xetra", country: "Germany",       iso2: "de", tz: "Europe/Berlin",           longitude: 8.68 },
  // { id: "DFM", city: "Dubai", exchange: "DFM", country: "UAE", iso2: "ae", tz: "Asia/Dubai", longitude: 55.27 }, // removed earlier per request

  // --- Western hemisphere (<= 0 lon)
  { id: "LSE",   city: "London",        exchange: "LSE",   country: "United Kingdom", iso2: "gb", tz: "Europe/London",          longitude: -0.13 },
  { id: "NYSE",  city: "New York",      exchange: "NYSE",  country: "United States",  iso2: "us", tz: "America/New_York",       longitude: -74.00 },
  { id: "CME",   city: "Chicago",       exchange: "CME",   country: "United States",  iso2: "us", tz: "America/Chicago",        longitude: -87.63 },
  { id: "TSX",   city: "Toronto",       exchange: "TSX",   country: "Canada",         iso2: "ca", tz: "America/Toronto",        longitude: -79.38 },
  { id: "B3",    city: "São Paulo",     exchange: "B3",    country: "Brazil",         iso2: "br", tz: "America/Sao_Paulo",      longitude: -46.63 },
  { id: "BYMA",  city: "Buenos Aires",  exchange: "BYMA",  country: "Argentina",      iso2: "ar", tz: "America/Argentina/Buenos_Aires", longitude: -58.38 },
];

// Exactly 12 shown on the ribbon: 6 East + 6 West.
// EAST (6): Sydney, Tokyo, Hong Kong, Mumbai, Johannesburg, Frankfurt
// WEST (6): London, New York, Chicago, Toronto, São Paulo, Buenos Aires
export const SELECTED_IDS: string[] = [
  // East (SGX removed; XETRA added to keep 6)
  "ASX", "TSE", "HKEX", "BSE", "JSE", "XETRA",
  // West
  "LSE", "NYSE", "CME", "TSX", "B3", "BYMA",
];
