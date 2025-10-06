// In-memory market simulator for the Board MVP (no DB required)
import { randomUUID } from "node:crypto";
import type { Response } from "express";

// ---------- Types ----------
export type Platform = {
  id: string;
  symbol: string;
  name: string;
  url: string;
  category?: string;
  badges?: string[];
};

export type Quote = {
  platformId: string;
  ts: number;          // epoch ms
  score: number;       // 0..100
  changeAbs: number;   // delta since last tick
  changePct: number;   // delta%
  volume: number;      // arbitrary “mentions/usage”
  high24: number;
  low24: number;
};

export type BoardRow = {
  rank: number;
  rankDelta: number;
  symbol: string;
  name: string;
  score: number;
  changeAbs: number;
  changePct: number;
  volume: number;
  high24: number;
  low24: number;
  badges: string[];
  url: string;
  spark7d: number[]; // placeholder
};

export type IGItem = {
  platformId: string;
  symbol: string;
  name: string;
  tagline: string;
  prompts: string[]; // “helpful prompts”
  url: string;
};

// ---------- Data ----------
const platforms: Platform[] = Array.from({ length: 30 }).map((_, i) => {
  const n = i + 1;
  return {
    id: randomUUID(),
    symbol: `MIG${n}`,
    name: `MIG Platform ${n}`,
    url: `https://example.com/mig${n}`,
    category: n % 2 ? "General" : "Specialist",
    badges: [n % 3 === 0 ? "AI-assisted" : "—", n % 5 === 0 ? "Open-source" : "—"].filter(b => b !== "—"),
  };
});

const quotes = new Map<string, Quote>();
const priorRanks = new Map<string, number>();

// seed quotes
for (const p of platforms) {
  const score = 50 + Math.random() * 30 - 15; // ~50±15
  quotes.set(p.id, {
    platformId: p.id,
    ts: Date.now(),
    score,
    changeAbs: 0,
    changePct: 0,
    volume: Math.floor(Math.random() * 500 + 100),
    high24: score,
    low24: score,
  });
}

// ---------- SSE: manage subscribers ----------
const sseClients = new Set<Response>();
export const sseAddClient = (res: Response) => {
  sseClients.add(res);
  res.on("close", () => sseClients.delete(res));
};

const sseBroadcast = (event: string, data: unknown) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) res.write(payload);
};

// ---------- Ranks & board ----------
const computeRanks = (): string[] => {
  const ids = Array.from(quotes.values())
    .sort((a, b) => b.score - a.score)
    .map(q => q.platformId);
  return ids;
};

export const getBoard = (limit = 20): BoardRow[] => {
  const order = computeRanks();
  const rows: BoardRow[] = [];
  for (let i = 0; i < Math.min(limit, order.length); i++) {
    const id = order[i];
    const p = platforms.find(x => x.id === id)!;
    const q = quotes.get(id)!;
    const prev = priorRanks.get(id) ?? i + 1;
    rows.push({
      rank: i + 1,
      rankDelta: prev - (i + 1),
      symbol: p.symbol,
      name: p.name,
      score: Number(q.score.toFixed(2)),
      changeAbs: Number(q.changeAbs.toFixed(2)),
      changePct: Number(q.changePct.toFixed(2)),
      volume: q.volume,
      high24: Number(q.high24.toFixed(2)),
      low24: Number(q.low24.toFixed(2)),
      badges: p.badges ?? [],
      url: p.url,
      spark7d: [], // placeholder in MVP
    });
  }
  // remember current ranks
  order.forEach((pid, i) => priorRanks.set(pid, i + 1));
  return rows;
};

// ---------- IG picks ----------
export const igItems: IGItem[] = platforms.slice(0, 8).map((p, i) => ({
  platformId: p.id,
  symbol: p.symbol,
  name: p.name,
  tagline: ["Best for speed", "Best for scale", "Best for budget", "Best for experimentation"][i % 4],
  prompts: [
    `Try ${p.symbol} for onboarding`,
    `Benchmark ${p.symbol} vs MIG${(i + 5)}`,
    `Draft a growth plan with ${p.symbol}`,
  ],
  url: p.url,
}));

