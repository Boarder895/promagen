export type MarketStatus =
  | "OPEN" | "CLOSED" | "PRE" | "POST"
  | "open" | "closed" | "pre" | "post"
  | "holiday" | "unknown";

export type MarketState = { status: MarketStatus; nextChangeISO?: string | null };

export type Exchange = {
  id: string;
  exchange: string;
  city: string;
  country: string;
  iso2: string;
  tz: string;
  longitude: number;
};

export type SessionKind = "PRE" | "REG" | "POST" | undefined;
export type Session = { startMin: number; endMin: number; kind?: SessionKind };
export type Sessions = Session[];