// ---------- Market hours (simple, no holidays) ----------
type Market = { code: string; name: string; tz: string; open: string; close: string };
export const markets: Market[] = [
  { code: "NYSE",    name: "New York Stock Exchange", tz: "America/New_York", open: "09:30", close: "16:00" },
  { code: "NASDAQ",  name: "NASDAQ",                  tz: "America/New_York", open: "09:30", close: "16:00" },
  { code: "LSE",     name: "London Stock Exchange",   tz: "Europe/London",    open: "08:00", close: "16:30" },
  { code: "EURONXT", name: "Euronext",                tz: "Europe/Paris",     open: "09:00", close: "17:30" },
  { code: "HKEX",    name: "Hong Kong",               tz: "Asia/Hong_Kong",   open: "09:30", close: "16:00" },
  { code: "TSE",     name: "Tokyo",                   tz: "Asia/Tokyo",       open: "09:00", close: "15:00" },
  { code: "SSE",     name: "Shanghai",                tz: "Asia/Shanghai",    open: "09:30", close: "15:00" },
  { code: "NSE",     name: "India (NSE)",             tz: "Asia/Kolkata",     open: "09:15", close: "15:30" },
];

const parseHM = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return { h, m };
};

const nowInTz = (tz: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number((parts.find(p => p.type === t)?.value) || "0");
  // naive: reconstruct local time in that tz
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second"), weekday: parts.find(p => p.type === "weekday")?.value || "Mon" };
};

export const getMarketsStatus = () => {
  const out = markets.map(mk => {
    const now = nowInTz(mk.tz);
    const { h: oh, m: om } = parseHM(mk.open);
    const { h: ch, m: cm } = parseHM(mk.close);
    const minsNow = now.hour * 60 + now.minute;
    const minsOpen = oh * 60 + om;
    const minsClose = ch * 60 + cm;
    const weekdayOpen = !["Sat", "Sun"].includes(now.weekday);
    const open = weekdayOpen && minsNow >= minsOpen && minsNow <= minsClose;
    const localTime = `${String(now.hour).padStart(2,"0")}:${String(now.minute).padStart(2,"0")}`;

    let nextEvent = "";
    if (weekdayOpen) {
      if (open) nextEvent = `${("00"+Math.max(minsClose - minsNow,0)).slice(-3)}m to close`;
      else if (minsNow < minsOpen) nextEvent = `${("00"+Math.max(minsOpen - minsNow,0)).slice(-3)}m to open`;
      else nextEvent = "Opens next weekday";
    } else {
      nextEvent = "Closed (weekend)";
    }
    return { code: mk.code, name: mk.name, tz: mk.tz, open, localTime, nextEvent, hours: { open: mk.open, close: mk.close } };
  });
  return out;
};

// ---------- Ticker loop ----------
setInterval(() => {
  const nUpdates = 6; // update a few per tick
  for (let i = 0; i < nUpdates; i++) {
    const p = platforms[Math.floor(Math.random() * platforms.length)];
    const q = quotes.get(p.id)!;
    const old = q.score;
    let delta = (Math.random() - 0.5) * 0.8; // -0.4..+0.4
    const newer = Math.max(0, Math.min(100, old + delta));
    q.score = newer;
    q.changeAbs = newer - old;
    q.changePct = old ? (q.changeAbs / old) * 100 : 0;
    q.volume += Math.floor(Math.random() * 20);
    q.high24 = Math.max(q.high24, newer);
    q.low24 = Math.min(q.low24, newer);
    q.ts = Date.now();

    sseBroadcast("tick", {
      ts: q.ts,
      symbol: p.symbol,
      score: Number(q.score.toFixed(2)),
      changeAbs: Number(q.changeAbs.toFixed(2)),
      changePct: Number(q.changePct.toFixed(2)),
      volume: q.volume,
    });
  }
}, 2500);

export const boardsOnce = () => getBoard(20);
